import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(src+'\nexport {community351Route};').toString('base64'));
const tables={};
const db={prepare(sql){let vals=[];return {bind(...args){vals=args;return this},async run(){if(sql.startsWith('INSERT INTO mh_community351'))tables.payload=vals[0];if(sql.startsWith('INSERT INTO mh_report_limits'))tables.limit={actor:vals[0],submitted_at:vals[1]};return {success:true}},async first(){if(sql.startsWith('SELECT payload FROM mh_community351'))return tables.payload?{payload:tables.payload}:null;if(sql.startsWith('SELECT submitted_at FROM mh_report_limits'))return tables.limit?.actor===vals[0]?{submitted_at:tables.limit.submitted_at}:null;return null},async all(){return {results:[]}}}}};
const env={DB:db,GATE_SESSION_SECRET:'0123456789012345678901234567890123456789'};
async function call(path,method='GET',body=null){const req=new Request('https://example.com'+path,{method,headers:{...(body?{'content-type':'application/json',origin:'https://example.com','CF-Connecting-IP':'192.0.2.10'}:{})},...(body?{body:JSON.stringify(body)}:{})});const res=await mod.community351Route(req,env,new URL(req.url));return {status:res.status,body:await res.json()}}
let r=await call('/api/community351');assert.equal(r.status,200);assert.deepEqual(r.body.faq,[]);
r=await call('/api/admin/community351');assert.equal(r.status,403);
r=await call('/api/community351','POST',{action:'vote',optionId:'x'});assert.equal(r.status,401);
r=await call('/api/community351','POST',{action:'report',subject:'Test',details:'Issue'});assert.equal(r.status,200);assert.equal(JSON.parse(tables.payload).reports.length,1);
r=await call('/api/community351');assert.equal('reports' in r.body,false);
r=await call('/api/community351','POST',{action:'report',subject:'Again',details:'Issue'});assert.equal(r.status,429);
r=await call('/api/community351','POST',{action:'report',subject:'',details:'Issue'});assert.equal(r.status,400);
console.log('PASS: public read, admin protection, unauthenticated vote rejection, report persistence, 10-minute rate limit, private report exclusion, invalid report rejection');
