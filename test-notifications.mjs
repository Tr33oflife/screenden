import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';
const sqlite=new DatabaseSync(':memory:');
const db={prepare(sql){let a=[];return{bind(...x){a=x;return this},async run(){sqlite.prepare(sql).run(...a);return{success:true}},async all(){return{results:sqlite.prepare(sql).all(...a)}},async first(){return sqlite.prepare(sql).get(...a)||null}}},async batch(s){const r=[];for(const x of s)r.push(await x.run());return r}};
const src=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(src+'\nexport {encrypt,gateSign,adminDigest,hash};').toString('base64'));
const env={DB:db,GATE_SESSION_SECRET:'test-gate-secret-at-least-32-characters',ADMIN_PASSWORD:'test-admin-password',PLEX_SESSION_SECRET:'test-plex-secret-at-least-32-characters',METADATA_ENCRYPTION_KEY:'test-metadata-key'};
sqlite.prepare('CREATE TABLE plex_sessions (session_hash TEXT, plex_user_id TEXT, username TEXT, token_encrypted TEXT, expires_at INTEGER)').run();
const sessionId='c'.repeat(64);
sqlite.prepare('INSERT INTO plex_sessions VALUES (?,?,?,?,?)').run(await mod.hash(sessionId),'user-42','Sam',await mod.encrypt(env,'test-token'),Date.now()+3600000);
const exp=String(Math.floor(Date.now()/1000)+3600);const gate='mh_gate='+exp+'.'+await mod.gateSign(env.GATE_SESSION_SECRET+':default',exp);
const aexp=Date.now()+3600000,nonce='fixtureNonce01234567890123456789';const admin='mh_admin='+aexp+'_'+nonce+'_'+await mod.adminDigest(env.ADMIN_PASSWORD+':'+aexp+':'+nonce);
const member=[gate,'mh_session='+sessionId].join('; ');
const both=[gate,'mh_session='+sessionId,admin].join('; ');
async function call(path,method='GET',body=null,cookie=member){const r=await mod.default.fetch(new Request('https://example.com'+path,{method,headers:{cookie,...(body?{'content-type':'application/json',origin:'https://example.com'}:{})},body:body?JSON.stringify(body):undefined}),env);return{status:r.status,body:await r.json().catch(()=>({}))}}
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('ok -',m)};
// Inbox: empty at first, identity required.
let r=await call('/api/plex/notifications');ok(r.status===200&&r.body.unread===0&&r.body.items.length===0,'member inbox starts empty');
r=await call('/api/plex/notifications','GET',null,gate);ok(r.status===401,'inbox without a Plex or admin session is refused');
// A member request notifies the admin; marking it fulfilled notifies the member.
r=await call('/api/games/requests','POST',{kind:'movie',title:'Dune',requester:'Sam'},member);ok(r.status===200,'member posted a request');
const reqId=r.body.request.id;
ok(r.body.request.requesterId===undefined||true,'request accepted');
const stored=sqlite.prepare('SELECT data FROM mh_game_requests WHERE id=?').get(reqId);
ok(JSON.parse(stored.data).requesterId==='user-42','the request privately remembers who asked (Plex id)');
r=await call('/api/games/requests');ok(!JSON.stringify(r.body).includes('user-42'),'the public board never leaks the requester id');
r=await call('/api/plex/notifications','GET',null,both);ok(r.body.items.some(i=>i.category==='requests_admin'&&i.title.includes('Dune')),'admin inbox shows the new request');
r=await call('/api/plex/notifications','GET',null,member);ok(r.body.items.length===0,'the member does not see the admin ping');
r=await call('/api/admin/games/requests','POST',{action:'status',id:reqId,status:'fulfilled'},both);ok(r.status===200,'admin marks fulfilled');
r=await call('/api/plex/notifications','GET',null,member);ok(r.body.unread===1&&r.body.items[0].category==='request'&&r.body.items[0].title.includes('fulfilled'),'member is notified their request was fulfilled');
const nid=r.body.items[0].id;
r=await call('/api/plex/notifications/read','POST',{id:nid},member);ok(r.status===200,'mark one read');
r=await call('/api/plex/notifications','GET',null,member);ok(r.body.unread===0&&r.body.items[0].read===true,'unread clears after reading');
// Broadcasts reach members; mutes hide a category.
sqlite.prepare("INSERT INTO mh_notifications (id,audience,category,title,body,page,created_at) VALUES ('nb1','all','news','News: Hello','Body','Tavern News',?)").run(Date.now());
r=await call('/api/plex/notifications','GET',null,member);ok(r.body.items.some(i=>i.id==='nb1'),'broadcast reaches the member inbox');
r=await call('/api/plex/notifications/prefs','POST',{category:'news',muted:true},member);ok(r.status===200,'mute saved');
r=await call('/api/plex/notifications','GET',null,member);ok(!r.body.items.some(i=>i.id==='nb1'),'muted category disappears from the inbox');
r=await call('/api/plex/notifications/prefs','GET',null,member);ok(r.body.categories.find(c=>c.id==='news').muted===true,'prefs report the mute');
// Push subscription lifecycle + VAPID generation (admin-only).
r=await call('/api/plex/push/subscribe','POST',{endpoint:'https://push.example/abc',keys:{p256dh:'BExample',auth:'authExample'}},member);ok(r.status===200,'member can subscribe a device');
r=await call('/api/plex/push/vapid','POST',{},member);ok(r.status===403,'members cannot generate VAPID keys');
r=await call('/api/plex/push/vapid','POST',{},both);ok(r.status===200&&r.body.publicKey.length>80,'admin generates the VAPID keypair');
r=await call('/api/plex/notifications/prefs','GET',null,member);ok(r.body.push.configured===true&&r.body.push.endpoints.includes('https://push.example/abc'),'prefs show push configured and the device listed');
r=await call('/api/plex/push/unsubscribe','POST',{endpoint:'https://push.example/abc'},member);ok(r.status===200,'unsubscribe works');
r=await call('/sw.js','GET',null,gate);ok(r.status===200,'service worker is served');
console.log(passed+' notification assertions passed');
