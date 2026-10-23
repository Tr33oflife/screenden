import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';
const sqlite=new DatabaseSync(':memory:');
const db={prepare(sql){let a=[];return{bind(...x){a=x;return this},async run(){sqlite.prepare(sql).run(...a);return{success:true}},async all(){return{results:sqlite.prepare(sql).all(...a)}},async first(){return sqlite.prepare(sql).get(...a)||null}}},async batch(s){const r=[];for(const x of s)r.push(await x.run());return r}};
const src=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(src+'\nexport {gateSign,adminDigest};').toString('base64'));
const env={DB:db,GATE_SESSION_SECRET:'test-gate-secret-at-least-32-characters',ADMIN_PASSWORD:'test-admin-password',METADATA_ENCRYPTION_KEY:'test-metadata-key'};
const exp=String(Math.floor(Date.now()/1000)+3600);const gate='mh_gate='+exp+'.'+await mod.gateSign(env.GATE_SESSION_SECRET+':default',exp);
const aexp=Date.now()+3600000,nonce='fixtureNonce01234567890123456789';const admin='mh_admin='+aexp+'_'+nonce+'_'+await mod.adminDigest(env.ADMIN_PASSWORD+':'+aexp+':'+nonce);
globalThis.fetch=async(url)=>{url=String(url);
 if(url.includes('appdetails')&&url.includes('1245620'))return Response.json({'1245620':{success:true,data:{name:'ELDEN RING',short_description:'RPG.',header_image:'https://cdn.example/h.jpg',release_date:{date:'Feb 25, 2022'}}}});
 if(url.includes('storesearch'))return Response.json({total:1,items:[{id:1245620,name:'ELDEN RING',tiny_image:''}]});
 throw Error('unexpected fetch '+url);};
