import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(src+'\nexport {encrypt,gateSign,hash,setCookie};').toString('base64'));
// Stateful mock D1 for mh_my_list; plex_sessions lookups keyed by session hash.
const rows=new Map();
let sessionRows={};
const env={GATE_SESSION_SECRET:'test-only-community-secret-at-least-32chars',ADMIN_PASSWORD:'test-only-admin-password',PLEX_SESSION_SECRET:'test-only-plex-secret-at-least-32characters',DB:{prepare(sql){let args=[];return{bind(...a){args=a;return this},async run(){
  if(sql.startsWith('INSERT INTO mh_my_list')){rows.set(args[0]+'|'+args[1]+'|'+args[2],{plex_user_id:args[0],machine:args[1],rating_key:args[2],title:args[3],subtitle:args[4],type:args[5],year:args[6],thumb:args[7],detail_key:args[8],added_at:args[9]});}
  if(sql.startsWith('DELETE FROM mh_my_list')){rows.delete(args[0]+'|'+args[1]+'|'+args[2]);}
  return{success:true}},
 async all(){if(sql.includes('FROM mh_my_list'))return{results:[...rows.values()].filter(r=>r.plex_user_id===args[0]).sort((a,b)=>b.added_at-a.added_at)};return{results:[]}},
 async first(){if(sql.startsWith('SELECT * FROM plex_sessions'))return sessionRows[args[0]]||null;return null}}}}};
const tokenEncrypted=await mod.encrypt(env,'test-only-plex-account-token');
const sid1='a'.repeat(64),sid2='b'.repeat(64);
sessionRows={[await mod.hash(sid1)]:{token_encrypted:tokenEncrypted,plex_user_id:'fixture-user-1'},[await mod.hash(sid2)]:{token_encrypted:tokenEncrypted,plex_user_id:'fixture-user-2'}};
const exp=String(Math.floor(Date.now()/1000)+3600);
const gate='mh_gate='+exp+'.'+await mod.gateSign(env.GATE_SESSION_SECRET+':default',exp);
const cookieFor=sid=>[gate,'mh_session='+sid].join('; ');
// The route must stay inside the Plex cookie path, like every /api/plex/* route.
assert.equal(/Path=([^;]+)/.exec(mod.setCookie(sid1,3600))[1],'/api/plex');
const META={'101':{ratingKey:'101',key:'/library/metadata/101',title:'Fixture Movie',type:'movie',year:2024,thumb:'/library/media/101/thumb'},'555':{ratingKey:'555',key:'/library/metadata/555',title:'The Fixture Episode',type:'episode',thumb:'/library/media/555/thumb',grandparentTitle:'Fixture Series',grandparentThumb:'/library/media/101/showthumb',parentTitle:'Season 1'}};
const oldFetch=globalThis.fetch;globalThis.fetch=async url=>{const u=new URL(url);
 if(u.hostname==='plex.tv')return Response.json([{name:'Fixture Library',provides:'server',accessToken:'test-only-server-token',clientIdentifier:'fixture-machine',connections:[{uri:'https://fixture-plex.example'}]}]);
 if(u.hostname==='fixture-plex.example'){const m=/^\/library\/metadata\/(\d+)$/.exec(u.pathname);if(m&&META[m[1]])return Response.json({MediaContainer:{Metadata:[META[m[1]]]}});return Response.json({MediaContainer:{Metadata:[]}});}
 throw Error('Unexpected fixture request '+u.hostname+u.pathname)};
async function call(method,path,{sid,body}={}){const req=new Request('https://example.com'+path,{method,headers:{cookie:sid?cookieFor(sid):gate,origin:'https://example.com','content-type':'application/json'},body:body?JSON.stringify(body):undefined});const r=await mod.default.fetch(req,env);return{status:r.status,body:await r.json().catch(()=>({}))}}
try{
 let r=await call('GET','/api/plex/my-list');assert.equal(r.status,401);console.log('PASS signed-out GET rejected');
 r=await call('POST','/api/plex/my-list',{body:{action:'add',machine:'fixture-machine',ratingKey:'101'}});assert.equal(r.status,401);console.log('PASS signed-out add rejected');
 r=await call('POST','/api/plex/my-list',{sid:sid1,body:{action:'add',machine:'fixture-machine',ratingKey:'../101'}});assert.equal(r.status,400);assert.equal(rows.size,0);console.log('PASS malformed ratingKey rejected, nothing stored');
 r=await call('POST','/api/plex/my-list',{sid:sid1,body:{action:'add',machine:'unavailable-server',ratingKey:'101'}});assert.equal(r.status,403);assert.equal(rows.size,0);console.log('PASS server not accessible to the account rejected');
 r=await call('POST','/api/plex/my-list',{sid:sid1,body:{action:'add',machine:'fixture-machine',ratingKey:'101',title:'CLIENT-SENT LIE',thumb:'/lie'}});assert.equal(r.status,200);assert.equal(r.body.saved,true);
 assert.equal(r.body.item.title,'Fixture Movie');assert.equal(r.body.item.thumb,'/library/media/101/thumb');assert(!JSON.stringify(r.body).includes('test-only'));console.log('PASS add stores Plex-verified metadata, not client-supplied fields');
 r=await call('POST','/api/plex/my-list',{sid:sid1,body:{action:'add',machine:'fixture-machine',ratingKey:'101'}});assert.equal(r.status,200);assert.equal(rows.size,1);console.log('PASS re-adding the same title is an idempotent upsert');
 r=await call('POST','/api/plex/my-list',{sid:sid1,body:{action:'add',machine:'fixture-machine',ratingKey:'555'}});assert.equal(r.status,200);
 assert.equal(r.body.item.thumb,'/library/media/101/showthumb');assert.equal(r.body.item.subtitle,'Fixture Series');console.log('PASS episode bookmark keeps the show poster and series subtitle');
 r=await call('GET','/api/plex/my-list',{sid:sid1});assert.equal(r.status,200);assert.equal(r.body.items.length,2);console.log('PASS owner reads back both saved titles');
 r=await call('GET','/api/plex/my-list',{sid:sid2});assert.equal(r.status,200);assert.equal(r.body.items.length,0);console.log('PASS a second Plex account sees an empty list (per-member isolation)');
 r=await call('POST','/api/plex/my-list',{sid:sid1,body:{action:'bogus',machine:'fixture-machine',ratingKey:'101'}});assert.equal(r.status,400);console.log('PASS unknown action rejected');
 r=await call('POST','/api/plex/my-list',{sid:sid1,body:{action:'remove',machine:'fixture-machine',ratingKey:'101'}});assert.equal(r.status,200);assert.equal(r.body.saved,false);
 r=await call('GET','/api/plex/my-list',{sid:sid1});assert.equal(r.body.items.length,1);assert.equal(r.body.items[0].ratingKey,'555');console.log('PASS remove deletes only the chosen title');
 r=await call('POST','/api/plex/my-list',{sid:sid1,body:{action:'remove',machine:'fixture-machine',ratingKey:'101'}});assert.equal(r.status,200);console.log('PASS removing an absent title stays successful');
 console.log('ALL MY LIST TESTS PASSED');
}finally{globalThis.fetch=oldFetch}
