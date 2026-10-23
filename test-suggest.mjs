import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';
const sqlite=new DatabaseSync(':memory:');
const db={prepare(sql){let a=[];return{bind(...x){a=x;return this},async run(){sqlite.prepare(sql).run(...a);return{success:true}},async all(){return{results:sqlite.prepare(sql).all(...a)}},async first(){return sqlite.prepare(sql).get(...a)||null}}},async batch(s){const r=[];for(const x of s)r.push(await x.run());return r}};
const src=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(src+'\nexport {gateSign,adminDigest};').toString('base64'));
const env={DB:db,GATE_SESSION_SECRET:'test-gate-secret-at-least-32-characters',ADMIN_PASSWORD:'test-admin-password',METADATA_ENCRYPTION_KEY:'test-metadata-key'};
const exp=String(Math.floor(Date.now()/1000)+3600);const gate='mh_gate='+exp+'.'+await mod.gateSign(env.GATE_SESSION_SECRET+':default',exp);
const aexp=Date.now()+3600000,nonce='fixtureNonce01234567890123456789';const admin='mh_admin='+aexp+'_'+nonce+'_'+await mod.adminDigest(env.ADMIN_PASSWORD+':'+aexp+':'+nonce);
let imdbMode='ok';
globalThis.fetch=async(url)=>{url=String(url);
 if(url.includes('sg.media-imdb.com')){ if(imdbMode==='fail')return new Response('nope',{status:503});
  return Response.json({d:[
   {id:'tt1160419',l:'Dune',q:'feature',qid:'movie',y:2021,i:{imageUrl:'https://m.media-amazon.com/dune.jpg'}},
   {id:'tt15239678',l:'Dune: Part Two',q:'feature',qid:'movie',y:2024},
   {id:'tt0944947',l:'Game of Thrones',q:'TV series',qid:'tvSeries',y:2011,i:{imageUrl:'https://m.media-amazon.com/got.jpg'}},
   {id:'tt0087182',l:'Dune (miniseries)',q:'TV mini-series',qid:'tvMiniSeries',y:2000},
   {id:'tt9999999',l:'Dune Imperium (game)',q:'video game',qid:'videoGame',y:2023},
   {id:'nm0000206',l:'A Person Named Dune',q:'',qid:''},
  ]});}
 throw Error('unexpected fetch '+url);};
async function call(path,method='GET',body=null,cookie=gate){const r=await mod.default.fetch(new Request('https://example.com'+path,{method,headers:{cookie,...(body?{'content-type':'application/json',origin:'https://example.com'}:{})},body:body?JSON.stringify(body):undefined}),env);return{status:r.status,body:await r.json().catch(()=>({}))}}
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('ok -',m)};
let r=await call('/api/requests/suggest?kind=movie&q=du');
ok(r.status===200&&r.body.items.length===2&&r.body.items.every(i=>i.type==='movie'),'movie suggestions keep features only');
ok(r.body.items[0].imdbId==='tt1160419'&&r.body.items[0].year==='2021'&&r.body.items[0].image.includes('dune.jpg'),'suggestion carries imdb id, year and poster');
r=await call('/api/requests/suggest?kind=show&q=du');
ok(r.body.items.length===2&&r.body.items.map(i=>i.title).join('|').includes('Game of Thrones'),'show suggestions keep series and miniseries only');
r=await call('/api/requests/suggest?kind=game&q=du');ok(r.status===400,'game kind is refused (IMDb suggestions are movie/TV only)');
r=await call('/api/requests/suggest?kind=movie&q=d');ok(r.status===200&&r.body.items.length===0,'one-character query returns an empty list');
imdbMode='fail';r=await call('/api/requests/suggest?kind=movie&q=dune');ok(r.status===200&&r.body.items.length===0,'an IMDb outage degrades to an empty list, not an error');
imdbMode='ok';
r=await call('/api/games/requests','POST',{kind:'movie',title:'Dune',requester:'Sam',year:'2021',imdbId:'tt1160419'});
ok(r.status===200&&r.body.request.year==='2021'&&r.body.request.imdbId==='tt1160419','a picked suggestion stores year and imdb id');
r=await call('/api/games/requests','POST',{kind:'movie',title:'Fake',requester:'Sam',year:'20x1',imdbId:'bogus'});
ok(r.status===200&&!('year' in r.body.request)&&!('imdbId' in r.body.request),'junk year and imdb id are dropped, not stored');
console.log(passed+' suggestion assertions passed');
