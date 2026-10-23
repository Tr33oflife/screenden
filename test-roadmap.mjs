import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';
const sqlite=new DatabaseSync(':memory:');
const db={prepare(sql){let a=[];return{bind(...x){a=x;return this},async run(){sqlite.prepare(sql).run(...a);return{success:true}},async all(){return{results:sqlite.prepare(sql).all(...a)}},async first(){return sqlite.prepare(sql).get(...a)||null}}},async batch(s){const r=[];for(const x of s)r.push(await x.run());return r}};

const src=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(src+'\nexport {gateSign,adminDigest};').toString('base64'));
const env={DB:db,GATE_SESSION_SECRET:'g'.repeat(40),ADMIN_PASSWORD:'a'.repeat(24),METADATA_ENCRYPTION_KEY:'m'.repeat(32)};
const exp=String(Math.floor(Date.now()/1000)+3600);const gate='mh_gate='+exp+'.'+await mod.gateSign(env.GATE_SESSION_SECRET+':default',exp);
const aexp=Date.now()+3600000,nonce='n'.repeat(32);const admin='mh_admin='+aexp+'_'+nonce+'_'+await mod.adminDigest(env.ADMIN_PASSWORD+':'+aexp+':'+nonce);
const both=[gate,admin].join('; ');
async function call(path,method='GET',body=null,cookie='',headers={}){const r=await mod.default.fetch(new Request('https://example.com'+path,{method,headers:{cookie,...headers,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);let j=null;try{j=await r.json();}catch{}return{status:r.status,body:j};}
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('ok -',m)};
let r=await call('/api/roadmap','GET',null,gate);
ok(r.status===200&&Array.isArray(r.body.items)&&r.body.items.length>=4,'the roadmap serves its seeded timeline');
ok(r.body.items[0].title==='ScreenDen release candidate'&&r.body.items[0].status==='progress','the in-progress item leads the timeline');
ok(r.body.items.some(x=>x.title==='Plex, files and community basics'&&x.status==='shipped'),'shipped basics are on the timeline');
ok(r.body.items.some(x=>x.title==='Setup guide and first public release'&&x.status==='planned'),'the first public release is listed as planned');
r=await call('/api/admin/roadmap','POST',{items:[{title:'Sneaky',status:'planned'}]},gate,{origin:'https://example.com'});
ok(r.status===403,'editing without admin is refused');
r=await call('/api/admin/roadmap','POST',{items:[{title:'x',status:'planned'}]},both,{origin:'https://example.com'});
ok(r.status===400,'a one-character title is rejected');
r=await call('/api/admin/roadmap','POST',{items:Array.from({length:81},(_,i)=>({title:'Item '+i}))},both,{origin:'https://example.com'});
ok(r.status===400,'more than 80 items is rejected');
r=await call('/api/admin/roadmap','POST',{items:[{title:'Custom future thing',date:'Someday',body:'Details here.',status:'bogus'}]},both,{origin:'https://example.com'});
ok(r.status===200&&r.body.items[0].status==='planned','an unknown status is normalized to planned');
r=await call('/api/roadmap','GET',null,gate);
ok(r.body.items.length===1&&r.body.items[0].title==='Custom future thing','the saved list replaces the seed for everyone');
console.log(passed+' roadmap assertions passed');
