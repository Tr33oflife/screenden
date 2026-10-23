import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(src+'\nexport {gateSign,adminDigest};').toString('base64'));
function stmt(sql){let args=[];return{bind(...a){args=a;return this},async run(){return{success:true}},async all(){return{results:[]}},
 async first(){if(sql.includes('mh_meta_credentials'))return{n:0};if(sql.includes('SELECT 1'))return{x:1};return null}}}
const SENTINEL='test-only-resend-key-SENTINEL';
const env={GATE_SESSION_SECRET:'test-only-community-secret-at-least-32chars',ADMIN_PASSWORD:'test-only-admin-password',PLEX_SESSION_SECRET:'test-only-plex-secret-at-least-32characters',RESEND_API_KEY:SENTINEL,REPORT_FROM_EMAIL:'reports@example.com',REPORT_TO_EMAIL:'admin@example.com',NC_LAB_ENCRYPTION_KEY:'short',DB:{prepare:stmt}};
const exp=String(Math.floor(Date.now()/1000)+3600),expires=Date.now()+3600000,nonce='fixtureNonce01234567890123456789';
const gate='mh_gate='+exp+'.'+await mod.gateSign(env.GATE_SESSION_SECRET+':default',exp);
const admin='mh_admin='+expires+'_'+nonce+'_'+await mod.adminDigest(env.ADMIN_PASSWORD+':'+expires+':'+nonce);
const oldFetch=globalThis.fetch;globalThis.fetch=async url=>{const u=new URL(url);if(u.hostname==='plex.tv')return new Response('unauthorized',{status:401});throw Error('Unexpected fixture request '+u.hostname)};
try{
 let req=new Request('https://example.com/api/admin/diagnostics',{headers:{cookie:gate}});
 let r=await mod.default.fetch(req,env);assert.equal(r.status,403);console.log('PASS diagnostics requires admin sign-in');
 req=new Request('https://example.com/api/admin/diagnostics',{headers:{cookie:[gate,admin].join('; ')}});
 r=await mod.default.fetch(req,env);assert.equal(r.status,200);
 const text=await r.text();const d=JSON.parse(text);
 assert.equal(d.app.version,'1.0.0-rc.1');assert.equal(d.app.buildAgent,'ScreenDen contributors');console.log('PASS running version and build agent reported');
{const fe=readFileSync(new URL('./frontend.js',import.meta.url),'utf8');const m=fe.match(/const MEDIA_HUB_VERSION = 'v([^']+)'/);assert(m,'footer version const not found in frontend.js');assert.equal(m[1],d.app.version,'footer version (v'+m[1]+') must match the server version ('+d.app.version+')');console.log('PASS footer version matches the server version');}
 const byId=Object.fromEntries(d.checks.map(c=>[c.id,c.status]));
 assert.equal(byId.d1,'ok');assert.equal(byId.plex,'ok');assert.equal(byId.nextcloud,'unconfigured');assert.equal(byId.kuma,'unconfigured');assert.equal(byId.metadata,'unconfigured');assert.equal(byId.email,'ok');assert.equal(byId.encryption,'warn');
 console.log('PASS integration checks report ok / warn / unconfigured correctly');
 assert(!text.includes(SENTINEL));assert(!text.includes(env.ADMIN_PASSWORD));assert(!text.includes(env.GATE_SESSION_SECRET));console.log('PASS no secret values appear anywhere in the diagnostics response');
 assert(Array.isArray(d.recentReports));console.log('PASS recent reports list present');
 console.log('ALL DIAGNOSTICS TESTS PASSED');
}finally{globalThis.fetch=oldFetch}
