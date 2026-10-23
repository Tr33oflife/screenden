import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';
const src=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(src+'\nexport {encrypt,gateSign,adminDigest,hash};').toString('base64'));
const ADMIN_HOOK='https://discord.com/api/webhooks/111111111111111111/ADMIN-SECRET-aaa';
const PUBLIC_HOOK='https://discord.com/api/webhooks/222222222222222222/PUBLIC-SECRET-bbb';
const posts=[];const hookStatus=new Map();
const realFetch=globalThis.fetch;
globalThis.fetch=async (url,opts={})=>{const u=String(url);if(u.startsWith('https://discord.com/api/webhooks/')){posts.push({url:u,body:JSON.parse(opts.body)});return new Response(null,{status:hookStatus.get(u)??204});}return realFetch(url,opts);};
async function makeWorld(){
 const sqlite=new DatabaseSync(':memory:');
 const db={prepare(sql){let a=[];return{bind(...x){a=x;return this},async run(){sqlite.prepare(sql).run(...a);return{success:true}},async all(){return{results:sqlite.prepare(sql).all(...a)}},async first(){return sqlite.prepare(sql).get(...a)||null}}},async batch(s){const r=[];for(const x of s)r.push(await x.run());return r}};
 const env={DB:db,GATE_SESSION_SECRET:'test-gate-secret-at-least-32-characters',ADMIN_PASSWORD:'test-admin-password',PLEX_SESSION_SECRET:'test-plex-secret-at-least-32-characters',METADATA_ENCRYPTION_KEY:'test-metadata-key'};
 sqlite.prepare('CREATE TABLE plex_sessions (session_hash TEXT, plex_user_id TEXT, username TEXT, token_encrypted TEXT, expires_at INTEGER)').run();
 const sessionId='e'.repeat(64);
 sqlite.prepare('INSERT INTO plex_sessions VALUES (?,?,?,?,?)').run(await mod.hash(sessionId),'user-42','Sam',await mod.encrypt(env,'test-token'),Date.now()+3600000);
 const exp=String(Math.floor(Date.now()/1000)+3600);const gate='mh_gate='+exp+'.'+await mod.gateSign(env.GATE_SESSION_SECRET+':default',exp);
 const aexp=Date.now()+3600000,nonce='fixtureNonce01234567890123456789';const admin='mh_admin='+aexp+'_'+nonce+'_'+await mod.adminDigest(env.ADMIN_PASSWORD+':'+aexp+':'+nonce);
 const member=[gate,'mh_session='+sessionId].join('; '),both=[gate,'mh_session='+sessionId,admin].join('; ');
 async function call(path,method='GET',body=null,cookie=member){const r=await mod.default.fetch(new Request('https://example.com'+path,{method,headers:{cookie,...(body?{'content-type':'application/json',origin:'https://example.com'}:{})},body:body?JSON.stringify(body):undefined}),env);return{status:r.status,body:await r.json().catch(()=>({}))}}
 return {sqlite,env,call,member,both};
}
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('ok -',m)};
const toAdmin=()=>posts.filter(p=>p.url===ADMIN_HOOK),toPublic=()=>posts.filter(p=>p.url===PUBLIC_HOOK);
const w=await makeWorld();
// Saving: admin-only, target required, URL validated.
let r=await w.call('/api/plex/push/discord','POST',{target:'admin',webhook:ADMIN_HOOK},w.member);ok(r.status===403,'members cannot save webhooks');
r=await w.call('/api/plex/push/discord','POST',{webhook:ADMIN_HOOK},w.both);ok(r.status===400,'a save without a target is refused');
r=await w.call('/api/plex/push/discord','POST',{target:'admin',webhook:'https://example.com/api/webhooks/1/abc'},w.both);ok(r.status===400,'a non-Discord URL is refused');
r=await w.call('/api/plex/push/discord','POST',{target:'admin',webhook:ADMIN_HOOK},w.both);ok(r.status===200&&r.body.configured,'admin webhook saved');
r=await w.call('/api/plex/push/discord','POST',{target:'public',webhook:PUBLIC_HOOK},w.both);ok(r.status===200&&r.body.configured,'public webhook saved');
// Defaults route admin categories to admin, household categories to public.
r=await w.call('/api/plex/notifications/prefs','GET',null,w.both);
ok(r.body.discord.admin.cats.join()===['requests_admin','reports','server'].join(),'admin defaults: requests, reports, server');
ok(r.body.discord.public.cats.join()===['request','featured','news','movie-night'].join(),'public defaults: outcomes, featured, news, movie night');
ok(!JSON.stringify(r.body).includes('ADMIN-SECRET')&&!JSON.stringify(r.body).includes('PUBLIC-SECRET'),'neither webhook token ever appears in API responses');
// A new request pings ONLY the admin channel.
r=await w.call('/api/games/requests','POST',{kind:'movie',title:'Dune',requester:'Sam'},w.member);const reqId=r.body.request.id;
ok(toAdmin().length===1&&toAdmin()[0].body.content.includes('Dune'),'new request went to the admin channel');
ok(toPublic().length===0,'new request did NOT go to the public channel');
// Fulfilling it tells ONLY the public channel.
r=await w.call('/api/admin/games/requests','POST',{action:'status',id:reqId,status:'fulfilled'},w.both);ok(r.status===200,'marked fulfilled');
ok(toPublic().length===1&&toPublic()[0].body.content.includes('fulfilled'),'the fulfilment went to the public channel');
ok(toAdmin().length===1,'the fulfilment did NOT go to the admin channel');
// Per-channel category overrides.
r=await w.call('/api/plex/push/discord','POST',{target:'admin',cats:['requests_admin','reports','server','featured']},w.both);ok(r.status===200,'admin categories extended');
posts.length=0;
r=await w.call('/api/plex/push/test','POST',{},w.both);ok(r.status===200,'push test fired (featured category)');
ok(toAdmin().length===1&&toPublic().length===1,'a category enabled on both channels posts to both');
// Per-target test messages and failure visibility.
posts.length=0;
r=await w.call('/api/plex/push/discord-test','POST',{target:'public'},w.both);ok(r.body.ok===true&&toPublic().length===1&&toAdmin().length===0,'public test posts only to the public channel');
hookStatus.set(PUBLIC_HOOK,404);
r=await w.call('/api/plex/push/discord-test','POST',{target:'public'},w.both);ok(r.body.ok===false&&r.body.status===404,'a dead public webhook reports its status');
r=await w.call('/api/plex/notifications/prefs','GET',null,w.both);ok(r.body.discord.public.lastStatus==='404','the public channel last status is recorded separately');
// Migration: the single v3.6.29 webhook becomes the public one.
const w2=await makeWorld();
w2.sqlite.prepare('CREATE TABLE IF NOT EXISTS mh_dashboard_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)').run();
w2.sqlite.prepare('INSERT INTO mh_dashboard_settings VALUES (?,?)').run('discordWebhook',PUBLIC_HOOK);
r=await w2.call('/api/plex/notifications/prefs','GET',null,w2.both);
ok(r.body.discord.public.configured===true&&r.body.discord.admin.configured===false,'a v3.6.29 webhook carries over as the public channel');
console.log(passed+' discord assertions passed');
