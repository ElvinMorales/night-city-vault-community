import {choosePrinting} from './ux-test-controls.mjs';
// DOM interactions exercise the React application on the intercepted test origin.
export async function runUI(send, evaluate, session) {
 const ev = expression => evaluate(session, expression);
 const wait = async expression => {for(let i=0;i<200;i++){if(/querySelectorAll\('article'\)\.length/.test(expression)){await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/^Show 100 more/.test(b.textContent));b?.click();})()`);}if(await ev(expression))return;await new Promise(r=>setTimeout(r,25));}throw new Error('UI wait failed: '+expression+'; '+await ev('document.body?.innerText')); };
 const check = async (expression,message) => {if(!await ev(expression))throw new Error(message);};
 const click = async text => {await ev(`document.querySelectorAll('details').forEach(d=>d.open=true)`);await wait(`[...document.querySelectorAll('button')].some(b=>(b.textContent.trim()===${JSON.stringify(text)}||b.getAttribute('aria-label')===${JSON.stringify(text)}))`);await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>(b.textContent.trim()===${JSON.stringify(text)}||b.getAttribute('aria-label')===${JSON.stringify(text)}));if(!b)throw new Error('Missing button '+document.body.innerText);b.focus();b.click();})()`);};
 const input = async (selector,value) => {if(selector==='dialog select')return choosePrinting(ev,value);if(selector.includes('Inventory filter'))return click(value[0].toUpperCase()+value.slice(1));return ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});const proto=e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);};
 const settled=async()=>{await new Promise(r=>setTimeout(r,30));await wait(`!document.body.textContent.includes('Saving…')`);};
 const print = async () => {await click('Add card version');for(const [k,v] of Object.entries({set:'FABLE',setName:'Imaginary Orchard',number:'007',treatment:'unlisted-fictional-finish',language:'en',evidence:'Fictional physical label'}))await input(`[name="${k}"]`,v);await ev(`(()=>{document.querySelectorAll('dialog details').forEach(d=>d.open=true);document.querySelector('dialog input[type=checkbox][required]').click();})()`);await click('Save printing');await settled();};
 await wait(`document.querySelector('.empty')?.textContent.includes('Your catalog is empty')`);
 await check(`document.querySelector('.local').textContent.includes('No automatic device sync')`,'Missing local notice');
 console.log('PASS UI fresh install has empty catalog and local-only notice');
 await click('Create card');await input('[name="name"]','Clockwork Turnip');await input('[name="aliases"]','Brass Sprout');await click('Save card');await wait(`!document.querySelector('dialog')`);
 await click('Clockwork Turnip');await print();await check(`document.querySelector('dialog').textContent.includes('007')`,'Leading zeroes lost: '+await ev('document.body.innerText'));
 await print();await wait(`document.querySelector('.picker-toggle')?.textContent.includes('unlisted-fictional-finish')`);
 await wait(`document.querySelector('dialog').contains(document.activeElement)`);
 await check(`(await phase2.inspect()).state.printings.length===1&&(await phase2.inspect()).state.printings[0].treatment==='unlisted-fictional-finish'`,'Collision mutated printing or custom treatment was lost');
 console.log('PASS UI manual card, exact printing and identical collision reuse');
 await click('Close');await click('Clockwork Turnip');
 await click('Add 1 copy');await settled();await check(`(await phase2.inspect()).state.lots[0].kind==='unresolved'`,'Unknown became exact');
 await input('dialog select',(await ev(`(await phase2.inspect()).state.printings[0].id`)));
 await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Add 1 copy');for(let i=0;i<10;i++)b.click();})()`);await settled();
 await check(`(await phase2.inspect()).state.lots.reduce((n,l)=>n+l.quantity,0)===2`,'Repeated input duplicated save');
 console.log('PASS UI exact/unresolved holdings and rapid-input guard');
 await ev(`(()=>{const b=[...document.querySelectorAll('dialog button')].find(b=>b.textContent==='−1 copy');b.click();})()`);await settled();
 await click('Close');await click('Undo last action');await settled();await check(`(await phase2.inspect()).state.lots.reduce((n,l)=>n+l.quantity,0)===2`,'Undo failed');
 await check(`![...document.querySelectorAll('button')].some(b=>b.getAttribute('aria-label')==='Undo last action'&&!b.disabled)`,'Undo of undo enabled');
 console.log('PASS UI detail quantity change and guarded undo');
 await click('Clockwork Turnip');await click('Protect 1');await settled();
 await click('Unprotect 1');await settled();
 await check(`(await phase2.inspect()).state.lots.some(l=>l.protectedQty===1)`,'Unprotected without confirmation');
 await ev(`(()=>{document.querySelectorAll('dialog details').forEach(d=>d.open=true);document.querySelector('dialog input[type=checkbox][required]').click();})()`);await click('Unprotect 1');await settled();
 await check(`(await phase2.inspect()).state.lots.every(l=>l.protectedQty===0)`,'Confirmed unprotect failed');await click('Close');
 console.log('PASS UI explicit unprotection confirmation');
 await click('Clockwork Turnip');
 await ev(`(async()=>{const old=BroadcastChannel.prototype.postMessage;try{BroadcastChannel.prototype.postMessage=()=>{};await phase2.externalChange();}finally{BroadcastChannel.prototype.postMessage=old;}})()`);
 await click('Protect 1');await settled();await check(`document.querySelector('dialog [role=alert]').textContent.includes('conflict:')`,'Stale UI editor did not report conflict');
 await check(`(await phase2.inspect()).state.lots.every(l=>l.protectedQty===0)`,'Conflicting edit mutated protection');await click('Close');
 console.log('PASS UI stale revision reports conflict and refreshes baseline');
 await ev(`(()=>{globalThis.originalGetAll=IDBObjectStore.prototype.getAll;globalThis.componentReads=0;IDBObjectStore.prototype.getAll=function(...args){componentReads++;return originalGetAll.apply(this,args);};})()`);
 await input('input[type=search]','Brass Sprout');await check(`document.querySelectorAll('article').length===1`,'Alias search failed');
 await input('input[type=search]','007');await check(`document.querySelectorAll('article').length===1`,'Printing search failed');
 await input('select[aria-label="Inventory filter"]','missing');await check(`document.querySelectorAll('article').length===0`,'Missing filter failed');
 await input('select[aria-label="Inventory filter"]','owned');await check(`document.querySelectorAll('article').length===1`,'Owned filter failed');
 await input('select[aria-label="View"]','list');await check(`!!document.querySelector('section.list article')`,'Compact list unavailable');
 await check(`componentReads===0`,'Search or view issued additional domain reads');await ev(`IDBObjectStore.prototype.getAll=originalGetAll`);
 await click('Pack Desk');await click('Clockwork Turnip');await click('Add 1 copy');await settled();await check(`(await phase2.inspect()).state.lots.reduce((n,l)=>n+l.quantity,0)===3`,'Pack desk add failed');
 await input('dialog select',await ev(`(await phase2.inspect()).state.printings[0].id`));await click('Add 1 copy');await settled();
 await check(`(await phase2.inspect()).state.lots.find(l=>l.kind==='holding').quantity===2`,'Pack Desk exact printing failed');
 await click('Close');await click('Undo last action');await settled();
 console.log('PASS UI binder search, owned/missing filters, compact list and exact/unresolved Pack Desk');
 await ev(`(()=>{globalThis.originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('Fictional disk failure','QuotaExceededError');};})()`);
 await click('Clockwork Turnip');await click('Add 1 copy');await settled();await check(`document.querySelector('[role=alert]').textContent.includes('storage:')`,'Storage error hidden');
 await ev(`IDBObjectStore.prototype.put=originalPut`);await check(`(await phase2.inspect()).state.lots.reduce((n,l)=>n+l.quantity,0)===3`,'Failed save changed copies');
 console.log('PASS UI storage failure reports error and retains inventory');
 await click('Close');await send('Page.reload',{},session);await wait(`document.querySelector('article')?.textContent.includes('3 owned')`);
 console.log('PASS UI actual reload retains correct collection');
 await click('Clockwork Turnip');await ev(`document.querySelector('dialog button').focus()`);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9},session);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9},session);
 await check(`document.querySelector('dialog').contains(document.activeElement)`,'Focus escaped modal');
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},session);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27},session);
 await wait(`!document.querySelector('dialog')`);await check(`document.activeElement.textContent==='Clockwork Turnip'`,'Focus did not return');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},session);
 await check(`document.documentElement.scrollWidth<=390`,'Mobile horizontal overflow');await click('Clockwork Turnip');await check(`document.querySelector('dialog').getBoundingClientRect().width<=390`,'Mobile dialog overflow');await click('Close');
 if(process.env.COMMUNITY_UI_SCREENSHOT){const {data}=await send('Page.captureScreenshot',{format:'png'},session);await (await import('node:fs/promises')).writeFile(process.env.COMMUNITY_UI_SCREENSHOT,Buffer.from(data,'base64'));}
 console.log('PASS UI keyboard focus, Escape, focus return and mobile viewport');
 for(const count of [100,1000]) {
  await ev(`phase2.seed(${count})`);await wait(`document.querySelectorAll('article').length===${count}`);
  const searchStart=Date.now();await input('input[type=search]','Signal 0050');await wait(`document.querySelectorAll('article').length===1`);const searchMs=Date.now()-searchStart;
  await input('input[type=search]','Turnip');await click('Clockwork Turnip');const start=Date.now();await click('Add 1 copy');await settled();const addMs=Date.now()-start;await click('Close');await input('input[type=search]','');
  await ev(`(()=>{globalThis.originalGetAll=IDBObjectStore.prototype.getAll;globalThis.toolReads=0;IDBObjectStore.prototype.getAll=function(...args){toolReads++;return originalGetAll.apply(this,args);};})()`);
  const playStart=Date.now();await click('Playsets');await wait(`document.querySelectorAll('article').length===${count}`);const playsetsMs=Date.now()-playStart;
  const filterStart=Date.now();await input('input[type=search]','Signal 0050');await wait(`document.querySelectorAll('article').length===1`);const playsetSearchMs=Date.now()-filterStart;
  const extrasStart=Date.now();await click('Extras');await wait(`document.querySelectorAll('article').length>=${count-1}`);const extrasMs=Date.now()-extrasStart;
  await check(`toolReads===0`,'Playsets/Extras navigation or search reread IndexedDB');await ev(`IDBObjectStore.prototype.getAll=originalGetAll`);
  console.log('PHASE2B2_BENCHMARK '+JSON.stringify({fictionalCards:count,playsetsMs,playsetSearchMs,extrasMs,viewport:'390x844'}));await click('Binder');
  console.log('UI_BENCHMARK '+JSON.stringify({fictionalCards:count,searchMs,commitAndRefreshMs:addMs,viewport:'390x844',cpuThrottle:1,seededExactPrintingsAndOwnedLots:count-1}));
 }
 await click('Playsets');await input('input[type=search]','Turnip');
 await check(`document.querySelector('article').textContent.includes('Needs classification')`,'Unknown classification hidden');
 await input('[name=keep]','9');await click('Save keep target');await settled();
 await check(`(await phase2.inspect()).state.cards.find(c=>c.name==='Clockwork Turnip').keepTarget===9`,'Keep target not committed');
 await click('Extras');await input('.toolbar select','free');await input('input[type=search]','Turnip');
 await input('article form.lot:last-child [name=trade]','1');await ev(`document.querySelector('article form.lot:last-child button').click()`);await settled();
 await check(`(await phase2.inspect()).state.lots.every(l=>l.forTradeQty===0)`,'Trade changed without confirmation');
 await ev(`document.querySelector('article form.lot:last-child input[type=checkbox]').click()`);await ev(`document.querySelector('article form.lot:last-child button').click()`);await settled();
 await check(`(await phase2.inspect()).state.lots.reduce((n,l)=>n+l.forTradeQty,0)===1`,'Trade marking failed');
 await check(`document.querySelector('textarea').value.includes('Unresolved printing')`,'Unresolved trade export missing');
 await click('Undo last action');await settled();await check(`(await phase2.inspect()).state.lots.every(l=>l.forTradeQty===0)`,'Trade undo failed');
 await input('article form.lot:last-child [name=trade]','1');await ev(`document.querySelector('article form.lot:last-child input[type=checkbox]').click()`);await ev(`document.querySelector('article form.lot:last-child button').click()`);await settled();
 await send('Page.reload',{},session);await wait(`document.querySelectorAll('article').length===1000`);await click('Extras');await input('.toolbar select','trade');
 await check(`document.querySelector('textarea').value.includes('1x Clockwork Turnip')`,'Trade marks lost on reload');
 await ev(`Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true})`);await click('Copy trade text');await check(`document.body.textContent.includes('Copy unavailable')`,'Clipboard failure hidden');await ev(`delete navigator.clipboard`);
 await ev(`(()=>{globalThis.originalObjectURL=URL.createObjectURL;URL.createObjectURL=function(blob){globalThis.tradeDownloadText=blob.text();return originalObjectURL.call(this,blob);};})()`);await click('Download trade CSV');
 await check(`(await tradeDownloadText).includes('Quantity offered')&&(await tradeDownloadText).includes('Unresolved printing')`,'Browser CSV payload missing');await ev(`URL.createObjectURL=originalObjectURL`);
 await input('article form.lot:last-child [name=trade]','0');await ev(`document.querySelector('article form.lot:last-child input[type=checkbox]').click()`);await ev(`document.querySelector('article form.lot:last-child button').click()`);await settled();await check(`(await phase2.inspect()).state.lots.every(l=>l.forTradeQty===0)`,'Clearing trade marks failed');
 await input('.toolbar select','free');await input('input[type=search]','Turnip');

 await check(`document.documentElement.scrollWidth<=390`,'Extras mobile overflow');
 await ev(`document.querySelector('article form.lot:last-child [name=trade]').focus()`);await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9},session);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9},session);
 await check(`document.activeElement.type==='checkbox'`,'Trade keyboard confirmation unreachable');
 console.log('PASS Phase 2B2 keep target, classification, deliberate trade marks, confirmation, undo, export text, persistence, mobile and keyboard');
 await click('Binder');
 const {identifier}=await send('Page.addScriptToEvaluateOnNewDocument',{source:"indexedDB.open=()=>{throw new DOMException('Fictional startup failure','SecurityError');}"},session);
 await send('Page.reload',{},session);await wait(`document.querySelector('h1')?.textContent==='Local storage needs attention'`);
 await check(`document.querySelector('[role=alert]').textContent.includes('Your collection could not open')`,'Startup warning hidden');
 await check(`document.querySelector('main details').textContent.includes('Fictional startup failure')`,'Startup diagnostics missing');
 await send('Page.removeScriptToEvaluateOnNewDocument',{identifier},session);await click('Retry loading');await wait(`document.querySelectorAll('article').length===1000`);
 console.log('PASS UI startup storage failure and retry recovery');
 console.log('11 UI scenario groups passed; 0 failed; 0 blocked');
}

