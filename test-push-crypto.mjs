// Receiver-side proof for the Web Push implementation in worker.js.
// This test plays the part of a push service client (the browser): it makes
// a subscription keypair + auth secret, hands the worker's pushEncrypt the
// subscription, then decrypts the result with an INDEPENDENT implementation
// of RFC 8291 written from the spec text — shared code with the sender is
// limited to base64url helpers the test defines itself. It also verifies the
// VAPID JWT (RFC 8292) signature against the generated public key.
import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {DatabaseSync} from 'node:sqlite';
const sqlite=new DatabaseSync(':memory:');
const db={prepare(sql){let a=[];return{bind(...x){a=x;return this},async run(){sqlite.prepare(sql).run(...a);return{success:true}},async all(){return{results:sqlite.prepare(sql).all(...a)}},async first(){return sqlite.prepare(sql).get(...a)||null}}},async batch(s){const r=[];for(const x of s)r.push(await x.run());return r}};
const src=readFileSync(new URL('./worker.js',import.meta.url),'utf8');
const mod=await import('data:text/javascript;base64,'+Buffer.from(src+'\nexport {pushEncrypt,vapidGenerate,vapidKeys,vapidJwt,b64u};').toString('base64'));
const env={DB:db};
const dec=s=>{const p='='.repeat((4-s.length%4)%4);const bin=atob(s.replace(/-/g,'+').replace(/_/g,'/')+p);return Uint8Array.from(bin,c=>c.charCodeAt(0))};
const enc=b=>btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
let passed=0;const ok=(c,m)=>{assert(c,m);passed++;console.log('ok -',m)};
// --- the "browser" side ---
const uaPair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
const uaPublic=new Uint8Array(await crypto.subtle.exportKey('raw',uaPair.publicKey));
const auth=crypto.getRandomValues(new Uint8Array(16));
const sub={p256dh:enc(uaPublic),auth:enc(auth)};
const payload=JSON.stringify({title:'Your request was fulfilled: Dune',body:'Enjoy!',page:'Requests',tag:'request:x'});
// --- the worker encrypts ---
const ephPair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
const body=await mod.pushEncrypt(sub,payload,ephPair);
// --- parse the aes128gcm header ---
const salt=body.slice(0,16);const rs=new DataView(body.buffer,body.byteOffset).getUint32(16);const idLen=body[20];const serverPublic=body.slice(21,21+idLen);const cipher=body.slice(21+idLen);
ok(rs===4096&&idLen===65,'header carries salt, record size and the ephemeral key');
const ephPublic=new Uint8Array(await crypto.subtle.exportKey('raw',ephPair.publicKey));
ok(Buffer.from(serverPublic).equals(Buffer.from(ephPublic)),'header key id is the ephemeral public key');
// --- decrypt, from the RFC: ECDH, then HKDF(auth, "WebPush: info"), then HKDF(salt, content encodings) ---
async function hkdf(ikm,saltBytes,info,length){const k=await crypto.subtle.importKey('raw',ikm,'HKDF',false,['deriveBits']);return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt:saltBytes,info},k,length*8))}
const serverKey=await crypto.subtle.importKey('raw',serverPublic,{name:'ECDH',namedCurve:'P-256'},false,[]);
const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:serverKey},uaPair.privateKey,256));
const infoHead=new TextEncoder().encode('WebPush: info\0');
const ikmInfo=new Uint8Array(infoHead.length+uaPublic.length+serverPublic.length);ikmInfo.set(infoHead);ikmInfo.set(uaPublic,infoHead.length);ikmInfo.set(serverPublic,infoHead.length+uaPublic.length);
const ikm=await hkdf(shared,auth,ikmInfo,32);
const cek=await hkdf(ikm,salt,new TextEncoder().encode('Content-Encoding: aes128gcm\0'),16);
const nonce=await hkdf(ikm,salt,new TextEncoder().encode('Content-Encoding: nonce\0'),12);
const aesKey=await crypto.subtle.importKey('raw',cek,{name:'AES-GCM'},false,['decrypt']);
const plain=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:nonce,tagLength:128},aesKey,cipher));
ok(plain[plain.length-1]===2,'final record ends with the 0x02 padding delimiter');
ok(new TextDecoder().decode(plain.slice(0,-1))===payload,'decrypted payload matches what the worker encrypted, byte for byte');
// --- VAPID JWT: signature must verify against the stored public key ---
const publicKey=await mod.vapidGenerate(env);
const keys=await mod.vapidKeys(env);
const jwt=await mod.vapidJwt(env,keys,'https://push.example.com');
const [h,p,s]=jwt.split('.');
ok(JSON.parse(atob(h.replace(/-/g,'+').replace(/_/g,'/'))).alg==='ES256','JWT header is ES256');
const claims=JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/')));
ok(claims.aud==='https://push.example.com'&&claims.exp>Math.floor(Date.now()/1000),'JWT carries the push origin as audience and a future expiry');
const pubKey=await crypto.subtle.importKey('raw',dec(publicKey),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
ok(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},pubKey,dec(s),new TextEncoder().encode(h+'.'+p)),'JWT signature verifies against the VAPID public key');
ok(publicKey.length===87,'public key is the 65-byte uncompressed point, base64url');
console.log(passed+' push-crypto assertions passed');
