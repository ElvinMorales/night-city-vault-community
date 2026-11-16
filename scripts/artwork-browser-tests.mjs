export async function runArtwork(send,evaluate,session){
 const ev=e=>evaluate(session,e);
 const wait=async e=>{for(let i=0;i<500;i++){if(await ev(e))return;await new Promise(r=>setTimeout(r,25));}throw new Error('Artwork UI timeout: '+e+' '+await ev('document.body.innerText'));};
 const click=async text=>{await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>(b.textContent.trim()===${JSON.stringify(text)}||b.getAttribute('aria-label')===${JSON.stringify(text)}));if(!b||b.disabled)throw new Error('Unavailable '+${JSON.stringify(text)});b.click();})()`);};
 const input=async(selector,value)=>ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await wait('!!document.querySelector("nav")');await click('Create card');await input('[name=name]','Fictional Neon Lantern');await click('Save card');await wait('!document.querySelector("dialog")');await click('Fictional Neon Lantern');await click('Add Photo');
 await ev(`(()=>{globalThis.created=[];globalThis.revoked=[];const create=URL.createObjectURL,revoke=URL.revokeObjectURL;URL.createObjectURL=b=>{const u=create(b);created.push({url:u,size:b.size});return u;};URL.revokeObjectURL=u=>{revoked.push(u);return revoke(u);};})()`);
 await ev(`(async()=>{const c=document.createElement('canvas');c.width=900;c.height=1260;const x=c.getContext('2d');x.fillStyle='#6548a2';x.fillRect(0,0,c.width,c.height);x.fillStyle='white';x.font='50px sans-serif';x.fillText('FICTIONAL LANTERN',20,90);const blob=await new Promise(r=>c.toBlob(r,'image/png'));globalThis.syntheticImage=blob;const dt=new DataTransfer();dt.items.add(new File([blob],'fictional.png',{type:'image/png'}));const f=document.querySelector('dialog input[type=file]');f.files=dt.files;f.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await wait(`document.querySelector('img[alt="Unsaved personal artwork preview"]')?.complete`);
 if(!await ev(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Save photo').disabled`))throw new Error('Acknowledgment bypassed');
 await ev(`document.querySelector('[aria-label="Personal artwork"] input[type=checkbox]').click()`);
 await click('Save photo');await wait(`document.body.textContent.includes('Photo saved on this device.')`);
 await click('Close');await wait(`document.querySelector('article img')?.naturalWidth>0`);
 if(!await ev(`created.some(x=>x.size>0)&&revoked.length>0&&document.querySelector('article img').naturalWidth<=320`))throw new Error('Thumbnail or URL cleanup missing');
 console.log('PASS Artwork UI generated file selection, preview, acknowledgment, committed persistence, thumbnail and URL cleanup');
 await send('Page.reload',{},session);await wait(`document.querySelector('article img')?.naturalWidth>0`);
 await click('Settings');await wait(`document.body.textContent.includes('1 photo saved on this device')`);await ev(`(()=>{globalThis.artDownloads=[];globalThis.artBlobs=new Map();const create=URL.createObjectURL;URL.createObjectURL=b=>{const u=create(b);artBlobs.set(u,b);return u;};HTMLAnchorElement.prototype.click=function(){artDownloads.push({filename:this.download,blob:artBlobs.get(this.href)});};})()`);
 await click('Download full backup');await wait('artDownloads.length===1');
 if(!await ev(`(await mediaPortability.parsePortable(artDownloads[0].blob)).media.entries.length===1`))throw new Error('Image bytes absent from UI backup');
 await click('Fictional Neon Lantern · photos');await wait(`document.querySelector('dialog img')?.naturalWidth>0`);
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},session);
 if(!await ev('document.documentElement.scrollWidth<=390'))throw new Error('Artwork mobile overflow');
 await ev(`document.querySelector('dialog input[type=file]').focus()`);await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9},session);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9},session);
 if(!await ev(`document.querySelector('dialog').contains(document.activeElement)`))throw new Error('Artwork keyboard focus escaped');
 await click('Remove photo');await wait(`document.body.textContent.includes('Photo removed.')`);await click('Close');await click('Binder');await wait(`!document.querySelector('article img')`);
 console.log('PASS Artwork UI reload, Settings library, keyboard, 390px mobile layout, deletion and placeholder fallback');
 await click('Settings');await ev(`(()=>{const dt=new DataTransfer();dt.items.add(new File([artDownloads[0].blob],'fictional.ncv'));const f=document.querySelector('.data-management input[type=file]');f.files=dt.files;f.dispatchEvent(new Event('change',{bubbles:true}));})()`);await wait(`!!document.querySelector('[aria-label="Restore preview"]')`);await ev(`document.querySelector('.data-management .check input').click()`);await click('Confirm replacement');await wait(`document.body.textContent.includes('Restoration complete.')`);await click('Binder');await wait(`document.querySelector('article img')?.naturalWidth>0`);
 console.log('PASS Artwork UI complete binary download, worker validation, atomic restore and recovered Binder thumbnail');
 if(process.env.COMMUNITY_ARTWORK_BENCHMARK==='1')for(const count of [10,100,500]){
  await ev(`artworkUI.seedArtworkUI(${count})`);await wait(`document.querySelector('.section-head .eyebrow')?.textContent.includes('${count} CATALOG CARDS')`);
  await click('Settings');const start=Date.now();await click('Binder');await wait(`document.querySelectorAll('article').length===${Math.min(count,100)}`);const binderMs=Date.now()-start;
  const load=Date.now();await wait(`document.querySelector('article img')?.naturalWidth>0`);const thumbnailMs=Date.now()-load;
  const metrics=await ev(`(()=>({loadedThumbnails:[...document.querySelectorAll('article img')].filter(i=>i.naturalWidth>0).length,maxDecodedWidth:Math.max(...[...document.querySelectorAll('article img')].map(i=>i.naturalWidth)),heapBytes:performance.memory?.usedJSHeapSize}))()`);
  console.log('ARTWORK_BINDER_BENCHMARK '+JSON.stringify({count,binderMs,thumbnailMs,renderedCards:Math.min(count,100),...metrics}));
 }

}
