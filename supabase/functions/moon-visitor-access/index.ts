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
        .select("owner_id,revoked_at,expires_at").eq("token_hash", digest).maybeSingle();
      if (link.error) throw link.error;
      if (!link.data || link.data.revoked_at || (link.data.expires_at && Date.parse(link.data.expires_at) <= Date.now()))
        return json(req, 403, {error: "Ce lien visiteur a expiré ou a été désactivé."});
      const snapshot = await db.from("moon_snapshots")
        .select("revision,updated_at").eq("owner_id", link.data.owner_id).maybeSingle();
      if (snapshot.error) throw snapshot.error;
      if (!snapshot.data) return json(req, 404, {error: "Aucune donnée disponible pour ce lien."});
      const revision = Number(snapshot.data.revision);
      if (Number.isSafeInteger(input.knownRevision) && Number(input.knownRevision) === revision)
        return json(req, 200, {ok: true, unchanged: true, revision, updatedAt: snapshot.data.updated_at});
      const full = await db.from("moon_snapshots")
        .select("content,revision,updated_at").eq("owner_id", link.data.owner_id).maybeSingle();
      if (full.error) throw full.error;
      if (!full.data) return json(req, 404, {error: "Aucune donnée disponible pour ce lien."});
      return json(req, 200, {ok: true, revision: Number(full.data.revision), updatedAt: full.data.updated_at, content: full.data.content});
    }

    if (!["list","create","revoke"].includes(action)) return json(req, 400, {error: "Action inconnue."});
    const owner = await authenticatedOwner(req);
    if (!owner) return json(req, 401, {error: "Session propriétaire requise."});

    if (action === "list") {
      const links = await db.from("moon_visitor_links")
        .select("id,label,created_at,revoked_at,expires_at")
        .eq("owner_id", owner.id).order("created_at", {ascending: false}).limit(100);
      if (links.error) throw links.error;
      return json(req, 200, {ok: true, links: links.data || []});
    }

    if (action === "create") {
      const label = typeof input.label === "string" ? input.label.trim() : "";
      if (!label || label.length > 100) return json(req, 400, {error: "Le nom du lien doit contenir entre 1 et 100 caractères."});
      const token = freshToken();
      const digest = await hashToken(token);
      const inserted = await db.from("moon_visitor_links")
        .insert({owner_id: owner.id, label, token_hash: digest})
        .select("id,label,created_at,revoked_at,expires_at").single();
      if (inserted.error) throw inserted.error;
      // The plaintext token is delivered once, to the owner who created it.
      return json(req, 201, {ok: true, token, link: inserted.data});
    }

    const linkId = typeof input.id === "string" ? input.id : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(linkId))
      return json(req, 400, {error: "Identifiant du lien invalide."});
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
