import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';
const sqlite=new DatabaseSync(':memory:');
const db={prepare(sql){let a=[];return{bind(...x){a=x;return this},async run(){sqlite.prepare(sql).run(...a);return{success:true}},async all(){return{results:sqlite.prepare(sql).all(...a)}},async first(){return sqlite.prepare(sql).get(...a)||null}}},async batch(s){const r=[];for(const x of s)r.push(await x.run());return r}};
const src=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const fe=readFileSync(new URL('./frontend.js',import.meta.url),'utf8');
const css=readFileSync(new URL('./styles.css',import.meta.url),'utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(src+'\nexport {gateSign,adminDigest};').toString('base64'));
const env={DB:db,GATE_SESSION_SECRET:'test-gate-secret-at-least-32-characters',ADMIN_PASSWORD:'test-admin-password',METADATA_ENCRYPTION_KEY:'test-metadata-key'};
const exp=String(Math.floor(Date.now()/1000)+3600);const gate='mh_gate='+exp+'.'+await mod.gateSign(env.GATE_SESSION_SECRET+':default',exp);
const aexp=Date.now()+3600000,nonce='fixtureNonce01234567890123456789';const admin='mh_admin='+aexp+'_'+nonce+'_'+await mod.adminDigest(env.ADMIN_PASSWORD+':'+aexp+':'+nonce);
async function call(path,method='GET',body=null,cookie=gate){const r=await mod.default.fetch(new Request('https://example.com'+path,{method,headers:{cookie,...(body?{'content-type':'application/json',origin:'https://example.com'}:{})},body:body?JSON.stringify(body):undefined}),env);return{status:r.status,body:await r.json().catch(()=>({}))}}
const both=[gate,admin].join('; ');let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('ok -',m)};
// Icon lists agree between the worker validation and the frontend picker.
const wIcons=src.match(/\[('▶'(?:,'[^']*')+)\]\.includes\(values\.icon\)/)?.[1];
const fIcons=fe.match(/\[('▶'(?:,'[^']*')+)\]\.map\(i=>`<label class="icon-tile">/)?.[1];
ok(wIcons&&fIcons&&wIcons===fIcons,'worker and frontend offer the identical icon set');
ok(wIcons.split(',').length===24,'the icon set has 24 glyphs (was 6)');
// Every theme id validates and has CSS (tavern is the base stylesheet).
const themes=['tavern','ember','abyss','neon','forest','royal'];
for(const t of themes.slice(1))ok(css.includes('[data-theme="'+t+'"]'),'theme '+t+' has CSS rules');
// Branding round-trip: defaults, save with a new icon + theme, invalid values.
let r=await call('/api/dashboard/config');ok(r.body.theme==='tavern'&&r.body.icon==='▶','config defaults to the tavern theme and the play icon');
r=await call('/api/admin/branding','POST',{name:'Hub',tagline:'',accent:'#b19aff',icon:'⚡',theme:'neon'},both);ok(r.status===200,'branding saves with a new icon and theme');
r=await call('/api/dashboard/config');ok(r.body.icon==='⚡'&&r.body.theme==='neon','config serves the saved icon and theme');
r=await call('/api/admin/branding','POST',{name:'Hub',tagline:'',accent:'#b19aff',icon:'🚀',theme:'neon'},both);ok(r.status===400,'an icon outside the set is rejected');
r=await call('/api/admin/branding','POST',{name:'Hub',tagline:'',accent:'#b19aff',icon:'⚡',theme:'plaid'},both);ok(r.status===400,'an unknown theme is rejected');
r=await call('/api/admin/branding','POST',{name:'Hub',tagline:'',accent:'#b19aff',icon:'⚡',theme:'ember'},gate);ok(r.status===401,'branding save without admin is refused');
r=await call('/api/admin/branding','POST',{name:'Hub',tagline:'',accent:'#b19aff',icon:'svg:device-tv',theme:'neon'},both);ok(r.status===200,'a library icon saves');
r=await call('/api/dashboard/config');ok(r.body.icon==='svg:device-tv','config serves the library icon');
r=await call('/api/admin/branding','POST',{name:'Hub',tagline:'',accent:'#b19aff',icon:'svg:nope-nothing',theme:'neon'},both);ok(r.status===400,'an unknown library icon is rejected');
const wNames=src.match(/const MH_ICON_NAMES=\[([^\]]+)\]/)?.[1];const feIcons=fe.match(/const MH_ICONS=\{([\s\S]*?)\n\};/)?.[1];const fKeys=[...feIcons.matchAll(/'(svg:[^']+)':/g)].map(m=>m[1]);const wKeys=[...wNames.matchAll(/'(svg:[^']+)'/g)].map(m=>m[1]);ok(wKeys.length>=40&&JSON.stringify(wKeys)===JSON.stringify(fKeys),'worker and frontend carry the identical library icon set ('+wKeys.length+' icons)');
console.log(passed+' theme + icon assertions passed');
