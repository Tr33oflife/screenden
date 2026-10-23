import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';
const sqlite=new DatabaseSync(':memory:');
const db={prepare(sql){let a=[];return{bind(...x){a=x;return this},async run(){sqlite.prepare(sql).run(...a);return{success:true}},async all(){return{results:sqlite.prepare(sql).all(...a)}},async first(){return sqlite.prepare(sql).get(...a)||null}}},async batch(s){const r=[];for(const x of s)r.push(await x.run());return r}};
const src=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(src+'\nexport {gateSign,adminDigest};').toString('base64'));
const env={DB:db,GATE_SESSION_SECRET:'test-gate-secret-at-least-32-characters',ADMIN_PASSWORD:'test-admin-password',METADATA_ENCRYPTION_KEY:'test-metadata-key'};
const exp=String(Math.floor(Date.now()/1000)+3600);const gate='mh_gate='+exp+'.'+await mod.gateSign(env.GATE_SESSION_SECRET+':default',exp);
const aexp=Date.now()+3600000,nonce='fixtureNonce01234567890123456789';const admin='mh_admin='+aexp+'_'+nonce+'_'+await mod.adminDigest(env.ADMIN_PASSWORD+':'+aexp+':'+nonce);
let steamHits=0;
globalThis.fetch=async(url)=>{url=String(url);steamHits++;
 if(url.includes('appdetails')&&url.includes('1245620'))return Response.json({'1245620':{success:true,data:{name:'ELDEN RING',short_description:'A fantasy action RPG.',header_image:'https://cdn.example/header.jpg',release_date:{date:'Feb 25, 2022'}}}});
 if(url.includes('appdetails')&&url.includes('413150'))return Response.json({'413150':{success:true,data:{name:'Stardew Valley',short_description:'Farming RPG.',header_image:'https://cdn.example/sv.jpg',release_date:{date:'Feb 26, 2016'}}}});
 throw Error('unexpected fetch '+url);};
async function call(path,method='GET',body=null,cookie=gate){const r=await mod.default.fetch(new Request('https://example.com'+path,{method,headers:{cookie,...(body?{'content-type':'application/json',origin:'https://example.com'}:{})},body:body?JSON.stringify(body):undefined}),env);return{status:r.status,body:await r.json().catch(()=>({}))}}
const both=[gate,admin].join('; ');let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('ok -',m)};
// Game of the Week: admin gate, validation, publish, visibility, clear.
let r=await call('/api/admin/games/featured','POST',{action:'publish',providerId:'1245620',link:''},gate);ok(r.status===403,'featured publish without admin is refused');
r=await call('/api/admin/games/featured','POST',{action:'publish',providerId:'1245620',link:'ftp://nope'},both);ok(r.status===400,'non-http link is rejected');
r=await call('/api/admin/games/featured','POST',{action:'publish',providerId:'abc',link:''},both);ok(r.status===400,'non-numeric Steam id is rejected');
r=await call('/api/games/featured');ok(r.body.featured===null,'no featured game before publish');
r=await call('/api/admin/games/featured','POST',{action:'publish',providerId:'1245620',link:'https://example.com/get-elden',note:'Play this one.'},both);ok(r.status===200&&r.body.featured.title==='ELDEN RING','featured publish returns the Steam-verified title');
r=await call('/api/games/featured');ok(r.body.featured?.link==='https://example.com/get-elden'&&r.body.featured?.steamUrl==='https://store.steampowered.com/app/1245620/'&&r.body.featured?.note==='Play this one.','public featured carries the custom link, Steam link and note');
r=await call('/api/admin/games/featured','POST',{action:'toggle',enabled:false},both);r=await call('/api/games/featured');ok(r.body.featured===null,'hidden featured game is not public');
r=await call('/api/admin/games/featured','GET',null,both);ok(r.body.featured?.title==='ELDEN RING'&&r.body.featured.enabled===false,'admin still sees the hidden featured game');
r=await call('/api/admin/games/featured','POST',{action:'toggle',enabled:true},both);r=await call('/api/games/featured');ok(!!r.body.featured,'re-shown featured game is public again');
// New Games picks: add with/without link, list, remove, validation.
r=await call('/api/admin/games/picks','POST',{action:'add',providerId:'1245620',link:'https://example.com/elden'},both);ok(r.status===200&&r.body.item.title==='ELDEN RING','pick add returns the Steam-verified game');
r=await call('/api/admin/games/picks','POST',{action:'add',providerId:'413150',link:''},both);ok(r.body.item.link==='https://store.steampowered.com/app/413150/','pick without a link falls back to the Steam page');
r=await call('/api/admin/games/picks','POST',{action:'add',providerId:'413150',link:'javascript:alert(1)'},both);ok(r.status===400,'javascript: link is rejected');
r=await call('/api/games/picks');ok(r.body.items.length===2&&r.body.items[0].title==='Stardew Valley','picks list is newest-first with both games');
r=await call('/api/admin/games/picks','POST',{action:'remove',id:'steam:1245620'},both);r=await call('/api/games/picks');ok(r.body.items.length===1&&r.body.items[0].title==='Stardew Valley','pick remove leaves the other game');
r=await call('/api/admin/games/featured','POST',{action:'clear'},both);r=await call('/api/admin/games/featured','GET',null,both);ok(r.body.featured===null,'featured clear empties the store');
ok(steamHits>=3,'Steam details were fetched server-side ('+steamHits+' calls)');
console.log(passed+' game widget assertions passed');
