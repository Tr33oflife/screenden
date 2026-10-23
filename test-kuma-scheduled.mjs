import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const src=await readFile(new URL('./worker.js',import.meta.url),'utf8');
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(src).toString('base64'));
assert.equal(typeof worker.scheduled,'function');
const calls=[];const rows=new Map();
const DB={prepare(sql){return {bind(...args){this.args=args;return this},async run(){calls.push({sql,args:this.args});if(sql.includes('INSERT OR IGNORE INTO mh_kuma_status_events'))rows.set(this.args.join('|'),this.args);return {success:true}},async all(){return {results:[]}}}},async batch(items){for(const item of items)await item.run()}};
const oldFetch=globalThis.fetch;
globalThis.fetch=async url=>{
 if(String(url).includes('/api/status-page/heartbeat/'))return new Response(JSON.stringify({heartbeatList:{'7':[{status:1,time:'2026-10-15T00:00:00Z'},{status:0,time:'2026-10-15T00:05:00Z'},{status:1,time:'2026-10-15T00:10:00Z'}]}}),{status:200});
 if(String(url).includes('/api/status-page/'))return new Response(JSON.stringify({publicGroupList:[{monitorList:[{id:7,name:'Plex'}]}]}),{status:200});
 throw Error('Unexpected URL '+url)
};
try{
 const jobs=[];const ctx={waitUntil(p){jobs.push(p)}};
 await worker.scheduled({cron:'*/5 * * * *'},{KUMA_STATUS_URL:'https://status.example.com/status/main',DB},ctx);
 assert.equal(jobs.length,1);await Promise.all(jobs);
 assert.equal(rows.size,2,'outage and recovery should be stored');
 assert.ok([...rows.values()].some(x=>x[3]===0));
 assert.ok([...rows.values()].some(x=>x[3]===1));
 console.log('PASS scheduled handler invoked; outage and recovery transitions stored');
}catch(e){console.error(e);process.exitCode=1}finally{globalThis.fetch=oldFetch}