export async function runCatalogUI(send,evaluate,session,newPage){
 const ev=x=>evaluate(session,x);
 const wait=async x=>{for(let i=0;i<400;i++){if(await ev(x))return;await new Promise(r=>setTimeout(r,25));}throw new Error('Catalog UI timeout '+x+' '+await ev('document.body.innerText'));};
 const check=async(x,m)=>{if(!await ev(x))throw new Error(m);};
 const click=async text=>{await ev(`document.querySelectorAll('details').forEach(d=>d.open=true)`);await wait(`[...document.querySelectorAll('button')].some(b=>(b.textContent.trim()===${JSON.stringify(text)}||b.getAttribute('aria-label')===${JSON.stringify(text)})&&!b.disabled)`);await ev(`[...document.querySelectorAll('button')].find(b=>(b.textContent.trim()===${JSON.stringify(text)}||b.getAttribute('aria-label')===${JSON.stringify(text)})).click()`);};
 const input=async(selector,value)=>{if(selector==='dialog select')return choosePrinting(ev,value);if(selector.includes('Inventory filter'))return click(value[0].toUpperCase()+value.slice(1));return ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);};
 await wait('globalThis.phase2');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},session);
 for(const size of [140,500,1000,5000]){
  if(size!==140){session=await newPage();await wait('globalThis.phase2');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},session);}
  const start=Date.now();await ev(`phase2.renderCatalog(${size})`);await wait(`document.querySelector('.section-head .eyebrow')?.textContent.includes('${size} CATALOG CARDS')`);await input('select[aria-label="Set / Edition"]','all');const installAndBinderMs=Date.now()-start;
  await check(`document.querySelectorAll('article').length===100`,'Initial Binder rendering unbounded');
  await ev(`phase2.seedCatalogOwnership()`);await wait(`document.querySelector('article:nth-child(2) .quantity')?.textContent==='8 owned'`);
  await ev(`(()=>{globalThis.catalogOriginalGetAll=IDBObjectStore.prototype.getAll;globalThis.catalogReads=0;IDBObjectStore.prototype.getAll=function(...args){catalogReads++;return catalogOriginalGetAll.apply(this,args);};})()`);
  const searchStart=Date.now();await input('input[type=search]','Catalog 00000');await wait(`document.querySelectorAll('article').length===1`);const searchMs=Date.now()-searchStart;
  const selectionStart=Date.now();await click('Fictional Catalog 00000');await input('dialog select','catalog-print-0');const printingSelectionMs=Date.now()-selectionStart;await check(`catalogReads===0`,'Catalog search or printing selection reread IndexedDB');await ev(`IDBObjectStore.prototype.getAll=catalogOriginalGetAll`);
  const saveStart=Date.now();await click('Add 1 copy');await wait(`document.querySelector('dialog .quantity')?.textContent.includes('1 owned')`);const saveMs=Date.now()-saveStart;await click('Close');
  const playStart=Date.now();await click('Playsets');await wait(`document.querySelectorAll('article').length===100`);const playsetsMs=Date.now()-playStart;
  const extrasStart=Date.now();await click('Extras');await wait(`document.querySelector('h2')?.textContent==='Extras'`);const extrasMs=Date.now()-extrasStart;
  await check(`document.querySelectorAll('article').length<=100`,'Extras unbounded');
  console.log('PHASE2C_UI '+JSON.stringify({size,installAndBinderMs,searchMs,printingSelectionMs,saveMs,playsetsMs,extrasMs,viewport:'390x844'}));
 }
 await click('Binder');await input('input[type=search]','Catalog 00000');await click('Fictional Catalog 00000');
 await click('Add card version');await input('[name=set]','FABLE');await input('[name=setName]','Imaginary Orchard');await input('[name=number]','008');await input('[name=treatment]','regular');await input('[name=language]','en');await input('[name=evidence]','Owner fictional evidence');await ev(`(()=>{document.querySelectorAll('dialog details').forEach(d=>d.open=true);document.querySelector('dialog input[type=checkbox][required]').click();})()`);await click('Save printing');await wait(`document.querySelector('dialog')?.textContent.includes('Manually identified')`);
 const customId=await ev(`(await phase2.inspect()).state.printings.find(p=>p.collectorNumber==='008').id`);await input('dialog select',customId);await click('Add 1 copy');await wait(`document.querySelector('dialog .quantity')?.textContent.includes('2 owned')`);
 await input('dialog select','');await click('Add 1 copy');await wait(`document.querySelector('dialog .quantity')?.textContent.includes('3 owned')`);
 await ev(`document.querySelector('dialog form input[type=checkbox][required]').click()`);await click('Identify copies');await wait(`document.querySelector('dialog .quantity')?.textContent.includes('0 to identify')`);await check(`(await phase2.inspect()).state.lots.reduce((n,l)=>n+l.quantity,0)===39995`,'Reconciliation changed ownership');
 await click('Add card version');for(const [name,value] of Object.entries({set:'FABLE',setName:'Imaginary Orchard',number:'009',treatment:'unknown',language:'en',evidence:'Partial fictional metadata; treatment unknown'}))await input('[name='+name+']',value);await ev(`(()=>{document.querySelectorAll('dialog details').forEach(d=>d.open=true);document.querySelector('dialog input[type=checkbox][required]').click();})()`);await click('Save printing');await wait(`document.querySelector('dialog')?.textContent.includes('Printing details not confirmed')`);await check(`(await phase2.inspect()).state.printings.every(p=>p.collectorNumber!=='009')`,'Unknown treatment became an exact printing');await click('Add copies with unconfirmed details');await wait(`document.querySelector('dialog .quantity')?.textContent.includes('4 owned')`);await click('Close');
 await ev(`phase2.renderCatalog(5000,true)`);await wait(`document.querySelector('.section-head .eyebrow')?.textContent.includes('5000 CATALOG CARDS')`);await click('Settings');await click('Review catalog update');await wait(`document.querySelector('form')?.textContent.includes('catalog-custom-promo')`);
 await check(`document.querySelector('form').textContent.includes('Owner fictional evidence')`,'Review omitted local evidence');
 await input('form select','');await ev(`phase2.externalChange()`);await wait(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Apply reviewed catalog update'&&b.disabled)`);await check(`document.body.textContent.includes('Collection changed. Cancel and reopen this review.')`,'Stale catalog review not reported');await click('Cancel catalog review');await click('Review catalog update');
 const local=await ev(`(await phase2.inspect()).state.printings.find(p=>p.collectorNumber==='008').id`);await input('form select',local);await ev(`document.querySelector('form input[type=checkbox][required]').click()`);
 const reconcileStart=Date.now();await click('Apply reviewed catalog update');await wait(`!document.querySelector('form select')`);const reconcileMs=Date.now()-reconcileStart;
 await check(`(await phase2.inspect()).state.printings.find(p=>p.id===${JSON.stringify(local)}).providerMaps.some(m=>m.externalId==='catalog-custom-promo')`,'Custom adoption missing');await check(`(await phase2.inspect()).state.lots.reduce((n,l)=>n+l.quantity,0)===39996`,'Adoption changed ownership');await check(`document.documentElement.scrollWidth<=390`,'Catalog review overflow');
 console.log('PASS Phase 2C catalog installation, bounded rendering, exact/unknown/provisional/custom workflows, cancellation and explicit adoption; reconciliation ms '+reconcileMs);
}

