import {readdir,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base='/night-city-vault-community/';
const files=[];
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){const file=dir+'/'+entry.name;if(entry.isDirectory())await walk(file);else files.push(file.slice(5));}}
await walk('dist');
const fixed=['index.html','sw.js','manifest.webmanifest','THIRD_PARTY_NOTICES.txt','icons/vault-192.png','icons/vault-512.png','icons/apple-touch-icon.png'];
for(const file of files)assert(fixed.includes(file)||/^assets\/(?:index-[\w-]+\.(?:js|css)|worker-[\w-]+\.js)$/.test(file),`Unexpected artifact: ${file}`);
for(const file of fixed)assert(files.includes(file),`Missing ${file}`);
const html=await readFile('dist/index.html','utf8');
for(const [,url] of html.matchAll(/(?:src|href)="([^"]+)"/g)){assert(url.startsWith(base),`Unscoped HTML URL ${url}`);assert(files.includes(url.slice(base.length)),`Missing HTML asset ${url}`);}
const manifest=JSON.parse(await readFile('dist/manifest.webmanifest','utf8'));
const address=new URL('https://pages.invalid'+base);
for(const key of ['id','scope','start_url'])assert.equal(new URL(manifest[key],address).pathname,base);
for(const icon of manifest.icons)assert(files.includes(icon.src));
const sw=await readFile('dist/sw.js','utf8');
for(const file of files.filter(file=>file!=='sw.js'))assert(sw.includes('./'+file),`Not precached: ${file}`);
assert(sw.includes("startsWith('ncv-community-night-city-vault-shell-')"));
const app=await readFile('dist/'+files.find(file=>/^assets\/index-.*\.js$/.test(file)),'utf8');
assert(app.includes(base+'assets/worker-'),'Worker assets must use Pages base');
assert.equal(await readFile('public/THIRD_PARTY_NOTICES.txt','utf8'),await readFile('dist/THIRD_PARTY_NOTICES.txt','utf8'));
console.log(`PASS Pages artifact: ${files.length} allowed files, scoped HTML/manifest/workers, complete precache, notices, no source maps`);
