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
 if(url.includes('appdetails')&&url.includes('413150'))return Response.json({'413150':{success:true,data:{name:'Stardew Valley',short_description:'Farming.',header_image:'https://cdn.example/sv.jpg',release_date:{date:'Feb 26, 2016'}}}});
 throw Error('unexpected fetch '+url);};
async function call(path,method='GET',body=null,cookie=gate){const r=await mod.default.fetch(new Request('https://example.com'+path,{method,headers:{cookie,...(body?{'content-type':'application/json',origin:'https://example.com'}:{})},body:body?JSON.stringify(body):undefined}),env);return{status:r.status,body:await r.json().catch(()=>({}))}}
const both=[gate,admin].join('; ');let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('ok -',m)};
// Curated Coming Soon: gate, validation, add, visibility toggle, link edit, remove.
let r=await call('/api/admin/games/coming-soon','POST',{action:'add',providerId:'1245620'},gate);ok(r.status===403,'coming-soon add without admin is refused');
r=await call('/api/games/coming-soon');ok(r.body.enabled===true&&r.body.items.length===0,'coming soon starts enabled and empty');
r=await call('/api/admin/games/coming-soon','POST',{action:'add',providerId:'abc'},both);ok(r.status===400,'non-numeric Steam id is rejected');
r=await call('/api/admin/games/coming-soon','POST',{action:'add',providerId:'1245620'},both);ok(r.status===200&&r.body.item.title==='ELDEN RING'&&r.body.item.link==='https://store.steampowered.com/app/1245620/','curated add stores the Steam-verified game with the Steam link');
r=await call('/api/games/coming-soon');ok(r.body.items.length===1&&r.body.items[0].title==='ELDEN RING','public list shows the curated game');
r=await call('/api/admin/games/coming-soon','POST',{action:'link',id:'steam:1245620',link:'https://example.com/wishlist'},both);ok(r.status===200&&r.body.item.link==='https://example.com/wishlist','coming soon link can be set externally');
r=await call('/api/admin/games/coming-soon','POST',{action:'link',id:'steam:1245620',link:'notaurl'},both);ok(r.status===400,'invalid link is rejected');
r=await call('/api/admin/games/coming-soon','POST',{action:'link',id:'steam:1245620',link:''},both);ok(r.body.item.link==='https://store.steampowered.com/app/1245620/','clearing the link falls back to the Steam page');
r=await call('/api/admin/games/coming-soon','POST',{action:'toggle',enabled:false},both);r=await call('/api/games/coming-soon');ok(r.body.enabled===false&&r.body.items.length===0,'hidden section serves no items publicly');
r=await call('/api/admin/games/coming-soon','GET',null,both);ok(r.body.enabled===false&&r.body.items.length===1,'admin still sees the curated list while hidden');
r=await call('/api/admin/games/coming-soon','POST',{action:'toggle',enabled:true},both);r=await call('/api/games/coming-soon');ok(r.body.enabled===true&&r.body.items.length===1,'re-shown section serves its items again');
r=await call('/api/admin/games/coming-soon','POST',{action:'remove',id:'steam:1245620'},both);r=await call('/api/games/coming-soon');ok(r.body.items.length===0,'remove empties the list');
// New Games picks: per-item link editing.
r=await call('/api/admin/games/picks','POST',{action:'add',providerId:'413150',link:''},both);ok(r.status===200,'pick added for link editing');
r=await call('/api/admin/games/picks','POST',{action:'link',id:'steam:413150',link:'https://example.com/sv-download'},both);ok(r.status===200&&r.body.item.link==='https://example.com/sv-download','new games link can be changed after adding');
r=await call('/api/games/picks');ok(r.body.items[0].link==='https://example.com/sv-download','the rail serves the updated external link');
r=await call('/api/admin/games/picks','POST',{action:'link',id:'steam:999999',link:'https://example.com/x'},both);ok(r.status===404,'link edit on a missing game is a 404');
r=await call('/api/admin/games/picks','POST',{action:'link',id:'steam:413150',link:'javascript:alert(1)'},both);ok(r.status===400,'javascript: link is rejected on edit too');
console.log(passed+' coming soon + link assertions passed');
