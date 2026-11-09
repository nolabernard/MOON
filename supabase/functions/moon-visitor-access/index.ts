import { createClient } from "npm:@supabase/supabase-js@2.118.0";

// Public endpoint by design: every guest read requires a strong, revocable bearer token.
// Management actions require a separately verified Supabase Auth user JWT.
// Never return service-role credentials or expose moon_snapshots to anonymous RLS.
const url = Deno.env.get("SUPABASE_URL") || "";
const secrets = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
const secretKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || secrets.default;
if (!secretKey || !url) throw new Error("Missing Supabase function credentials");
const db = createClient(url, secretKey, {auth: {persistSession: false, autoRefreshToken: false}});
const fixedOrigin = "https://nolabernard.github.io";

function headers(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") || "";
  const allowed = origin === fixedOrigin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, private",
    "Pragma": "no-cache",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin",
    "Access-Control-Allow-Origin": allowed ? origin : fixedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info"
  };
}
function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {status, headers: headers(req)});
}
async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("");
}
async function encryptionKey() {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(secretKey), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({name:"HKDF",hash:"SHA-256",salt:new TextEncoder().encode("moon-visitor-token-recovery-v1"),info:new TextEncoder().encode("AES-GCM bearer token storage")},material,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
async function encryptToken(token: string) {
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const bytes=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},await encryptionKey(),new TextEncoder().encode(token)));
  return btoa(String.fromCharCode(...iv,...bytes));
}
async function decryptToken(value: string) {
  const bytes=Uint8Array.from(atob(value),c=>c.charCodeAt(0));
  return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes.slice(0,12)},await encryptionKey(),bytes.slice(12)));
}
function freshToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return "v1_" + btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function authenticatedOwner(req: Request) {
  const auth = req.headers.get("authorization") || "";
  if (!/^Bearer [A-Za-z0-9._-]+$/.test(auth)) return null;
  const jwt = auth.slice(7);
  const result = await db.auth.getUser(jwt);
  return result.error ? null : result.data.user;
}

