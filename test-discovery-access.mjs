import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(src+'\nexport {gateSign,adminDigest};').toString('base64'));
const env={ADMIN_PASSWORD:'test-only-administrator-password',GATE_SESSION_SECRET:'test-only-community-session-secret-32chars',DB:{prepare(){return{async run(){return {success:true}},async all(){return {results:[]}}}}}};
const expiry=String(Math.floor(Date.now()/1000)+3600);
const gate='mh_gate='+expiry+'.'+await mod.gateSign(env.GATE_SESSION_SECRET+':default',expiry);
async function adminCookie(expires){const nonce='testnonce01234567890123456789';return 'mh_admin='+expires+'_'+nonce+'_'+await mod.adminDigest(env.ADMIN_PASSWORD+':'+expires+':'+nonce)}
const admin=await adminCookie(Date.now()+3600000),expired=await adminCookie(Date.now()-1000);
for(const path of ['/media-discovery','/media-discovery.js']){
 for(const [role,cookie,status] of [['anonymous','',401],['member',gate,403],['expired admin',gate+'; '+expired,403],['tampered admin',gate+'; '+admin.slice(0,-1)+'x',403],['valid admin',gate+'; '+admin,200]]){
  const r=await mod.default.fetch(new Request('https://example.com'+path,{headers:{cookie}}),env);
  assert.equal(r.status,status,path+' '+role);assert.equal(r.headers.get('cache-control'),'no-store');
  const body=await r.text();if(status===200)assert(body.includes(path.endsWith('.js')?'const $=':'Discover something new.'));else assert(!body.includes('Find metadata'));
  console.log('PASS',path,role,status);
 }
}
for(const path of ['/','/app.js','/styles.css']){
 const r=await mod.default.fetch(new Request('https://example.com'+path,{headers:{cookie:gate}}),env);assert.equal(r.status,200,'Member dashboard asset '+path);
}
console.log('PASS normal member dashboard and assets remain available');
