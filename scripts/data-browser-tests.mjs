export async function runData(send,evaluate,session,createPage) {
 const ev=e=>evaluate(session,e);
 const wait=async expression=>{for(let i=0;i<2400;i++){if(await ev(expression))return;await new Promise(r=>setTimeout(r,25));}throw new Error('Data UI timeout: '+expression+'; '+await ev('document.body.innerText'));};
 const check=async(e,m)=>{if(!await ev(e))throw new Error(m);};
 const click=async text=>{await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b||b.disabled)throw new Error('Button unavailable: '+${JSON.stringify(text)});b.click();})()`);};
 const file=async source=>{await ev(`(()=>{const dt=new DataTransfer();dt.items.add(new File([${JSON.stringify(source)}],'fiction.json',{type:'application/json'}));const input=document.querySelector('input[type=file]');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);};
 await wait('!!globalThis.portability && !!document.querySelector("nav")');await click('Settings');
 await ev(`(()=>{globalThis.downloads=[];globalThis.blobs=new Map();const original=URL.createObjectURL;URL.createObjectURL=b=>{const u=original(b);blobs.set(u,b);return u;};const nativeClick=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){downloads.push({filename:this.download,blob:blobs.get(this.href)});nativeClick.call(this);};})()`);
 await click('Download full backup');await wait('downloads.length===1');
 await check(`downloads[0].filename.includes('community-media@3') && (await mediaPortability.parsePortable(downloads[0].blob)).backup.format==='community-backup@2'`,'Backup download format missing');
 console.log('PASS Data UI full backup download with format and timestamp');
 // Small fixture has real audit/replay history, sealed lots and protected inventory.
 await ev(`portability.fixture(2,'fiction-data-source')`);
 const source=await ev(`portability.exportDatabase('fiction-data-source')`);
 await file(source);await wait(`!!document.querySelector('[aria-label="Restore preview"]')`);
 await check(`document.body.textContent.includes('208 history entries · 208 replay records')`,'Incomplete preview');
 await click('Cancel restore');await check(`(await portability.archive()).state.cards.length===0`,'Cancelled preview changed collection');
 await file(source);await wait(`!!document.querySelector('[aria-label="Restore preview"]')`);
 await ev(`document.querySelector('.check input').click()`);await click('Confirm replacement');await wait(`document.body.textContent.includes('Restoration complete.')`);
 await check(`(()=>{return portability.archive().then(a=>['state','events','operations','batches'].every(k=>portability.canonical(a[k])===portability.canonical(JSON.parse(${JSON.stringify(source)}).archive[k])));})()`,'Full UI restore mismatch');
 await ev(`document.querySelectorAll('details').forEach(d=>d.open=true)`);await click('Download latest recovery backup');await wait('downloads.length===2');
 await check(`(await mediaPortability.parsePortable(downloads[1].blob)).backup.archive.state.cards.length===0`,'Recovery did not preserve pre-restore collection');
 console.log('PASS Data UI complete restore into fresh profile, audit/replay records and retained recovery download');
 const before=await ev(`portability.canonical((await portability.archive()).state)`);
 for(const invalid of ['{broken',source.replace('community-backup@2','community-backup@9'),source.replace('Fictional port card','Corrupted port card')]) {
  await file(invalid);await wait(`!!document.querySelector('.data-management [role=alert]')`);
  await check(`portability.canonical((await portability.archive()).state)===${JSON.stringify(before)}`,'Invalid file modified inventory');
 }
 console.log('PASS Data UI invalid, corrupt and unsupported backups preserve collection');
 await ev(`(()=>{globalThis.NativeWorker=Worker;globalThis.Worker=class extends NativeWorker {constructor(...args){super(...args);globalThis.cancelledWorker=this;}};})()`);
 await file(source);await click('Cancel operation');
 await ev(`(()=>{cancelledWorker.dispatchEvent(new MessageEvent('message',{data:{type:'restored'}}));globalThis.Worker=NativeWorker;})()`);
 await check(`document.body.textContent.includes('Cancelled before replacement') && !document.querySelector('[aria-label="Restore preview"]')`,'Validation cancellation failed');
 await ev(`(()=>{globalThis.NativeWorker=Worker;globalThis.Worker=class extends NativeWorker {postMessage(){setTimeout(()=>{this.dispatchEvent(new ErrorEvent('error',{message:'Fictional worker interruption',cancelable:true}));this.terminate();},0);}};})()`);
 await file(source);await wait(`document.body.textContent.includes('worker stopped unexpectedly')`);await ev('globalThis.Worker=NativeWorker');
 await check(`portability.canonical((await portability.archive()).state)===${JSON.stringify(before)}`,'Interrupted validation changed inventory');
 await ev(`(()=>{globalThis.originalBlobURL=URL.createObjectURL;URL.createObjectURL=()=>{throw new Error('Fictional download blocked');};})()`);
 await click('Download full backup');await wait(`document.body.textContent.includes('Download could not start')`);await ev('URL.createObjectURL=originalBlobURL');
 console.log('PASS Data UI validation cancellation, worker interruption and download failure');

 await file(source);await wait(`!!document.querySelector('[aria-label="Restore preview"]')`);
 await ev(`phase2.externalChange()`);await wait(`document.body.textContent.includes('Collection changed since preview')`);
 await check(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Confirm replacement').disabled`,'Stale confirmation enabled');await click('Cancel restore');
 console.log('PASS Data UI stale preview and explicit cancellation');
 // Faults are confined to a test worker. Use the production protocol and contracts.
 await ev(`(()=>{globalThis.workerRun=async(source,{fault='',cancel=false,changeAtReady=false,database='fiction-data-fault',legacy=false}={})=>{
  const w=fault?portability.faultWorker():portability.createDataWorker();const messages=[];
  return new Promise((resolve,reject)=>{w.onerror=e=>{w.terminate();reject(new Error(e.message));};w.onmessage=async e=>{const d=e.data;messages.push(d.type+':'+(d.stage??d.message??''));if(d.type==='preview')w.postMessage({type:'restore',fault});if(d.type==='ready'){if(cancel){w.terminate();resolve({type:'cancelled',messages});}else {if(changeAtReady)await phase2.externalChange();w.postMessage({type:'commit'});}}if(d.type==='error'||d.type==='restored'){w.terminate();resolve({type:d.type,message:d.message,messages});}};w.postMessage({type:'preview',database,file:new File([source],'fiction.json'),fault});});};})()`);
 const legacy=await ev(`portability.legacy(${JSON.stringify(source)})`);
 await check(`(await workerRun(${JSON.stringify(legacy)},{database:'fiction-data-legacy'})).type==='restored'`,'Worker legacy restore failed');
 for(const fault of ['recovery','readback','commit']) {
  const database='fiction-fail-'+fault;
  await check(`(await workerRun(${JSON.stringify(source)},{fault:${JSON.stringify(fault)},database:${JSON.stringify(database)}})).type==='error'`,'Failure reported success: '+fault);
  await check(`(await portability.archive(${JSON.stringify(database)})).state.cards.length===0`,'Fault modified collection: '+fault);
 }
 await check(`(await workerRun(${JSON.stringify(source)},{cancel:true})).type==='cancelled' && (await portability.archive('fiction-data-fault')).state.cards.length===0`,'Boundary cancellation changed collection');
 console.log('PASS Data workers legacy compatibility, recovery quota failure, atomic commit abort and cancellation at commit boundary');
 // Force an inventory write after preview while suppressing notification delivery.
 await ev(`(()=>{globalThis.conflictWorker=portability.createDataWorker();globalThis.conflictResult='';conflictWorker.onmessage=async e=>{if(e.data.type==='preview'){await phase2.externalChange();conflictWorker.postMessage({type:'restore'});}if(e.data.type==='ready')conflictWorker.postMessage({type:'commit'});if(e.data.type==='error'){conflictResult=e.data.message;conflictWorker.terminate();}};conflictWorker.postMessage({type:'preview',file:new File([${JSON.stringify(source)}],'fiction.json')});})()`);
 await wait(`conflictResult.includes('Collection changed since preview')`);
 console.log('PASS Data worker authoritative revision conflict even without UI preview guard');
 await check(`(await workerRun(${JSON.stringify(source)},{changeAtReady:true,database:'community-collection-local'})).type==='error'`,'Write racing recovery retention bypassed atomic revision check');
 console.log('PASS Data worker concurrent edit after recovery retention rejects atomic replacement');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true},session);
 await check('document.documentElement.scrollWidth<=390','Data mobile overflow');
 await ev(`[...document.querySelectorAll('button')].find(b=>b.textContent==='Download full backup').focus()`);
 for(let i=0;i<3;i++){await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9},session);await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9},session);}
 await check(`document.activeElement.type==='file'`,'Data keyboard navigation failed');
 console.log('PASS Data UI keyboard navigation and 390px mobile viewport');
 // A separate isolated browser context receives the actual exported backup via the UI.
 const fresh=await createPage();
 await evaluate(fresh,`globalThis.freshSource=${JSON.stringify(source)}`);
 for(let i=0;i<200;i++){if(await evaluate(fresh,'!!document.querySelector("nav")'))break;await new Promise(r=>setTimeout(r,25));}
 await evaluate(fresh,`(()=>{[...document.querySelectorAll('button')].find(b=>b.textContent==='Settings').click();})()`);
 await evaluate(fresh,`(()=>{const dt=new DataTransfer();dt.items.add(new File([freshSource],'fiction.json'));const input=document.querySelector('input[type=file]');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 for(let i=0;i<200;i++){if(await evaluate(fresh,'!!document.querySelector(".check input")'))break;await new Promise(r=>setTimeout(r,25));}
 await evaluate(fresh,`(()=>{document.querySelector('.check input').click();})()`);
 await evaluate(fresh,`(()=>{[...document.querySelectorAll('button')].find(b=>b.textContent==='Confirm replacement').click();})()`);
 for(let i=0;i<1000;i++){if(await evaluate(fresh,`document.body.textContent.includes('Restoration complete.')`))break;await new Promise(r=>setTimeout(r,25));}
 if(!await evaluate(fresh,`(await portability.archive()).events.length===208 && document.body.textContent.includes('Restoration complete.')`))throw new Error('Isolated profile restore failed');
 console.log('PASS Data UI full restoration in separate isolated browser profile');
 await ev(`portability.fixture(100,'fiction-data-responsive')`);
 const responsiveSource=await ev(`portability.exportDatabase('fiction-data-responsive')`);
 await ev(`(()=>{globalThis.heartbeats=0;globalThis.maxHeartbeatGap=0;let last=performance.now();globalThis.heartbeat=setInterval(()=>{const now=performance.now();maxHeartbeatGap=Math.max(maxHeartbeatGap,now-last);last=now;heartbeats++;},16);})()`);
 await file(responsiveSource);await wait(`!!document.querySelector('[aria-label="Restore preview"]')`);
 await ev('clearInterval(heartbeat)');
 await check('heartbeats>5 && maxHeartbeatGap<250','Validation blocked the UI heartbeat');
 await click('Cancel restore');
 console.log('PASS Data UI expensive validation keeps browser heartbeat responsive');
 const observer=await createPage(session);
 for(let i=0;i<200;i++){if(await evaluate(observer,`document.querySelectorAll('article').length===2`))break;await new Promise(r=>setTimeout(r,25));}
 await evaluate(observer,`document.querySelector('button[aria-label="Recent Activity"]').click()`);
 if(!await evaluate(observer,`document.querySelector('.activity-list').textContent.includes('Card details saved')`))throw new Error('Observer did not load pre-restore history');
 await file(responsiveSource);await wait(`!!document.querySelector('[aria-label="Restore preview"]')`);await ev(`document.querySelector('.check input').click()`);await click('Confirm replacement');await wait(`document.body.textContent.includes('Restoration complete.')`);
 for(let i=0;i<400;i++){if(await evaluate(observer,`document.querySelectorAll('article').length===100 && !document.querySelector('.activity-list').textContent.includes('Card details saved')`))break;await new Promise(r=>setTimeout(r,25));}
 if(!await evaluate(observer,`document.querySelectorAll('article').length===100 && !document.querySelector('.activity-list').textContent.includes('Card details saved')`))throw new Error('Cross-tab restore left old inventory or history visible');
 console.log('PASS Data UI cross-tab restore reloads inventory and replaces the old history cache');


}
export async function benchmarkData(evaluate,session) {
 const ev=e=>evaluate(session,e);
 await ev(`(()=>{globalThis.measureWorker=async(message,w=portability.createDataWorker())=>{
  let last=performance.now(),maxGapMs=0,ticks=0;const start=last;
  const timer=setInterval(()=>{const now=performance.now();maxGapMs=Math.max(maxGapMs,now-last);last=now;ticks++;},16);
  return new Promise((resolve,reject)=>{w.onerror=e=>{clearInterval(timer);w.terminate();reject(new Error(e.message));};w.onmessage=e=>{const d=e.data;if(d.type==='ready')w.postMessage({type:'commit'});if(d.type==='error'){clearInterval(timer);w.terminate();reject(new Error(d.message));}if(['export','preview','restored'].includes(d.type)){clearInterval(timer);resolve({w,data:d,ms:Math.round(performance.now()-start),ticks,maxGapMs:Math.round(maxGapMs)});}};w.postMessage(message);});};})()`);
 for(const count of [100,1000,5000]) {
  await ev(`portability.fixture(${count},'fiction-port-bench-${count}')`);
  const results=await ev(`(async()=>{
   const ex=await measureWorker({type:'export',database:'fiction-port-bench-${count}'});ex.w.terminate();
   const source=ex.data.source;
   const validation=await measureWorker({type:'preview',database:'fiction-port-target-${count}',file:new File([source],'fiction.json')});
   const restoration=await measureWorker({type:'restore'},validation.w);restoration.w.terminate();
   const original=await portability.archive('fiction-port-bench-${count}'),restored=await portability.archive('fiction-port-target-${count}');
   for(const k of ['state','events','batches','operations'])if(portability.canonical(original[k])!==portability.canonical(restored[k]))throw new Error('Benchmark mismatch: '+k);
   return {recordsPerKind:${count},historyOperations:original.operations.length,backupBytes:new Blob([source]).size,export:{ms:ex.ms,ticks:ex.ticks,maxGapMs:ex.maxGapMs},validation:{ms:validation.ms,ticks:validation.ticks,maxGapMs:validation.maxGapMs},restore:{ms:restoration.ms,ticks:restoration.ticks,maxGapMs:restoration.maxGapMs}};
  })()`);
  if(results.validation.ticks<5||results.validation.maxGapMs>=250||results.restore.maxGapMs>=250)throw new Error('Worker responsiveness regression');
  console.log('DATA_BENCHMARK '+JSON.stringify(results));
 }
}
