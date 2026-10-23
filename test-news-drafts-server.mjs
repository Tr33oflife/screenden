import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(src+'\nexport {gateSign,adminDigest};').toString('base64'));
// Stateful in-memory mock for mh_news_drafts + mh_news_draft_revisions.
const drafts=new Map(),revisions=new Map();let revSeq=0;
function stmt(sql){let args=[];return{bind(...a){args=a;return this},
 async run(){
  if(sql.startsWith('INSERT INTO mh_news_drafts'))drafts.set(args[0],{id:args[0],article_id:args[1],title:args[2],body:args[3],category:args[4],created_at:args[5],updated_at:args[6]});
  else if(sql.startsWith('UPDATE mh_news_drafts')){const d=drafts.get(args[4]);if(d)Object.assign(d,{title:args[0],body:args[1],category:args[2],updated_at:args[3]});}
  else if(sql.startsWith('INSERT INTO mh_news_draft_revisions')){const id=++revSeq;revisions.set(id,{id,draft_id:args[0],title:args[1],body:args[2],category:args[3],saved_at:args[4]});}
  else if(sql.startsWith('DELETE FROM mh_news_draft_revisions WHERE draft_id=? AND')){const mine=[...revisions.values()].filter(r=>r.draft_id===args[0]).sort((a,b)=>b.id-a.id);for(const r of mine.slice(25))revisions.delete(r.id);}
  else if(sql.startsWith('DELETE FROM mh_news_draft_revisions')){for(const r of [...revisions.values()])if(r.draft_id===args[0])revisions.delete(r.id);}
  else if(sql.startsWith('DELETE FROM mh_news_drafts'))drafts.delete(args[0]);
  return{success:true}},
 async all(){
  if(sql.includes('FROM mh_news_draft_revisions'))return{results:[...revisions.values()].filter(r=>r.draft_id===args[0]).sort((a,b)=>b.id-a.id).slice(0,25).map(r=>({id:r.id,saved_at:r.saved_at,title:r.title}))};
  if(sql.includes('FROM mh_news_drafts'))return{results:[...drafts.values()].sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at))).slice(0,50).map(d=>({id:d.id,article_id:d.article_id,title:d.title,category:d.category,created_at:d.created_at,updated_at:d.updated_at,preview:d.body.slice(0,120)}))};
  return{results:[]}},
 async first(){
  if(sql.includes('FROM mh_news_draft_revisions')){const r=revisions.get(Number(args[0]));return r&&r.draft_id===args[1]?{id:r.id,title:r.title,body:r.body,category:r.category}:null;}
  if(sql.includes('FROM mh_news_drafts')){const d=drafts.get(args[0]);return d?{...d}:null;}
  return null}}}
const env={GATE_SESSION_SECRET:'test-only-community-secret-at-least-32chars',ADMIN_PASSWORD:'test-only-admin-password',PLEX_SESSION_SECRET:'test-only-plex-secret-at-least-32characters',DB:{prepare:stmt}};
const exp=String(Math.floor(Date.now()/1000)+3600),expires=Date.now()+3600000,nonce='fixtureNonce01234567890123456789';
const gate='mh_gate='+exp+'.'+await mod.gateSign(env.GATE_SESSION_SECRET+':default',exp);
const admin='mh_admin='+expires+'_'+nonce+'_'+await mod.adminDigest(env.ADMIN_PASSWORD+':'+expires+':'+nonce);
async function call(method,path,{body,cookie=[gate,admin].join('; '),origin='https://example.com'}={}){const req=new Request('https://example.com'+path,{method,headers:{cookie,origin,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});const r=await mod.default.fetch(req,env);return{status:r.status,body:await r.json().catch(()=>({}))}}
let r=await call('GET','/api/admin/news-drafts',{cookie:gate});assert.equal(r.status,403);console.log('PASS drafts list requires admin sign-in');
r=await call('POST','/api/admin/news-drafts',{cookie:gate,body:{action:'save',title:'x',body:'y'}});assert.equal(r.status,403);console.log('PASS draft save requires admin sign-in');
r=await call('POST','/api/admin/news-drafts',{origin:'https://other.example',body:{action:'save',title:'x',body:'y'}});assert.equal(r.status,403);console.log('PASS cross-origin draft save rejected');
r=await call('POST','/api/admin/news-drafts',{body:{action:'save',title:'',body:'  '}});assert.equal(r.status,400);assert.equal(drafts.size,0);console.log('PASS empty draft is not stored');
r=await call('POST','/api/admin/news-drafts',{body:{action:'save',title:'Server maintenance Sunday',body:'First version of the announcement.',category:'maintenance'}});assert.equal(r.status,200);const draftId=r.body.id;assert(draftId);console.log('PASS draft created with an id');
r=await call('GET','/api/admin/news-drafts');assert.equal(r.body.drafts.length,1);assert.equal(r.body.drafts[0].title,'Server maintenance Sunday');assert(r.body.drafts[0].preview.includes('First version'));console.log('PASS draft listed with preview');
r=await call('GET','/api/admin/news-drafts?id='+draftId);assert.equal(r.body.draft.body,'First version of the announcement.');assert.equal(r.body.revisions.length,1);console.log('PASS draft loads with its first revision');
r=await call('POST','/api/admin/news-drafts',{body:{action:'save',id:draftId,title:'Server maintenance Sunday',body:'First version of the announcement.',category:'maintenance'}});assert.equal(r.body.unchanged,true);
r=await call('GET','/api/admin/news-drafts?id='+draftId);assert.equal(r.body.revisions.length,1);console.log('PASS saving unchanged content adds no revision');
r=await call('POST','/api/admin/news-drafts',{body:{action:'save',id:draftId,title:'Server maintenance Sunday',body:'Second version, with times added.',category:'maintenance'}});assert.equal(r.status,200);
r=await call('GET','/api/admin/news-drafts?id='+draftId);assert.equal(r.body.draft.body,'Second version, with times added.');assert.equal(r.body.revisions.length,2);const firstRev=r.body.revisions[1].id;console.log('PASS edited save updates the draft and appends a revision');
r=await call('POST','/api/admin/news-drafts',{body:{action:'restore',id:draftId,revisionId:firstRev}});assert.equal(r.status,200);assert.equal(r.body.draft.body,'First version of the announcement.');
r=await call('GET','/api/admin/news-drafts?id='+draftId);assert.equal(r.body.revisions.length,3);console.log('PASS restore brings back the old text and snapshots the replaced state');
r=await call('POST','/api/admin/news-drafts',{body:{action:'restore',id:draftId,revisionId:99999}});assert.equal(r.status,404);console.log('PASS restoring a missing revision is a 404');
r=await call('POST','/api/admin/news-drafts',{body:{action:'save',id:'no-such-draft',title:'x',body:'y'}});assert.equal(r.status,404);console.log('PASS saving to a missing draft is a 404');
r=await call('POST','/api/admin/news-drafts',{body:{action:'save',title:'T'.repeat(200),body:'b'}});assert.equal(r.status,200);
r=await call('GET','/api/admin/news-drafts?id='+r.body.id);assert.equal(r.body.draft.title.length,140);console.log('PASS over-long titles are capped at the article limit');
r=await call('POST','/api/admin/news-drafts',{body:{action:'delete',id:draftId}});assert.equal(r.status,200);
r=await call('GET','/api/admin/news-drafts?id='+draftId);assert.equal(r.status,404);
r=await call('GET','/api/admin/news-drafts');assert.equal(r.body.drafts.length,1);console.log('PASS delete removes the draft; the other draft remains');
console.log('ALL SERVER DRAFT TESTS PASSED');