async function call(path,method='GET',body=null,cookie=gate,headers={}){const r=await mod.default.fetch(new Request('https://example.com'+path,{method,headers:{cookie,...headers,...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined}),env);return{status:r.status,body:await r.json().catch(()=>({}))}}
const both=[gate,admin].join('; ');let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('ok -',m)};
// Member posts a request; it lands on the board as pending.
let r=await call('/api/games/requests','POST',{title:'Elden Ring',requester:'Sam',note:'please'},gate,{origin:'https://example.com'});ok(r.status===200&&r.body.request.status==='pending','member request is created pending');
const reqId=r.body.request.id;
r=await call('/api/games/requests');ok(r.body.items.length===1&&r.body.items[0].title==='Elden Ring'&&r.body.items[0].requester==='Sam','board lists the request with its requester');
// Validation and origin guard.
r=await call('/api/games/requests','POST',{title:'x'},gate,{origin:'https://example.com'});ok(r.status===400,'one-character title is rejected');
r=await call('/api/games/requests','POST',{title:'Balatro'},gate,{origin:'https://evil.example'});ok(r.status===403,'cross-origin member post is refused');
r=await call('/api/games/requests','POST',{title:'  ',requester:''},gate,{origin:'https://example.com'});ok(r.status===400,'blank title is rejected');
r=await call('/api/games/requests','POST',{title:'Balatro'},gate,{origin:'https://example.com'});ok(r.status===200&&r.body.request.requester==='A member','missing requester becomes "A member"');
const req2=r.body.request.id;
// Status changes are admin-only.
r=await call('/api/admin/games/requests','POST',{action:'status',id:reqId,status:'denied'},gate,{origin:'https://example.com'});ok(r.status===403,'status change without admin is refused');
r=await call('/api/admin/games/requests','POST',{action:'status',id:reqId,status:'bogus'},both,{origin:'https://example.com'});ok(r.status===400,'unknown status is rejected');
r=await call('/api/admin/games/requests','POST',{action:'status',id:'gr_missing',status:'fulfilled'},both,{origin:'https://example.com'});ok(r.status===404,'unknown request id is a 404');
r=await call('/api/admin/games/requests','POST',{action:'status',id:reqId,status:'fulfilled'},both,{origin:'https://example.com'});ok(r.status===200,'admin marks the request fulfilled');
r=await call('/api/games/requests');ok(r.body.items.find(x=>x.id===reqId)?.status==='fulfilled','the board shows the fulfilled status to members');
r=await call('/api/admin/games/requests','POST',{action:'status',id:req2,status:'denied'},both,{origin:'https://example.com'});r=await call('/api/games/requests');ok(r.body.items.find(x=>x.id===req2)?.status==='denied','denied status is recorded');
r=await call('/api/admin/games/requests','POST',{action:'status',id:req2,status:'pending'},both,{origin:'https://example.com'});r=await call('/api/games/requests');ok(r.body.items.find(x=>x.id===req2)?.status==='pending','marking pending restores the request');
// Kinds (v3.6.21): movies and shows share the board; legacy rows read as games.
r=await call('/api/games/requests','POST',{kind:'movie',title:'Dune',requester:'Sam'},gate,{origin:'https://example.com'});ok(r.status===200&&r.body.request.kind==='movie','movie request stores its kind');
r=await call('/api/games/requests','POST',{kind:'show',title:'Severance'},gate,{origin:'https://example.com'});ok(r.status===200&&r.body.request.kind==='show','show request stores its kind');
r=await call('/api/games/requests','POST',{kind:'book',title:'Dune'},gate,{origin:'https://example.com'});ok(r.status===400,'unknown kind is rejected');
r=await call('/api/games/requests','POST',{kind:'program',title:'qBittorrent',requester:'Sam',note:'Windows'},gate,{origin:'https://example.com'});ok(r.status===200&&r.body.request.kind==='program','program request stores its kind');
await env.DB.prepare('INSERT INTO mh_game_requests(id,data,created_at) VALUES(?,?,?)').bind('gr_legacy',JSON.stringify({title:'Old Game',requester:'Jo',note:'',status:'pending'}),new Date().toISOString()).run();
r=await call('/api/games/requests');const legacy=r.body.items.find(x=>x.id==='gr_legacy');ok(legacy&&legacy.kind==='game','a pre-kinds row reads back as a game request');
const kinds=new Set(r.body.items.map(x=>x.kind));ok(kinds.has('movie')&&kinds.has('show')&&kinds.has('game')&&kinds.has('program'),'the board carries all four kinds together');
await db.prepare('INSERT INTO mh_game_requests (id,data,created_at) VALUES (?,?,?)').bind('gr_old1',JSON.stringify({kind:'game',title:'Legacy Added',requester:'A',note:'',status:'added'}),Date.now()).run();
await db.prepare('INSERT INTO mh_game_requests (id,data,created_at) VALUES (?,?,?)').bind('gr_old2',JSON.stringify({kind:'game',title:'Legacy Open',requester:'A',note:'',status:'open'}),Date.now()).run();
await db.prepare('INSERT INTO mh_game_requests (id,data,created_at) VALUES (?,?,?)').bind('gr_old3',JSON.stringify({kind:'movie',title:'Legacy Dismissed',requester:'A',note:'',status:'dismissed'}),Date.now()).run();
r=await call('/api/games/requests');const legacyMap=Object.fromEntries(r.body.items.map(x=>[x.id,x.status]));
ok(legacyMap.gr_old1==='fulfilled'&&legacyMap.gr_old2==='pending'&&legacyMap.gr_old3==='denied','legacy open/added/dismissed rows read back as pending/fulfilled/denied');
r=await call('/api/admin/games/requests','POST',{action:'delete',id:req2},gate,{origin:'https://example.com'});ok(r.status===403,'delete without admin is refused');
r=await call('/api/admin/games/requests','POST',{action:'delete',id:'gr_missing'},both,{origin:'https://example.com'});ok(r.status===404,'deleting a missing request is a 404');
r=await call('/api/admin/games/requests','POST',{action:'delete',id:req2},both,{origin:'https://example.com'});ok(r.status===200&&r.body.deleted===true,'admin deletes the request');
r=await call('/api/games/requests');ok(!r.body.items.some(x=>x.id===req2),'the deleted request is gone from the board');
console.log(passed+' game request assertions passed');
