import assert from 'node:assert/strict';
process.env.NC_BROWSER='1';const {env,mod,gate}=await import('./test-personal-nextcloud.mjs');
// Public edition: the HTML guide ships with placeholder connection details;
// the original PDF guide is a private document and is not shipped, so the
// PDF route must not serve a guide any more.
for(const path of ['/ftp-guide']){
 const denied=await mod.default.fetch(new Request('https://example.com'+path),env);assert.equal(denied.status,401);
 const head=await mod.default.fetch(new Request('https://example.com'+path,{method:'HEAD',headers:{cookie:gate}}),env);assert.equal(head.status,200);assert.equal(await head.text(),'');
 const invalid=await mod.default.fetch(new Request('https://example.com'+path,{method:'POST',headers:{cookie:gate}}),env);assert.equal(invalid.status,405);
}
const guide=await mod.default.fetch(new Request('https://example.com/ftp-guide',{headers:{cookie:gate}}),env);assert.equal(guide.status,200);const html=await guide.text();assert.ok(html.includes('href="https://cyberduck.io/"'));assert.equal((html.match(/id="guide-step-/g)||[]).length,10);assert.match(html,/ScreenDen \u00b7 v1.0.0-rc.1 \u00b7 Build: ScreenDen contributors/);assert.match(guide.headers.get('content-security-policy'),/default-src 'none'/);assert.ok(!/<script\b/i.test(html));
assert.ok(html.includes('your-server.example.com'),'guide carries the placeholder server, not a real one');
const pdf=await mod.default.fetch(new Request('https://example.com/ftp-guide.pdf',{headers:{cookie:gate}}),env);const pdfBody=await pdf.text();assert.ok(pdf.headers.get('content-type')!=='application/pdf'&&!pdfBody.startsWith('%PDF'),'the private PDF guide is not served in the public edition');
console.log('PASS member-only HTML guide route, HEAD/method handling, section anchors, official links, footer identity, CSP, placeholder server, and no PDF guide in the public edition');
