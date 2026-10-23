import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(src+'\nexport {gateSign,adminDigest};').toString('base64'));
const rows=new Map();
function stmt(sql){let args=[];return{bind(...a){args=a;return this},
 async run(){
  if(sql.startsWith('INSERT INTO mh_announcements'))rows.set(args[0],{id:args[0],title:args[1],body:args[2],pinned:args[3],banner:args[4],expires_at:args[5],created_at:args[6]});
  else if(sql.startsWith('DELETE FROM mh_announcements'))rows.delete(args[0]);
  return{success:true}},
 async all(){const now=args[0];return{results:[...rows.values()].filter(r=>!r.expires_at||r.expires_at>now).map(r=>({id:r.id,title:r.title,body:r.body,pinned:r.pinned,banner:r.banner,expiresAt:r.expires_at,createdAt:r.created_at}))}},
 async first(){return null}}}
const env={GATE_SESSION_SECRET:'test-only-community-secret-at-least-32chars',ADMIN_PASSWORD:'test-only-admin-password',DB:{prepare:stmt}};
const exp=String(Math.floor(Date.now()/1000)+3600),expires=Date.now()+3600000,nonce='fixtureNonce01234567890123456789';
const gate='mh_gate='+exp+'.'+await mod.gateSign(env.GATE_SESSION_SECRET+':default',exp);
const admin='mh_admin='+expires+'_'+nonce+'_'+await mod.adminDigest(env.ADMIN_PASSWORD+':'+expires+':'+nonce);
async function call(method,body,cookie=gate){const r=await mod.default.fetch(new Request('https://example.com/api/announcements',{method,headers:{cookie,'content-type':'application/json',origin:'https://example.com'},body:body?JSON.stringify(body):undefined}),env);return{status:r.status,body:await r.json().catch(()=>({}))}}
let r=await call('POST',{title:'Nope',body:'Nope'});assert.equal(r.status,403);console.log('PASS announcement publish requires admin');
const future=new Date(Date.now()+2*3600000).toISOString(),past=new Date(Date.now()-3600000).toISOString();
r=await call('POST',{title:'Scheduled downtime',body:'The Tavern will be offline for server maintenance.',banner:true,expiresAt:future},[gate,admin].join('; '));assert.equal(r.status,200);
r=await call('GET');let a=r.body.announcements.find(x=>x.title==='Scheduled downtime');assert(a);assert.equal(a.banner,1);assert.equal(a.expiresAt,future);console.log('PASS banner announcement is stored with its flag and expiry');
r=await call('POST',{title:'Old maintenance',body:'Already over.',banner:true,expiresAt:past},[gate,admin].join('; '));assert.equal(r.status,200);
r=await call('GET');assert(!r.body.announcements.some(x=>x.title==='Old maintenance'));console.log('PASS an expired banner disappears from the feed automatically');
r=await call('POST',{title:'Welcome',body:'Hello members.'},[gate,admin].join('; '));assert.equal(r.status,200);
r=await call('GET');a=r.body.announcements.find(x=>x.title==='Welcome');assert.equal(a.banner,0);console.log('PASS ordinary announcements default to no banner');
r=await call('POST',{title:'Bad expiry',body:'x',expiresAt:'not-a-date'},[gate,admin].join('; '));assert.equal(r.status,400);console.log('PASS invalid expiry is rejected');
console.log('ALL ANNOUNCEMENT BANNER TESTS PASSED');
