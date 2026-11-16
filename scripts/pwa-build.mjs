import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// Cache only build-owned shell files. No runtime responses or collection data.
export function offlineShell() {
 let publicDir;
 /** @type {import('vite').Plugin} */
 return {name:'vault-offline-shell',enforce:'post',apply:'build',configResolved(config){publicDir=config.publicDir;},async generateBundle(_,bundle){
  const files=['./', './manifest.webmanifest','./THIRD_PARTY_NOTICES.txt','./icons/vault-192.png','./icons/vault-512.png','./icons/apple-touch-icon.png',...Object.keys(bundle).filter(p=>!p.endsWith('.map')).map(p=>'./'+p)];
  const source=`const CACHE='ncv-community-night-city-vault-shell-__VERSION__';
const FILES=${JSON.stringify(files)};
const urls=FILES.map(p=>new URL(p,self.registration.scope).href);
self.addEventListener('install',event=>event.waitUntil((async()=>{try{await (await caches.open(CACHE)).addAll(urls);}catch(error){await caches.delete(CACHE);throw error;}})()));
// Default lifecycle: never skip waiting or reload an editing client.
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('ncv-community-night-city-vault-shell-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
if(event.request.mode==='navigate'&&url.pathname.startsWith(new URL(self.registration.scope).pathname)){event.respondWith(caches.open(CACHE).then(c=>c.match(new URL('./',self.registration.scope).href)).then(r=>r||Response.error()));return;}
if(urls.includes(url.href))event.respondWith(caches.open(CACHE).then(c=>c.match(event.request)).then(r=>r||fetch(event.request)));});`;
  const hash=createHash('sha256').update(source);
  for(const name of Object.keys(bundle).sort()){const item=bundle[name];hash.update(name).update(item.type==='chunk'?item.code:item.source);}
  for(const name of ['manifest.webmanifest','THIRD_PARTY_NOTICES.txt','icons/vault-192.png','icons/vault-512.png','icons/apple-touch-icon.png'])hash.update(await readFile(path.join(publicDir,name)));
  this.emitFile({type:'asset',fileName:'sw.js',source:source.replace('__VERSION__',hash.digest('hex').slice(0,24))});
 }};
}
