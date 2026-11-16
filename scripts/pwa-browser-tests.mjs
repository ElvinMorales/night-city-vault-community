// Loopback only; never serves on a network interface. Supply a development Playwright module.
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const {chromium,webkit}=await import(process.env.COMMUNITY_PLAYWRIGHT ?? 'playwright');
const manifest=JSON.parse(await readFile('dist/manifest.webmanifest','utf8'));
if(manifest.display!=='standalone'||manifest.start_url!=='./'||manifest.scope!=='./')throw Error('Manifest install boundary');
for(const size of [192,512]){const icon=manifest.icons.find(i=>i.sizes===`${size}x${size}`&&i.type==='image/png');if(!icon)throw Error('Missing install icon');const bytes=await readFile(path.join('dist',icon.src));if(bytes.readUInt32BE(16)!==size||bytes.readUInt32BE(20)!==size)throw Error('Icon size mismatch');}
if(!(await readFile('dist/sw.js','utf8')).includes('"./index.html"'))throw Error('Final HTML missing from shell build');
console.log('PASS install manifest, icon dimensions and final HTML shell inclusion');
let version=1,broken=false,unavailable=false;
const server=createServer(async(req,res)=>{if(unavailable){req.socket.destroy();return;}try{
 let pathname=decodeURIComponent(new URL(req.url,'http://loopback.invalid').pathname);if(!pathname.startsWith('/night-city-vault-community/')){res.writeHead(404);res.end();return;}pathname=pathname.slice('/night-city-vault-community'.length);
 const file=path.resolve('dist','.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(path.resolve('dist')+path.sep))throw Error('path');
 let bytes=await readFile(file);
 if(pathname==='/sw.js'){let s=bytes.toString().replace(/ncv-community-night-city-vault-shell-([^']+)/,`ncv-community-night-city-vault-shell-test-${version}`);if(broken)s=s.replace('const FILES=[','const FILES=["./missing-install-asset",');bytes=Buffer.from(s);}
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',pathname.endsWith('.js')?'text/javascript':pathname.endsWith('.css')?'text/css':pathname.endsWith('.png')?'image/png':pathname.endsWith('.webmanifest')?'application/manifest+json':'text/html');res.end(bytes);
 }catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}/night-city-vault-community/`;
async function storedCollection(page){return page.evaluate(async()=>{
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('community-collection-local');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 try{const names=['cards','printings','lots','allocations','artworkEntries','blobs','operations','batches','events'];const tx=db.transaction(names);const rows=await Promise.all(names.map(name=>new Promise((resolve,reject)=>{const r=tx.objectStore(name).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);})));for(const b of rows[5])b.blob={type:b.blob.type,size:b.blob.size,hash:[...new Uint8Array(await crypto.subtle.digest('SHA-256',await b.blob.arrayBuffer()))].join(',')};return JSON.stringify(rows,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);}finally{db.close();}
 });}
try{for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 if(process.env.COMMUNITY_ENGINE&&name!==process.env.COMMUNITY_ENGINE)continue;
 version=1;broken=false;unavailable=false;const profiles=[];const browser=await engine.launch({headless:true,...(name==='Chromium'&&process.env.COMMUNITY_PWA_CHROMIUM?{executablePath:process.env.COMMUNITY_PWA_CHROMIUM}:{}),args:name==='Chromium'?['--no-sandbox']:[]});
 const newContext=async(options)=>{if(name==='Chromium')return browser.newContext(options);const profile=await mkdtemp(path.join(tmpdir(),'ncv-webkit-'));profiles.push(profile);return engine.launchPersistentContext(profile,{...options,headless:true});};
 try{const offline=async(value)=>{unavailable=value;if(name==='Chromium')await context.setOffline(value);};const context=await newContext({viewport:{width:390,height:844},serviceWorkers:'allow',acceptDownloads:true});let page=await context.newPage();
 const unexpected=[];context.on('request',request=>{if(!request.url().startsWith(origin)&&!request.url().startsWith('blob:'))unexpected.push(request.url());});
 const start=Date.now();await page.goto(origin+'#binder');
 await page.evaluate(()=>caches.open('another-pages-app-sentinel'));

 await page.waitForFunction(()=>navigator.serviceWorker.controller,{timeout:30000});
 await page.waitForFunction(()=>document.querySelectorAll('article').length>0);
 if(!await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();return r.scope===location.origin+'/night-city-vault-community/'&&r.active.scriptURL===r.scope+'sw.js';}))throw Error('Pages worker scope');
 console.log(name+' shell and catalog ready ms '+(Date.now()-start));
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 await offline(true);await page.reload();await page.getByRole('button',{name:'Binder',exact:true}).waitFor();
 await page.locator('.card-title').first().click();await page.getByRole('button',{name:'Add 1 copy',exact:true}).click();await page.waitForFunction(()=>document.querySelector('dialog .quantity')?.textContent.includes('1 owned'));
 // Touch keyboard focus and dialog bounds; this does not emulate a physical keyboard.
 await page.setViewportSize({width:390,height:430});await page.locator('dialog input[type=number]').first().focus();if(!await page.locator('dialog input[type=number]').first().evaluate(e=>e===document.activeElement))throw Error('focus');
 await page.setViewportSize({width:390,height:844});const imageStart=Date.now();await page.getByRole('button',{name:'Add Photo',exact:true}).click();await page.getByLabel('Choose photo').setInputFiles('public/icons/vault-192.png');
 await page.getByText('Preview ready. Save to keep this image.',{exact:true}).waitFor();
 await page.getByRole('checkbox',{name:'I understand that this image may be copyrighted.',exact:false}).check();
 await page.getByRole('button',{name:'Save photo',exact:true}).click();
 await page.getByText('Photo saved on this device.',{exact:true}).waitFor();
 console.log(name+' image process and save ms '+(Date.now()-imageStart));await page.getByRole('button',{name:'Close dialog'}).click();
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('mobile overflow');
 await page.getByRole('button',{name:'Settings',exact:true}).click();
 const expected=await storedCollection(page);const backupStart=Date.now();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download full backup',exact:true}).click();const backupBytes=await readFile(await (await download).path());
 console.log(name+' backup ms '+(Date.now()-backupStart)+' bytes '+backupBytes.length);await offline(false);
 // Failed installation leaves the working cached version intact.
 broken=true;version=2;await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});await page.getByText('Your previous offline app is still available.',{exact:false}).first().waitFor();
 await offline(true);await page.reload();await page.getByRole('button',{name:'Binder',exact:true}).waitFor();await offline(false);
 broken=false;version=3;const other=await context.newPage();await other.goto(origin);
 await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();await r.update();});
 await page.waitForFunction(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting);
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByText('App update ready.',{exact:false}).first().waitFor();
 await other.close();if(!await page.evaluate(async()=>!!(await navigator.serviceWorker.getRegistration()).waiting))throw Error('Update activated while editing window open');await page.close();await new Promise(r=>setTimeout(r,500));page=await context.newPage();await page.goto(origin);
 await page.waitForFunction(async()=>{const r=await navigator.serviceWorker.getRegistration();return !r.waiting&&r.active?.state==='activated';});
 if(!await page.evaluate(async()=>(await caches.keys()).includes('ncv-community-night-city-vault-shell-test-3')))throw Error('New shell did not activate');if(await storedCollection(page)!==expected)throw Error('Update changed collection');if(!await page.evaluate(async()=>(await caches.keys()).includes('another-pages-app-sentinel')))throw Error('Deleted sibling cache');if(unexpected.length)throw Error('Unexpected network requests: '+unexpected.join(','));await offline(true);await page.reload();await page.locator('.card-title').first().click();await page.waitForFunction(()=>document.querySelector('dialog .quantity')?.textContent.includes('1 owned'));
 await page.getByRole('button',{name:'Add Photo',exact:true}).click();await page.locator('dialog img[alt="Personal local artwork"]').waitFor();if(!await page.locator('dialog img[alt="Personal local artwork"]').evaluate(e=>e.complete&&e.naturalWidth>0))throw Error('offline artwork');
 console.log('PASS '+name+' production shell installation, offline catalog/mutation/reload/backup, failed cache installation, waiting multi-window update, inventory preservation, 390px focus/layout');
 await context.close();unavailable=false;
 const restored=await newContext({viewport:{width:390,height:844}});const restorePage=await restored.newPage();await restorePage.goto(origin);await restorePage.waitForFunction(()=>navigator.serviceWorker.controller);
 await restorePage.getByRole('button',{name:'Settings',exact:true}).click();
 const restoreStart=Date.now();await restorePage.getByLabel('Backup file',{exact:true}).setInputFiles({name:'disposable-test.ncv',mimeType:'application/octet-stream',buffer:backupBytes});
 await restorePage.getByRole('checkbox',{name:'I understand this replaces my entire current collection and history.'}).check();
 await restorePage.getByRole('button',{name:'Confirm replacement',exact:true}).click();await restorePage.getByText('Restoration complete.',{exact:false}).waitFor();
 if(await storedCollection(restorePage)!==expected)throw Error('Restored bytes differed before leaving Settings');await restorePage.getByRole('button',{name:'Binder',exact:true}).click();await restorePage.locator('.card-title').first().click();await restorePage.waitForFunction(()=>document.querySelector('dialog .quantity')?.textContent.includes('1 owned'));
 await restorePage.getByRole('button',{name:'Add Photo',exact:true}).click();await restorePage.waitForFunction(()=>{const image=document.querySelector('dialog img[alt="Personal local artwork"]');return image?.complete&&image.naturalWidth>0;});
 unavailable=true;await restorePage.reload();await restorePage.waitForFunction(()=>document.querySelector('nav button')&&!document.querySelector('nav button').disabled);await restorePage.locator('.card-title').first().click();await restorePage.waitForFunction(()=>document.querySelector('dialog .quantity')?.textContent.includes('1 owned'));await restorePage.getByRole('button',{name:'Add Photo',exact:true}).click();await restorePage.waitForFunction(()=>{const image=document.querySelector('dialog img[alt="Personal local artwork"]');return image?.complete&&image.naturalWidth>0;});

 if(await storedCollection(restorePage)!==expected)throw Error('Restored inventory, history or media differed');console.log(name+' restore ms '+(Date.now()-restoreStart));await restored.close();console.log('PASS '+name+' media backup Files-input simulation and restoration into empty isolated storage');
 // Uncached first launch cannot use a service worker that has never been installed.
 unavailable=true;const fresh=await newContext({offline:name==='Chromium'});const blank=await fresh.newPage();let failed=false;try{await blank.goto(origin);}catch{failed=true;}if(!failed)throw Error('uncached offline navigation unexpectedly loaded');await fresh.close();console.log('PASS '+name+' uncached offline first launch unavailable');
 }finally{await browser.close();for(const profile of profiles)await rm(profile,{recursive:true,force:true});}
}}finally{await new Promise(r=>server.close(r));}