export async function runArchiveUI(send,evaluate,session){
 const ev=x=>evaluate(session,x);
 const wait=async x=>{for(let i=0;i<400;i++){if(await ev(x))return;await new Promise(r=>setTimeout(r,25));}throw Error('Archive UI timeout '+x+' '+await ev('document.body.innerText'));};
 const click=async text=>{await ev(`document.querySelectorAll('details').forEach(d=>d.open=true)`);await wait(`[...document.querySelectorAll('button')].some(b=>(b.textContent.trim()===${JSON.stringify(text)}||b.getAttribute('aria-label')===${JSON.stringify(text)})&&!b.disabled)`);await ev(`[...document.querySelectorAll('button')].find(b=>(b.textContent.trim()===${JSON.stringify(text)}||b.getAttribute('aria-label')===${JSON.stringify(text)})).click()`);};
 const input=async(selector,value)=>{if(selector==='dialog select')return choosePrinting(ev,value);if(selector.includes('Inventory filter'))return click(value[0].toUpperCase()+value.slice(1));return ev(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);};
 await wait('globalThis.phase2');const start=Date.now();await ev('phase2.renderRealCatalog()');await wait(`document.querySelector('.section-head .eyebrow')?.textContent.includes('151 CATALOG CARDS')&&!document.body.textContent.includes('Saving…')`);const installAndBinderMs=Date.now()-start;
 if(!await ev(`(await phase2.inspect()).state.lots.length===0&&document.querySelectorAll('article').length===100`))throw Error('Fresh real catalog not zero-owned or rendering unbounded');
 if(!await ev(`document.querySelector('select[aria-label="Set / Edition"]').value==='retail'`))throw Error('Retail English is not default');
 for(const context of ['retail','beta','special','languages','all']){
  await input('select[aria-label="Set / Edition"]',context);
  if(!await ev(`(async()=>{const s=(await phase2.inspect()).state,context=${JSON.stringify(context)},eligible=p=>context==='all'||(context==='retail'?p.setCode==='welcometonightcityretail'&&p.language==='en':context==='beta'?p.setCode.includes('beta'):context==='special'?p.isPromo||/promo|special|iconic/i.test(p.setCode+' '+p.treatment):p.language!=='en');const names=new Set(s.cards.filter(c=>s.printings.some(p=>p.gameplayCardId===c.id&&eligible(p))).map(c=>c.name));const tiles=[...document.querySelectorAll('article')];return tiles.length===Math.min(100,names.size)&&tiles.every(t=>names.has(t.querySelector('.card-title').textContent));})()`))throw Error('Set / Edition incorrect: '+context);
 }
 await input('select[aria-label="Set / Edition"]','retail');await input('input[type=search]','Minotaur');await wait(`document.querySelectorAll('article').length===0`);await input('select[aria-label="Set / Edition"]','all');await wait(`document.querySelectorAll('article').length===1`);await click('Minotaur');const outsideId=await ev(`(async()=>{const s=(await phase2.inspect()).state;return s.printings.find(p=>p.gameplayCardId===s.cards.find(c=>c.name==='Minotaur').id).id;})()`);
 await input('dialog select',outsideId);await click('Add 1 copy');await wait(`document.querySelector('dialog .quantity')?.textContent.includes('1 owned')`);await click('Close');await input('select[aria-label="Set / Edition"]','retail');await input('select[aria-label="Inventory filter"]','owned');await wait(`document.querySelector('article .card-title')?.textContent==='Minotaur'`);await click('Undo last action');await input('select[aria-label="Inventory filter"]','all');await input('select[aria-label="Set / Edition"]','all');await input('input[type=search]','');
 console.log('PASS Retail English default, all five catalog contexts, outside-set search and owned printing discoverability');
 const searchStart=Date.now();await input('input[type=search]','V: Streetkid');await wait(`document.querySelectorAll('article').length===1`);const searchMs=Date.now()-searchStart;
 const selectionStart=Date.now();await click('V: Streetkid');const printingId=await ev(`(async()=>{const s=(await phase2.inspect()).state;return s.printings.find(p=>p.collectorNumber==='005a'&&p.setCode==='welcometonightcityretail'&&p.gameplayCardId===s.cards.find(c=>c.name==='V: Streetkid').id)?.id;})()`);await input('dialog select',printingId);const printingSelectionMs=Date.now()-selectionStart;
 const saveStart=Date.now();await click('Add 1 copy');await wait(`document.querySelector('dialog .quantity')?.textContent.includes('1 owned')`);const saveMs=Date.now()-saveStart;await click('Close');
 await input('input[type=search]','β005a');await wait(`document.querySelectorAll('article').length===1`);
 await click('Pack Desk');await input('input[type=search]','V: Streetkid');await click('V: Streetkid');await input('dialog select',printingId);await click('Add 1 copy');await wait(`document.querySelector('article .quantity')?.textContent==='2 owned'`);await input('dialog select','');await click('Add 1 copy');await wait(`document.querySelector('article .quantity')?.textContent==='3 owned'`);
 await click('Close');const playStart=Date.now();await click('Playsets');await wait(`document.querySelector('h2')?.textContent==='Playsets'`);const playsetsMs=Date.now()-playStart;
 const extrasStart=Date.now();await click('Extras');await wait(`document.querySelector('h2')?.textContent==='Extras'`);const extrasMs=Date.now()-extrasStart;
 await send('Page.reload',{},session);await wait('globalThis.phase2');await ev('phase2.renderRealCatalog()');await wait(`document.querySelector('.section-head .eyebrow')?.textContent.includes('151 CATALOG CARDS')`);if(!await ev(`(await phase2.inspect()).state.lots.reduce((n,l)=>n+l.quantity,0)===3`))throw Error('Real catalog reload lost ownership');
 console.log('ARCHIVE_UI '+JSON.stringify({cards:151,printings:860,installAndBinderMs,searchMs,printingSelectionMs,saveMs,playsetsMs,extrasMs}));
 console.log('PASS real-card Binder, collector search, printing selection, Pack Desk known/unknown, Playsets/Extras and reload');
}
