import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(src+'\nexport {encrypt,gateSign,hash,setCookie};').toString('base64'));
let tokenEncrypted,sessionHash;
const env={GATE_SESSION_SECRET:'test-only-community-secret-at-least-32chars',ADMIN_PASSWORD:'test-only-admin-password',PLEX_SESSION_SECRET:'test-only-plex-secret-at-least-32characters',DB:{prepare(sql){let args=[];return{bind(...a){args=a;return this},async run(){return{success:true}},async all(){return{results:[]}},async first(){if(sql.startsWith('SELECT * FROM plex_sessions'))return args[0]===sessionHash?{token_encrypted:tokenEncrypted,plex_user_id:'fixture-user',username:'Fixture'}:null;return null}}}}};
const sessionId='b'.repeat(64);sessionHash=await mod.hash(sessionId);tokenEncrypted=await mod.encrypt(env,'test-only-plex-account-token');
const exp=String(Math.floor(Date.now()/1000)+3600);const gate='mh_gate='+exp+'.'+await mod.gateSign(env.GATE_SESSION_SECRET+':default',exp);
const cookie=[gate,'mh_session='+sessionId].join('; ');
const oldFetch=globalThis.fetch;
// First published connection NEVER answers (a dead address — the old code
// walked connections serially and burned a full timeout on it per path, so
// /api/plex/home hung). The second connection is healthy.
globalThis.fetch=async url=>{const u=new URL(url);
 if(u.hostname==='plex.tv')return Response.json([{name:'Fixture Server',provides:'server',accessToken:'test-only-server-token',clientIdentifier:'fixture-machine',connections:[{uri:'https://dead-plex.example'},{uri:'https://alive-plex.example'}]}]);
 if(u.hostname==='dead-plex.example')return new Promise(()=>{});
 if(u.hostname==='alive-plex.example'){
  if(u.pathname==='/library/sections')return Response.json({MediaContainer:{Directory:[{key:'1',type:'movie',title:'Movies'}]}});
  if(u.pathname==='/library/onDeck'||u.pathname.startsWith('/hubs/'))return Response.json({MediaContainer:{Metadata:[{ratingKey:'55',title:'Fixture Film',type:'movie',year:2024,addedAt:'1700000000',thumb:''}]}});
  if(u.pathname.includes('recentlyAdded')||u.pathname.includes('/all'))return Response.json({MediaContainer:{Metadata:[{ratingKey:'56',title:'New Fixture Film',type:'movie',year:2025,addedAt:'1700001000',thumb:''}]}});
  return Response.json({MediaContainer:{Metadata:[]}});
 }
 throw Error('Unexpected fixture request '+url);};
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('ok -',m)};
try{
 const started=Date.now();
 const r=await Promise.race([
  mod.default.fetch(new Request('https://example.com/api/plex/home',{headers:{cookie}}),env),
  new Promise((_,rej)=>setTimeout(()=>rej(new Error('home did not answer within 3s')),3000)),
 ]);
 const body=await r.json();
 ok(r.status===200,'home answers despite the dead first connection');
 ok(Date.now()-started<3000,'home answered in '+(Date.now()-started)+'ms (the dead connection no longer serialises)');
 const server=(body.servers||[])[0]||{};
 const titles=JSON.stringify(body);
 ok(titles.includes('Fixture Film'),'continue watching items came from the healthy connection');
 console.log(passed+' plex home assertions passed');
}finally{globalThis.fetch=oldFetch}
