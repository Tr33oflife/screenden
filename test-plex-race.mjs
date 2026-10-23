// Timing proof for the v3.6.32 connection race: the fixture server publishes
// TWO dead addresses (they hang until the caller's abort signal fires, like a
// real dead published address) ahead of one healthy address. Serial code
// paths paid ~7s per dead address per request (poster art was the worst:
// one walk per image). Raced + sticky-winner paths must answer in <3s.
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(src+'\nexport {encrypt,gateSign,hash,setCookie};').toString('base64'));
let tokenEncrypted,sessionHash;
const env={GATE_SESSION_SECRET:'test-only-community-secret-at-least-32chars',ADMIN_PASSWORD:'test-only-admin-password',PLEX_SESSION_SECRET:'test-only-plex-secret-at-least-32characters',DB:{prepare(sql){let args=[];return{bind(...a){args=a;return this},async run(){return{success:true}},async all(){return{results:[]}},async first(){if(sql.startsWith('SELECT * FROM plex_sessions'))return args[0]===sessionHash?{token_encrypted:tokenEncrypted,plex_user_id:'fixture-user',username:'Fixture'}:null;return null}}}}};
const sessionId='b'.repeat(64);sessionHash=await mod.hash(sessionId);tokenEncrypted=await mod.encrypt(env,'test-only-plex-account-token');
const exp=String(Math.floor(Date.now()/1000)+3600);const gate='mh_gate='+exp+'.'+await mod.gateSign(env.GATE_SESSION_SECRET+':default',exp);
const cookie=[gate,'mh_session='+sessionId].join('; ');
const oldFetch=globalThis.fetch;
const hang=(opts)=>new Promise((_,rej)=>{const s=opts?.signal;if(s){if(s.aborted)return rej(new Error('aborted'));s.addEventListener('abort',()=>rej(new Error('aborted')));}});
globalThis.fetch=async (url,opts)=>{const u=new URL(url);
 if(u.hostname==='plex.tv')return Response.json([{name:'Fixture Server',provides:'server',accessToken:'test-only-server-token',clientIdentifier:'fixture-machine',connections:[{uri:'https://dead1.example:32400'},{uri:'https://dead2.example:32400'},{uri:'https://alive.example:32400'}]}]);
 if(u.hostname.startsWith('dead'))return hang(opts);
 if(u.hostname==='alive.example'){
  if(u.pathname==='/library/sections')return Response.json({MediaContainer:{Directory:[{key:'1',type:'movie',title:'Movies'}]}});
  if(u.pathname.startsWith('/library/sections/'))return Response.json({MediaContainer:{Metadata:[{ratingKey:'55',title:'Fixture Film',type:'movie',year:2024,thumb:'/library/metadata/55/thumb'}]}});
  if(u.pathname.includes('/thumb'))return new Response(new Uint8Array([137,80,78,71]),{headers:{'content-type':'image/png'}});
  return Response.json({MediaContainer:{Metadata:[]}});
 }
 throw Error('Unexpected fixture request '+url);};
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('ok -',m)};
const timed=async path=>{const t=Date.now();const r=await mod.default.fetch(new Request('https://example.com'+path,{headers:{cookie}}),env);return {r,ms:Date.now()-t};};
try{
 const art=await timed('/api/plex/art?server=fixture-machine&path=/library/metadata/55/thumb');
 ok(art.r.status===200,'poster art loads from the healthy address');
 ok(art.ms<3000,'poster art answered in '+art.ms+'ms despite two dead addresses ahead of the healthy one');
 const rnd=await timed('/api/plex/random-movie?server=fixture-machine');
 const rndBody=await rnd.r.json();
 ok(rnd.r.status===200&&rndBody.movie&&rndBody.movie.title==='Fixture Film','random movie picks from the healthy address');
 ok(rnd.ms<3000,'random movie answered in '+rnd.ms+'ms');
 const art2=await timed('/api/plex/art?server=fixture-machine&path=/library/metadata/55/thumb');
 ok(art2.r.status===200&&art2.ms<3000,'repeat art call stays fast ('+art2.ms+'ms) — the winning connection is remembered');
 console.log(passed+' plex race assertions passed');
}finally{globalThis.fetch=oldFetch}
