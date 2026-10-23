// Re-embeds standalone styles.css / frontend.js into worker.js as the
// SITE_CSS / SITE_JS string literals. Proven byte-exact against the
// untouched v3.6.14 package (JSON.stringify escaping matches the original).
// Usage: node build-embed.mjs <workerIn> <styles.css> <frontend.js> <workerOut>
import {readFileSync, writeFileSync} from 'node:fs';
const [workerIn, cssFile, jsFile, workerOut] = process.argv.slice(2);
let src = readFileSync(workerIn, 'utf8');
const css = readFileSync(cssFile, 'utf8');
const js = readFileSync(jsFile, 'utf8');
function replaceLiteral(source, name, content){
  const re = new RegExp('const ' + name + ' = "(?:[^"\\\\]|\\\\.)*";', 's');
  if (!source.match(re)) throw new Error('literal not found: ' + name);
  return source.replace(re, 'const ' + name + ' = ' + JSON.stringify(content) + ';');
}
src = replaceLiteral(src, 'SITE_CSS', css);
src = replaceLiteral(src, 'SITE_JS', js);
writeFileSync(workerOut, src);
console.log('embedded CSS', css.length, 'chars and JS', js.length, 'chars ->', workerOut);
