// Explicit test-only entry; never imported by the production application.
import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { App } from '../../src/ui/App';
import { release } from '../fixtures/catalog';
const root=createRoot(document.getElementById('root')!);
root.render(createElement(App,{catalog:null}));
let catalogRender=0;
function renderCatalog(size:number,variant=false){const r=release(variant?1:size,variant?'fiction-promo-2':`fiction-${size}`);if(variant){r.printings.push({...r.printings[0],id:'catalog-custom-promo',collectorNumber:'008'});r.evidence.push({...r.evidence[1],id:'catalog-custom-promo'});}root.render(createElement(App,{key:++catalogRender,catalog:r}));}
import { IndexedDBRepository, prepareCommand } from '../../src/storage/indexeddb/repository';
import { card, printing, lot } from '../fixtures/fictional';
async function inspect() {const r=await IndexedDBRepository.open();try{return await r.archive();}finally{r.close();}}
async function seed(count:number) {
 const open=indexedDB.open('community-collection-local');
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{open.onsuccess=()=>resolve(open.result);open.onerror=()=>reject(open.error);});
 const tx=db.transaction(['cards','printings','lots','aliases','meta'],'readwrite');
 const meta=tx.objectStore('meta');const current=meta.get('state');current.onsuccess=()=>meta.put({...current.result,revision:current.result.revision+1});meta.delete('archiveBytes');
 for(let i=0;i<count-1;i++) {
  const id=`scale-${i}`,name=`Fictional Signal ${String(i).padStart(4,'0')}`;
  tx.objectStore('cards').put({...card,id,name});
  const p={...printing,id,gameplayCardId:id};
  tx.objectStore('printings').put({...p,identity:JSON.stringify([id,p.setCode,p.collectorNumber,p.treatment,p.language])});
  const {allocatedQty:_,...stored}=lot;
  tx.objectStore('lots').put({...stored,id,gameplayCardId:id,printingId:id,protectedQty:0,forTradeQty:0});
  const normalized=name.toLowerCase();tx.objectStore('aliases').put({id:JSON.stringify([id,normalized]),cardId:id,normalized});
 }
 await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
 window.dispatchEvent(new Event('focus'));
}
async function seedCatalogOwnership(){
 const r=await IndexedDBRepository.open();const snapshot=await r.readSnapshot();r.close();
 const open=indexedDB.open('community-collection-local');const db=await new Promise<IDBDatabase>(resolve=>open.onsuccess=()=>resolve(open.result));const tx=db.transaction(['lots','meta'],'readwrite');
 for(const c of snapshot.cards.filter(c=>c.id!=='catalog-card-0')){const p=snapshot.printings.find(p=>p.gameplayCardId===c.id)!;const {allocatedQty:_,...stored}=lot;tx.objectStore('lots').put({...stored,id:`owned-${c.id}`,gameplayCardId:c.id,printingId:p.id,protectedQty:0,forTradeQty:0});}
 const meta=tx.objectStore('meta'),q=meta.get('state');q.onsuccess=()=>meta.put({...q.result,revision:q.result.revision+1});meta.delete('archiveBytes');await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();window.dispatchEvent(new Event('focus'));
}
async function externalChange() {
 const r=await IndexedDBRepository.open();try{const s=await r.readSnapshot();const current=s.cards[0];return await r.execute(await prepareCommand(crypto.randomUUID(),{type:'save-card',card:current},[{entity:'cards',id:current.id,version:current.version},{entity:'revision',id:'collection',version:s.revision}]));}finally{r.close();}
}
Object.assign(globalThis,{phase2:{inspect,seed,externalChange,renderCatalog,seedCatalogOwnership,renderRealCatalog:()=>root.render(createElement(App,{key:++catalogRender}))}});
import { createDataWorker } from '../../src/data-management/client';
import { canonical, digest, patchState, type Archive } from '../../src/storage/state';
import { exportBackup } from '../../src/interchange/backup';
import { latestRecovery } from '../../src/data-management/recovery';
async function fixture(count:number,database:string) {
 const r=await IndexedDBRepository.open(database);r.close();
 const q=indexedDB.open(database);const db=await new Promise<IDBDatabase>(resolve=>q.onsuccess=()=>resolve(q.result));
 const tx=db.transaction(['cards','printings','lots'],'readwrite');
 for(let i=0;i<count;i++) {
  const id=`fiction-scale-${i}`;
  tx.objectStore('cards').put({...card,id,name:`Fictional port card ${i}`});
  tx.objectStore('printings').put({...printing,id,gameplayCardId:id,identity:JSON.stringify([id,printing.setCode,printing.collectorNumber,printing.treatment,printing.language])});
  const {allocatedQty:_,...stored}=lot;
  tx.objectStore('lots').put({...stored,id,gameplayCardId:id,printingId:id,isSealed:i%2===0,protectedQty:1,forTradeQty:1});
 }
 await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
 const repo=await IndexedDBRepository.open(database);
 try {
  // 208 audit/replay rows match the prior benchmark history volume.
  for(let i=0;i<208;i++) {
   const result=await repo.execute(await prepareCommand(`fiction-port-op-${i}`,{type:'quick-add',cardId:`fiction-scale-${i%count}`,printingId:null,quantity:1,isSealed:false}));
   if(!result.ok)throw new Error(result.message);
  }
 }finally{repo.close();}
}
async function legacy(source:string) {
 const b=JSON.parse(source),a=b.archive as Archive;
 let current=structuredClone(a.state);
 for(const batch of [...a.batches].sort((x,y)=>y.revision-x.revision)) {
  const before=patchState(current,batch.after,batch.before);
  batch.after=current;batch.before=before;delete batch.format;delete batch.legacyUndo;current=before;
 }
 const {checksum:_,...body}={...b,format:'community-backup@1',schemaVersion:2};
 return canonical({...body,checksum:await digest(body)});
}
Object.assign(globalThis,{portability:{createDataWorker,faultWorker:()=>new Worker(new URL('./fault-worker.ts',import.meta.url),{type:'module'}),fixture,legacy,canonical,latestRecovery,exportDatabase:async(name:string)=>{const r=await IndexedDBRepository.open(name);try{return await exportBackup(r);}finally{r.close();}},archive:async(name?:string)=>{const r=await IndexedDBRepository.open(name);try{return await r.archive();}finally{r.close();}}}});

