import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';
const sqlite=new DatabaseSync(':memory:');const db={prepare(sql){let args=[];return{bind(...a){args=a;return this},async run(){sqlite.prepare(sql).run(...args);return{success:true}},async all(){return{results:sqlite.prepare(sql).all(...args)}},async first(){return sqlite.prepare(sql).get(...args)||null}}},async batch(s){sqlite.exec('BEGIN');try{const r=[];for(const x of s)r.push(await x.run());sqlite.exec('COMMIT');return r}catch(e){sqlite.exec('ROLLBACK');throw e}}};
const source=readFileSync(new URL('./worker.js',import.meta.url),'utf8');const mod=await import('data:text/javascript;base64,'+Buffer.from(source+'\nexport {gateSign,hash,encrypt};').toString('base64'));
const env={DB:db,GATE_SESSION_SECRET:'fixture-only-gate-secret-32-characters',NC_LAB_ENCRYPTION_KEY:'fixture-only-nextcloud-key-32-characters'};
env.PLEX_SESSION_SECRET='fixture-only-plex-secret-32-characters';
sqlite.exec('CREATE TABLE plex_sessions(session_hash TEXT PRIMARY KEY,plex_user_id TEXT,username TEXT,token_encrypted TEXT,expires_at INTEGER)');
for(const id of ['alice','bob'])sqlite.prepare('INSERT INTO plex_sessions VALUES(?,?,?,?,?)').run(await mod.hash(id==='alice'?'a'.repeat(64):'b'.repeat(64)),id,id,await mod.encrypt(env,'fixture-token'),Date.now()+3600000);
const expiry=String(Math.floor(Date.now()/1000)+3600);const gate='mh_gate='+expiry+'.'+await mod.gateSign(env.GATE_SESSION_SECRET+':default',expiry);
async function call(action,body=null,user='alice'){const r=await mod.default.fetch(new Request('https://example.com/api/plex/nextcloud/'+action,{method:body?'POST':'GET',headers:{cookie:gate+'; mh_nc_browser='+(user==='alice'?'a'.repeat(64):'b'.repeat(64)),...(body?{origin:'https://example.com','content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),env);return{status:r.status,body:await r.json()}}
// Fixture DAV tree under /remote.php/dav/files/alice-dav-id/
const TREE={
 '':[['Photos',1],['Docs',1],['readme.txt',0,120]],
 'Photos':[['gala-night.jpg',0,2048],['party.png',0,512],['Gala 2024',1]],
 'Photos/Gala 2024':[['gala-video.mp4',0,9000]],
 'Docs':[['Gala Notes.txt',0,300],['tax.pdf',0,700]]};
function davXml(base,entries){const resp=(href,folder,size)=>'<d:response><d:href>'+href+'</d:href><d:propstat><d:prop><d:resourcetype>'+(folder?'<d:collection/>':'')+'</d:resourcetype>'+(size!=null?'<d:getcontentlength>'+size+'</d:getcontentlength>':'')+'</d:prop></d:propstat></d:response>';
 return '<d:multistatus xmlns:d="DAV:">'+resp(base,true)+entries.map(([name,folder,size])=>resp(base+encodeURIComponent(name)+(folder?'/':''),!!folder,size)).join('')+'</d:multistatus>';}
globalThis.fetch=async(url,options={})=>{url=String(url);
 if(url.endsWith('/index.php/login/v2'))return Response.json({login:'https://cloud.example.com/nextcloud/login',poll:{endpoint:'https://cloud.example.com/nextcloud/poll',token:'fixture-poll-token'}});
 if(url.endsWith('/poll'))return Response.json({server:'https://cloud.example.com/nextcloud',loginName:'alice@example.com',appPassword:'fixture-app-password'});
 if(url.includes('/cloud/user'))return Response.json({ocs:{meta:{status:'ok'},data:{id:'alice-dav-id'}}});
 if(options.method==='PROPFIND'){const path=decodeURIComponent(new URL(url).pathname);const m=path.match(/\/alice-dav-id\/(.*)$/);const rel=(m?m[1]:'').replace(/\/$/,'');
  if(options.headers.Depth==='0'){const parent=rel.split('/').slice(0,-1).join('/');const name=rel.split('/').pop();const entry=(TREE[parent]||[]).find(x=>x[0]===name);const isFolder=rel===''?true:entry?!!entry[1]:false;return new Response('<d:multistatus xmlns:d="DAV:"><d:response><d:href>'+new URL(url).pathname+'</d:href><d:propstat><d:prop><d:resourcetype>'+(isFolder?'<d:collection/>':'')+'</d:resourcetype></d:prop></d:propstat></d:response></d:multistatus>',{status:207});}
  const entries=TREE[rel];if(!entries)return new Response('not found',{status:404});
  return new Response(davXml(new URL(url).pathname,entries),{status:207});}
 throw Error('Unexpected fixture request '+url);};
const id='11111111-1111-4111-8111-111111111111';
sqlite.exec("CREATE TABLE mh_nc_available (id TEXT PRIMARY KEY,name TEXT NOT NULL,url TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1)");
sqlite.prepare('INSERT INTO mh_nc_available(id,name,url,enabled) VALUES(?,?,?,1)').run(id,'Server One','https://cloud.example.com/nextcloud');
await call('servers');assert.equal((await call('start',{id})).status,200);assert.equal((await call('poll',{id})).body.connected,true);console.log('PASS fixture member connected to the fixture server');
let r=await call('search?id='+id+'&q=gala',null,'bob');assert(r.status>=400);console.log('PASS search by an unconnected member is refused');
r=await call('pins?id='+id);assert.deepEqual(r.body.pins,[]);console.log('PASS favourites start empty');
r=await call('pin',{id,path:'Photos'});assert.equal(r.status,200);
r=await call('pins?id='+id);assert.deepEqual(r.body.pins,[{path:'Photos',label:'Photos'}]);console.log('PASS folder pinned and listed as a favourite');
r=await call('pin',{id,path:'readme.txt'});assert.equal(r.status,400);console.log('PASS files cannot be pinned');
r=await call('search?id='+id+'&q=g');assert.equal(r.status,400);console.log('PASS one-character searches are rejected');
r=await call('search?id='+id+'&q=GALA');assert.equal(r.status,200);assert.equal(r.body.server,'Server One');
const paths=r.body.results.map(x=>x.path).sort();assert.deepEqual(paths,['Docs/Gala Notes.txt','Photos/Gala 2024','Photos/Gala 2024/gala-video.mp4','Photos/gala-night.jpg']);console.log('PASS search finds matches across nested folders, case-insensitively, and names the server');
const folderHit=r.body.results.find(x=>x.path==='Photos/Gala 2024');assert.equal(folderHit.folder,true);const fileHit=r.body.results.find(x=>x.path==='Photos/gala-night.jpg');assert.equal(fileHit.size,2048);console.log('PASS search results carry folder flags and sizes');
r=await call('search?id='+id+'&q=zzz');assert.deepEqual(r.body.results,[]);console.log('PASS no-match search returns an empty list');
r=await call('unpin',{id,path:'Photos'});assert.equal(r.status,200);
r=await call('pins?id='+id);assert.deepEqual(r.body.pins,[]);console.log('PASS unpin removes the favourite');
r=await call('pins?id='+id,null,'bob');assert(r.status>=400);console.log('PASS another member cannot read these favourites');
console.log('ALL NEXTCLOUD FAVOURITES + SEARCH TESTS PASSED');
