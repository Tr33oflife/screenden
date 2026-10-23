// Parse-gate for an embedded build: extract SITE_JS from a worker.js and
// syntax-check it as a standalone script. Backend tests cannot see inside
// the SITE_JS string — a broken release note once shipped a dead app.js
// (v3.6.30) because nothing parsed the embedded copy after the version bump.
// Usage: node check-embedded.mjs <worker.js>
import { readFileSync } from 'node:fs';
const path = process.argv[2];
if (!path) { console.error('usage: node check-embedded.mjs <worker.js>'); process.exit(2); }
const w = readFileSync(path, 'utf8');
const grab = n => { const m = w.match(new RegExp('const ' + n + ' = "((?:\\\\.|[^"\\\\])*)"')); if (!m) throw Error(n + ' not found'); return JSON.parse('"' + m[1] + '"'); };
const js = grab('SITE_JS');
try { new Function(js); } catch (e) { console.error('SITE_JS PARSE ERROR:', e.message); process.exit(1); }
const css = grab('SITE_CSS');
if (!css.length) { console.error('SITE_CSS empty'); process.exit(1); }
console.log('embedded assets ok: SITE_JS parses (' + js.length + ' chars), SITE_CSS ' + css.length + ' chars');