import {parsePortable,exportPortable} from '../../src/interchange/mediaBackup';
Object.assign(globalThis,{mediaPortability:{parsePortable,exportPortable}});
import {processImage,ACKNOWLEDGMENT,type PersonalArtwork} from '../../src/artwork/media';
async function seedArtworkUI(count:number){
 const repo=await IndexedDBRepository.open();let s=await repo.readSnapshot();
 for(let i=s.cards.length;i<count;i++){const result=await repo.execute(await prepareCommand(crypto.randomUUID(),{type:'save-card',card:{...card,id:`art-ui-${i}`,name:`Fictional Image ${String(i).padStart(4,'0')}`}}));if(!result.ok)throw new Error(result.message);}
 s=await repo.readSnapshot();
 const q=indexedDB.open('community-collection-local'),db=await new Promise<IDBDatabase>(resolve=>q.onsuccess=()=>resolve(q.result));
 for(let i=0;i<s.cards.length;i++){
  const canvas=new OffscreenCanvas(600,840),context=canvas.getContext('2d')!;context.fillStyle=`hsl(${i*37%360} 50% 45%)`;context.fillRect(0,0,600,840);context.fillStyle='white';context.font='36px sans-serif';context.fillText(`FICTIONAL ${i}`,20,80);const image=await processImage(await canvas.convertToBlob({type:'image/png'}));
  const e:PersonalArtwork={id:`art-ui-${i}`,canonicalCardId:s.cards[i].id,printingId:null,imageBlob:image.fullHash,thumbnailBlob:image.thumbHash,source:'personal-local',attribution:'Generated fictional graphic',rightsStatus:'unverified',permissionEvidence:ACKNOWLEDGMENT,printingEvidence:'',confidence:'generic',createdAt:new Date().toISOString(),width:image.full.width,height:image.full.height};
  const tx=db.transaction(['artworkEntries','blobs'],'readwrite');tx.objectStore('artworkEntries').put(e);tx.objectStore('blobs').put({id:image.fullHash,blob:image.full.blob});tx.objectStore('blobs').put({id:image.thumbHash,blob:image.thumb.blob});await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});
 }
 db.close();repo.close();window.dispatchEvent(new Event('focus'));
}
Object.assign(globalThis,{artworkUI:{seedArtworkUI}});
