import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';
// Public-edition gate defaults: a fresh install has no custom gate answer
// set, so the gate falls back to a neutral default answer — and the private
// build's defaults must NOT work. Once an admin sets a custom answer, only
// that answer works.
const sqlite=new DatabaseSync(':memory:');
const db={prepare(sql){let a=[];return{bind(...x){a=x;return this},async run(){sqlite.prepare(sql).run(...a);return{success:true}},async all(){return{results:sqlite.prepare(sql).all(...a)}},async first(){return sqlite.prepare(sql).get(...a)||null}}},async batch(s){const r=[];for(const x of s)r.push(await x.run());return r}};
const src=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
const env={DB:db,GATE_SESSION_SECRET:'g'.repeat(40),ADMIN_PASSWORD:'a'.repeat(24)};
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('ok -',m)};
async function login(answer){const r=await mod.default.fetch(new Request('https://example.com/api/gate/login',{method:'POST',headers:{'content-type':'application/json',origin:'https://example.com'},body:JSON.stringify({answer})}),env);return{status:r.status,cookie:r.headers.get('set-cookie')||''};}
let r=await mod.default.fetch(new Request('https://example.com/api/gate/config'),env);
ok(r.status===200&&(await r.json()).question==='What is this hub called?','a fresh install asks the neutral default question');
r=await login('tavern');ok(r.status===401,'the private default answer does not work');
r=await login('thetavern');ok(r.status===401,'the private default answer variant does not work');
r=await login('screenden');ok(r.status===200&&r.cookie.includes('mh_gate='),'the neutral default answer works on a fresh install');
r=await login('wrong answer');ok(r.status===401,'a wrong answer is refused');
// An admin-set custom answer replaces the default entirely.
const hash=await (async()=>{const {createHash}=await import('node:crypto');return createHash('sha256').update('opensesame').digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')})();
sqlite.prepare("INSERT INTO mh_dashboard_settings(key,value) VALUES('gateAnswerHash',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(hash);
r=await login('screenden');ok(r.status===401,'the default stops working once a custom answer is set');
r=await login('opensesame');ok(r.status===200,'the custom answer works');
console.log(passed+' gate-default assertions passed');
