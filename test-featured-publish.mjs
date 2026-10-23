import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(src+'\nexport {encrypt,gateSign,adminDigest,hash,setCookie};').toString('base64'));
let stored=null,tokenEncrypted,sessionHash;
const env={GATE_SESSION_SECRET:'test-only-community-secret-at-least-32chars',ADMIN_PASSWORD:'test-only-admin-password',PLEX_SESSION_SECRET:'test-only-plex-secret-at-least-32characters',DB:{prepare(sql){let args=[];return{bind(...a){args=a;return this},async run(){if(sql.startsWith('INSERT INTO mh_featured'))stored=args[0];if(sql.startsWith('UPDATE mh_featured'))stored=args[0];return{success:true}},async all(){return{results:[]}},async first(){if(sql.startsWith('SELECT * FROM plex_sessions'))return args[0]===sessionHash?{token_encrypted:tokenEncrypted,plex_user_id:'fixture-admin'}:null;if(sql.includes('FROM mh_featured'))return stored?{payload:stored}:null;return null}}}}};
const sessionId='a'.repeat(64);sessionHash=await mod.hash(sessionId);tokenEncrypted=await mod.encrypt(env,'test-only-plex-account-token');
const exp=String(Math.floor(Date.now()/1000)+3600),nonce='fixtureNonce01234567890123456789',expires=Date.now()+3600000;
const gate='mh_gate='+exp+'.'+await mod.gateSign(env.GATE_SESSION_SECRET+':default',exp);
const admin='mh_admin='+expires+'_'+nonce+'_'+await mod.adminDigest(env.ADMIN_PASSWORD+':'+expires+':'+nonce);
const cookiePath=/Path=([^;]+)/.exec(mod.setCookie(sessionId,3600))[1];assert.equal(cookiePath,'/api/plex');
const scopedCookie=(path,{withAdmin=true,withPlex=true}={})=>[gate,...(withAdmin?[admin]:[]),...(withPlex&&(path===cookiePath||path.startsWith(cookiePath+'/'))?['mh_session='+sessionId]:[])].join('; ');
const oldFetch=globalThis.fetch;globalThis.fetch=async url=>{const u=new URL(url);if(u.hostname==='plex.tv')return Response.json([{name:'Fixture Library',provides:'server',accessToken:'test-only-server-token',clientIdentifier:'fixture-machine',connections:[{uri:'https://fixture-plex.example'}]}]);if(u.hostname==='fixture-plex.example'&&u.pathname==='/library/metadata/101')return Response.json({MediaContainer:{Metadata:[{ratingKey:'101',title:'Fixture Series',year:2025,type:'show',summary:'Fixture-only show',thumb:''}]}});throw Error('Unexpected fixture request '+u.pathname)};
async function call(path,body,{withAdmin=true,withPlex=true,origin='https://example.com'}={}){const req=new Request('https://example.com'+path,{method:'POST',headers:{cookie:scopedCookie(path,{withAdmin,withPlex}),origin,'content-type':'application/json'},body:JSON.stringify(body)});const r=await mod.default.fetch(req,env);return {status:r.status,body:await r.json()}}
try{
 const body={action:'publish',machine:'fixture-machine',ratingKey:'101',note:'A recommendation'};
 let r=await call('/api/admin/featured',body);assert.equal(r.status,401);console.log('PASS reproduced original cookie-path failure on /api/admin/featured');
 r=await call('/api/plex/featured',body,{withAdmin:false});assert.equal(r.status,403);
 r=await call('/api/plex/featured',body,{withPlex:false});assert.equal(r.status,401);
 r=await call('/api/plex/featured',body,{origin:'https://other.example'});assert.equal(r.status,403);
 assert.equal(stored,null);console.log('PASS admin, Plex session and same-origin enforcement; denied writes leave storage untouched');
 r=await call('/api/plex/featured',{...body,machine:'unavailable-server'});assert.equal(r.status,403);assert.equal(stored,null);
 r=await call('/api/plex/featured',{...body,ratingKey:'../101'});assert.equal(r.status,400);assert.equal(stored,null);
 r=await call('/api/plex/featured',body);assert.equal(r.status,200);const saved=JSON.parse(stored);assert.equal(saved.title,'Fixture Series');assert.equal(saved.note,'A recommendation');assert.equal(saved.enabled,true);assert(saved.tokenEncrypted);assert(!stored.includes('test-only-server-token'));
 const read=await mod.default.fetch(new Request('https://example.com/api/featured',{headers:{cookie:gate}}),env),publicData=await read.json();assert.equal(publicData.featured.title,'Fixture Series');assert.equal(publicData.featured.note,'A recommendation');assert(!JSON.stringify(publicData).includes('tokenEncrypted'));assert(!JSON.stringify(publicData).includes('test-only'));
 console.log('PASS publish, mocked Plex verification, encrypted token persistence and safe public dashboard read');
 r=await call('/api/admin/featured',{action:'toggle',enabled:false});assert.equal(r.status,200);assert.equal(JSON.parse(stored).enabled,false);console.log('PASS existing admin hide action remains functional');
}finally{globalThis.fetch=oldFetch}
