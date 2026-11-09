"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,"..");
const load=p=>fs.readFileSync(path.join(root,p),"utf8");
const app=load("app.js"),cloud=load("cloud.js"),guest=load("visitor.js"),edge=load("supabase/functions/moon-visitor-access/index.ts"),sql=load("supabase/moon_visitor_links.sql"),html=load("index.html");

test("all MOON browser scripts have valid JavaScript syntax",()=>{
 for(const [name,source] of [["app.js",app],["cloud.js",cloud],["visitor.js",guest]])assert.doesNotThrow(()=>new vm.Script(source,{filename:name}));
});
test("visitor URL loads before authentication and has no access to personal pages",()=>{
 assert.match(html,/visitor\.js\?v=1\.2/);
 assert.ok(html.indexOf("visitor.js?v=1.2")<html.indexOf("cloud.js?v=13.0"));
 assert.match(cloud,/if\(window\.MOON_VISITOR\?\.isVisitor\?\.\(\)\)return/);
 assert.match(app,/window\.MOON_VISITOR\?\.isVisitorReady/);
 assert.match(guest,/pageAllowed/);
 assert.match(guest,/const PAGES=new Set\(\[\.\.\.SECTIONS\.map/);
});
test("server validates bearer token and owner identity, never exposes DB to anon",()=>{
 assert.match(edge,/verify.*user JWT|user JWT/i);
 assert.match(edge,/hashToken\(token\)/);
 assert.match(edge,/crypto\.getRandomValues\(new Uint8Array\(32\)\)/);
 assert.match(edge,/db\.auth\.getUser\(jwt\)/);
 assert.match(edge,/eq\("owner_id", owner\.id\)/);
 assert.match(edge,/revoked_at/);
 assert.match(edge,/knownRevision/);
 assert.match(edge,/Cache-Control": "no-store, private"/);
 assert.match(sql,/enable row level security/);
 assert.match(sql,/revoke all on public\.moon_visitor_links from anon, authenticated, public/);
 assert.doesNotMatch(guest,/localStorage\.setItem/);
});
test("anonymous UI cannot save, submit, drag, change tasks or access owner controls",()=>{
 assert.match(app,/if\(isReadOnly\(\)\)return false;/);
 assert.match(app,/if\(isReadOnly\(\)\)\{e\.preventDefault\(\);e\.stopPropagation\(\);return\}/);
 assert.match(app,/if\(isReadOnly\(\)\)\{\n if\(a==="visitor-refresh"\)/);
 assert.match(app,/if\(isReadOnly\(\)\)\{e\.preventDefault\(\);return\}const card=/);
 assert.match(app,/if\(isReadOnly\(\)\)return;const lane=/);
 assert.match(app,/visitorContactModal/);assert.match(app,/visitorTaskModal/);
 assert.match(app,/MOON_CLOUD_BRIDGE=\{\n visitorPage:/);
 assert.match(app,/if\(!isReadOnly\(\)\|\|!record/);
 assert.match(app,/disabled=true/);
});

function mockBrowser(fragment,fetcher){
 const callbacks={},rootNode={hidden:false,innerHTML:""},labelNode={value:"Direction"};
 const document={readyState:"loading",hidden:false,body:{classList:{add(){},remove(){}}},addEventListener:(name,cb)=>{callbacks[name]=cb},querySelectorAll:()=>[{value:"board"},{value:"opportunities"}],getElementById:id=>id==="auth-root"?rootNode:id==="visitor-link-label"?labelNode:null};
 const state={loads:[],clears:0};
 const window={MOON_SUPABASE_CONFIG:{url:"https://example.supabase.co",publishableKey:"sb_publishable_test"},addEventListener(){},MOON_CLOUD:{getAccessToken:async()=>"owner.jwt.token"},MOON_CLOUD_BRIDGE:{visitorLoad:data=>{state.loads.push(data);return true},visitorClear:()=>{state.clears++}}};
 const context={window,document,location:{hash:fragment,origin:"https://nolabernard.github.io",pathname:"/MOON/"},URLSearchParams,fetch:fetcher,setInterval:()=>1,console,navigator:{clipboard:{writeText:async()=>{}}},confirm:()=>true};
 vm.runInNewContext(guest,context);
 return {window,document,callbacks,rootNode,labelNode,state};
}
test("a share link displays current data without logging in, then revocation clears it",async()=>{
 let blocked=false,calls=[];
 const fetcher=async (url,options)=>{
  const body=JSON.parse(options.body);calls.push({url,body,headers:options.headers});
  return blocked?{ok:false,status:403,json:async()=>({error:"Lien désactivé."})}:{ok:true,status:200,json:async()=>({ok:true,revision:3,content:{contacts:[],opportunities:[],tasks:[]}})};
 };
 const b=mockBrowser("#visit=v1_"+"A".repeat(43),fetcher);
 assert.equal(b.window.MOON_VISITOR.isVisitor(),true);
 assert.equal(b.window.MOON_VISITOR.pageAllowed("account"),false);
 assert.equal(b.window.MOON_VISITOR.pageAllowed("settings"),false);
 b.callbacks.DOMContentLoaded();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(b.window.MOON_VISITOR.isVisitorReady(),true);
 assert.equal(b.state.loads.length,1);
 assert.equal(calls[0].body.action,"read");
 assert.equal(calls[0].headers.Authorization,undefined);
 blocked=true;await b.window.MOON_VISITOR.refresh();
 assert.equal(b.window.MOON_VISITOR.isVisitorReady(),false);
 assert.equal(b.state.clears,1);
 assert.match(b.rootNode.innerHTML,/Lien désactivé/);
});
test("owner can create and revoke a link using an authenticated API request",async()=>{
 const calls=[];
 const fetcher=async (url,options)=>{
  const body=JSON.parse(options.body);calls.push({body,auth:options.headers.Authorization});
  const payload=body.action==="create"?{ok:true,token:"v1_"+"Z".repeat(43),link:{id:"one"}}:body.action==="list"?{ok:true,links:[]}:{ok:true,revoked:true};
  return {ok:true,status:200,json:async()=>payload};
 };
 const b=mockBrowser("",fetcher);
 await b.window.MOON_VISITOR.adminAction("visitor-create",{dataset:{}});
 assert.match(b.window.MOON_VISITOR.adminHtml(),/#visit=v1_Z/);
 assert.equal(calls[0].auth,"Bearer owner.jwt.token");
 assert.equal(calls[0].body.label,"Direction");
 assert.deepEqual(Array.from(calls[0].body.allowedSections),["board","opportunities"]);
 assert.ok(calls.some(x=>x.body.action==="list"));
});