const SECTIONS=["day","dashboard","board","opportunities","contacts","tasks","reporting"];
function validSections(value:unknown): value is string[]{return Array.isArray(value)&&value.length>0&&value.length<=7&&value.every(x=>typeof x==="string"&&SECTIONS.includes(x))&&new Set(value).size===value.length}
// Explicit per-section field allowlists. Never send complete CRM objects for a partial share.
function pick(value:any,keys:readonly string[]){
 const result:Record<string,unknown>={};
 if(!value||typeof value!=="object")return result;
 for(const key of keys)if(Object.prototype.hasOwnProperty.call(value,key))result[key]=value[key];
 return result;
}
const CONTACT_NAME=["id","first","last","company"] as const;
const OPPORTUNITY_SUMMARY=["id","contactId","training","category","stage","ht","vat","follow","forecast","closed","created","maturity"] as const;
const REPORTING_FIELDS=["id","stage","ht","vat","created","forecast","closed","category"] as const;
const TASK_SUMMARY=["id","title","status","due","priority","type","contactId","opportunityId","created","notes"] as const;
function filteredSnapshot(content:any,sections:string[]){
 const selected=new Set(sections);
 const fullContacts=selected.has("contacts");
 const fullOpportunities=selected.has("opportunities");
 const broad=selected.has("day")||selected.has("dashboard");
 const board=selected.has("board");
 const tasks=selected.has("tasks")||broad;
 const needNames=board||fullOpportunities||broad||tasks;
 const needOpportunities=board||fullOpportunities||broad;
 const rawContacts=Array.isArray(content?.contacts)?content.contacts:[];
 const rawOpportunities=Array.isArray(content?.opportunities)?content.opportunities:[];
 const rawTasks=Array.isArray(content?.tasks)?content.tasks:[];
 return {
  version:content?.version||2,
  contacts:fullContacts?rawContacts.map((c:any)=>pick(c,["id","first","last","company","email","phone","profile","notes","created"])):
    needNames?rawContacts.map((c:any)=>pick(c,CONTACT_NAME)):[],
  opportunities:fullOpportunities?rawOpportunities:
    needOpportunities?rawOpportunities.map((o:any)=>pick(o,OPPORTUNITY_SUMMARY)):
    tasks?rawOpportunities.map((o:any)=>pick(o,["id","contactId","training"])):
    selected.has("reporting")?rawOpportunities.map((o:any)=>pick(o,REPORTING_FIELDS)):[],
  tasks:tasks?rawTasks.map((t:any)=>pick(t,TASK_SUMMARY)):[],
 };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, {status: 204, headers: headers(req)});
  if (req.method !== "POST") return json(req, 405, {error: "Méthode non autorisée."});
  const origin = req.headers.get("origin") || "";
  if (origin && origin !== fixedOrigin && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))
    return json(req, 403, {error: "Origine non autorisée."});
  try {
    const raw = await req.text();
    if (raw.length > 4096) return json(req, 413, {error: "Requête trop volumineuse."});
    const input = JSON.parse(raw) as Record<string, unknown>;
    const action = typeof input.action === "string" ? input.action : "";

    if (action === "read") {
      const token = typeof input.token === "string" ? input.token : "";
      if (!/^v1_[A-Za-z0-9_-]{43}$/.test(token))
        return json(req, 403, {error: "Lien visiteur invalide ou désactivé."});
      const digest = await hashToken(token);
      const link = await db.from("moon_visitor_links")
        .select("owner_id,revoked_at,expires_at,allowed_sections,permissions_version").eq("token_hash", digest).maybeSingle();
      if (link.error) throw link.error;
      if (!link.data || link.data.revoked_at || (link.data.expires_at && Date.parse(link.data.expires_at) <= Date.now()))
        return json(req, 403, {error: "Ce lien visiteur a expiré ou a été désactivé."});
      const snapshot = await db.from("moon_snapshots")
        .select("revision,updated_at").eq("owner_id", link.data.owner_id).maybeSingle();
      if (snapshot.error) throw snapshot.error;
      if (!snapshot.data) return json(req, 404, {error: "Aucune donnée disponible pour ce lien."});
      const revision = Number(snapshot.data.revision);
      const allowedSections=validSections(link.data.allowed_sections)?link.data.allowed_sections:SECTIONS;
      const permissionsVersion=link.data.permissions_version||1;
      if (typeof input.knownRevision === "number" && Number.isSafeInteger(input.knownRevision) && input.knownRevision === revision && input.knownPermissionsVersion === permissionsVersion)
        return json(req, 200, {ok: true, unchanged: true, revision, allowedSections, permissionsVersion, updatedAt: snapshot.data.updated_at});
      const full = await db.from("moon_snapshots")
        .select("content,revision,updated_at").eq("owner_id", link.data.owner_id).maybeSingle();
      if (full.error) throw full.error;
      if (!full.data) return json(req, 404, {error: "Aucune donnée disponible pour ce lien."});
      return json(req, 200, {ok: true, revision: Number(full.data.revision), updatedAt: full.data.updated_at, content: filteredSnapshot(full.data.content,allowedSections),allowedSections,permissionsVersion});
    }

    if (!["list","create","revoke","recover","update","delete"].includes(action)) return json(req, 400, {error: "Action inconnue."});
    const owner = await authenticatedOwner(req);
    if (!owner) return json(req, 401, {error: "Session propriétaire requise."});

    if (action === "list") {
      const links = await db.from("moon_visitor_links")
        .select("id,label,created_at,revoked_at,expires_at,token_encrypted,allowed_sections")
        .eq("owner_id", owner.id).order("created_at", {ascending: false}).limit(100);
      if (links.error) throw links.error;
      return json(req, 200, {ok: true, links: (links.data || []).map(({token_encrypted,...link})=>({...link,recoverable:!!token_encrypted}))});
    }

    if (action === "create") {
      const label = typeof input.label === "string" ? input.label.trim() : "";
      if (!label || label.length > 100) return json(req, 400, {error: "Le nom du lien doit contenir entre 1 et 100 caractères."});
      const allowedSections=input.allowedSections;
      if(!validSections(allowedSections))return json(req,400,{error:"Sélectionnez au moins une rubrique valide."});
      const token = freshToken();
      const digest = await hashToken(token);
      const inserted = await db.from("moon_visitor_links")
        .insert({owner_id: owner.id, label, token_hash: digest, token_encrypted: await encryptToken(token),allowed_sections:allowedSections})
        .select("id,label,created_at,revoked_at,expires_at").single();
      if (inserted.error) throw inserted.error;
      // The plaintext token is delivered once, to the owner who created it.
      return json(req, 201, {ok: true, token, link: inserted.data});
    }

    const linkId = typeof input.id === "string" ? input.id : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(linkId))
      return json(req, 400, {error: "Identifiant du lien invalide."});
    if (action === "delete") {
      // Deletion is permitted only for a link already revoked or expired.
      // Ownership is always checked on the server; CRM snapshots are never touched.
      const existing=await db.from("moon_visitor_links")
        .select("id,revoked_at,expires_at")
        .eq("owner_id",owner.id).eq("id",linkId).maybeSingle();
      if(existing.error)throw existing.error;
      if(!existing.data)return json(req,404,{error:"Lien introuvable."});
      const disabled=!!existing.data.revoked_at||(!!existing.data.expires_at&&Date.parse(existing.data.expires_at)<=Date.now());
      if(!disabled)return json(req,409,{error:"Désactivez ce lien avant de le supprimer."});
      // Guard against a concurrent status change before deletion.
      let deletion=db.from("moon_visitor_links").delete().eq("owner_id",owner.id).eq("id",linkId);
      if(existing.data.revoked_at)deletion=deletion.eq("revoked_at",existing.data.revoked_at);
      else deletion=deletion.is("revoked_at",null).lte("expires_at",new Date().toISOString());
      const removed=await deletion.select("id");
      if(removed.error)throw removed.error;
      if(!removed.data?.length)return json(req,409,{error:"L'état du lien a changé. Actualisez la liste."});
      return json(req,200,{ok:true,deleted:true});
    }
    if (action === "update") {
      if(!validSections(input.allowedSections))return json(req,400,{error:"Rubriques invalides."});
      const existing=await db.from("moon_visitor_links").select("permissions_version").eq("owner_id",owner.id).eq("id",linkId).is("revoked_at",null).maybeSingle();
      if(existing.error)throw existing.error;
      if(!existing.data)return json(req,404,{error:"Lien introuvable ou désactivé."});
      const updated=await db.from("moon_visitor_links").update({allowed_sections:input.allowedSections,permissions_version:existing.data.permissions_version+1}).eq("owner_id",owner.id).eq("id",linkId).eq("permissions_version",existing.data.permissions_version).is("revoked_at",null).select("id");
      if(updated.error)throw updated.error;
      if(!updated.data?.length)return json(req,409,{error:"Les accès ont changé. Actualisez puis réessayez."});
      return json(req,200,{ok:true});
    }
    if (action === "recover") {
      const existing=await db.from("moon_visitor_links")
        .select("id,token_encrypted,revoked_at,expires_at")
        .eq("owner_id",owner.id).eq("id",linkId).maybeSingle();
      if(existing.error)throw existing.error;
      if(!existing.data||existing.data.revoked_at||(existing.data.expires_at&&Date.parse(existing.data.expires_at)<=Date.now()))
        return json(req,404,{error:"Ce lien n'est plus actif."});
      if(existing.data.token_encrypted) {
        const recovered=await decryptToken(existing.data.token_encrypted);
        return json(req,200,{ok:true,token:recovered,rotated:false});
      }
      // Legacy links only stored SHA-256 hashes: the original bearer token cannot be recovered.
      // Explicit owner-triggered renewal invalidates the previous token for this link.
      const replacement=freshToken();
      const updated=await db.from("moon_visitor_links")
        .update({token_hash:await hashToken(replacement),token_encrypted:await encryptToken(replacement)})
        .eq("owner_id",owner.id).eq("id",linkId).is("revoked_at",null).is("token_encrypted",null).select("id");
      if(updated.error)throw updated.error;
      if(!updated.data?.length)return json(req,409,{error:"Lien déjà renouvelé. Actualisez la liste."});
      return json(req,200,{ok:true,token:replacement,rotated:true});
    }
    const revoked = await db.from("moon_visitor_links")
      .update({revoked_at: new Date().toISOString()})
      .eq("owner_id", owner.id).eq("id", linkId).is("revoked_at", null)
      .select("id");
    if (revoked.error) throw revoked.error;
    return json(req, 200, {ok: true, revoked: (revoked.data || []).length === 1});
  } catch (error) {
    console.error("moon-visitor-access operation failed", error instanceof Error ? error.name : "unknown");
    return json(req, 500, {error: "Service temporairement indisponible. Réessayez."});
  }
});
