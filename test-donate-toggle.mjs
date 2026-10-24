// Donate toggle: the branding 'donations' flag defaults on, is stored
// via /api/admin/branding, served by /api/dashboard/config, rejects
// invalid values, and is untouched when the branding form omits it.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
const sql = new DatabaseSync(':memory:');
const DB = {prepare(query){let args=[];return{bind(...x){args=x;return this},
  async run(){sql.prepare(query).run(...args);return{success:true}},
  async first(){return sql.prepare(query).get(...args)||null},
  async all(){return{results:sql.prepare(query).all(...args)}}}},
  async batch(stmts){const out=[];for(const s of stmts)out.push(await s.run());return out}};
const source = readFileSync(new URL('./worker.js', import.meta.url), 'utf8');
const m = await import('data:text/javascript;base64,' + Buffer.from(source + '\nexport {gateSign,adminDigest};').toString('base64'));
const env = {DB, GATE_SESSION_SECRET: 'fixture-only-gate-secret-32characters', ADMIN_PASSWORD: 'fixture-only-password'};
const exp = String(Math.floor(Date.now()/1000) + 3600), until = Date.now() + 3600000, nonce = 'fixtureNonce01234567890123456789';
const gate = 'mh_gate=' + exp + '.' + await m.gateSign(env.GATE_SESSION_SECRET + ':default', exp);
const admin = 'mh_admin=' + until + '_' + nonce + '_' + await m.adminDigest(env.ADMIN_PASSWORD + ':' + until + ':' + nonce);
async function call(path, body, auth = true) {
  const r = await m.default.fetch(new Request('https://example.com' + path, {method: body ? 'POST' : 'GET',
    headers: {cookie: gate + (auth ? '; ' + admin : ''), origin: 'https://example.com',
      ...(body ? {'content-type': 'application/json'} : {})},
    ...(body ? {body: JSON.stringify(body)} : {})}), env);
  return {status: r.status, body: await r.json().catch(() => ({}))};
}
const branding = (extra = {}) => ({name: 'ScreenDen', tagline: 'Your media & files dashboard',
  accent: '#b19aff', icon: '▶', theme: 'tavern', ...extra});

let r = await call('/api/dashboard/config');
assert.equal(r.status, 200);
assert.equal(r.body.donations, true);
console.log('PASS donations defaults on');

r = await call('/api/admin/branding', branding({donations: '0'}));
assert.equal(r.status, 200);
r = await call('/api/dashboard/config');
assert.equal(r.body.donations, false);
console.log('PASS admin can turn the donate button off');

r = await call('/api/admin/branding', branding({donations: '1'}));
assert.equal(r.status, 200);
r = await call('/api/dashboard/config');
assert.equal(r.body.donations, true);
console.log('PASS admin can turn the donate button back on');

r = await call('/api/admin/branding', branding({donations: 'maybe'}));
assert.equal(r.status, 400);
r = await call('/api/dashboard/config');
assert.equal(r.body.donations, true);
console.log('PASS invalid donations value rejected, stored value unchanged');

r = await call('/api/admin/branding', branding({donations: '0'}));
assert.equal(r.status, 200);
r = await call('/api/admin/branding', branding());
assert.equal(r.status, 200);
r = await call('/api/dashboard/config');
assert.equal(r.body.donations, false);
console.log('PASS omitting donations from a branding save leaves it unchanged');

r = await call('/api/admin/branding', branding({donations: '1'}), false);
assert.equal(r.status, 401);
console.log('PASS branding save requires admin');

// The button's form: a footer plain link, never the floating widget.
// The widget script and draw call must be absent from both the
// frontend source and the worker (which embeds it).
const fe = readFileSync(new URL('./frontend.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
assert.ok(fe.includes('class="donate-link"'), 'footer donate link present');
assert.ok(fe.includes('href="https://ko-fi.com/t4v3rn"'), 'donate link points at Ko-fi');
assert.ok(fe.includes('donationsEnabled()'), 'footer link gated on the toggle');
assert.ok(css.includes('.dashboard-footer-links a.donate-link'), 'donate-link rule present');
assert.ok(css.includes('background:#323842'), 'donate-link pill is dark #323842');
assert.ok(css.includes('font-size:12px'), 'donate-link is 12px');
for (const term of ['kofiWidgetOverlay', 'storage.ko-fi.com']) {
  assert.ok(!fe.includes(term), 'frontend must not contain ' + term);
  assert.ok(!source.includes(term), 'worker must not contain ' + term);
}
console.log('PASS donate button is a footer mini link; widget form rejected');
