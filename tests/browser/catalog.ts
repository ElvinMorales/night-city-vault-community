import { IndexedDBRepository as Repository, prepareCommand } from '../../src/storage/indexeddb/repository';
import { installCatalog } from '../../src/catalog/install';
import { planCatalog } from '../../src/catalog/catalog';
import { release } from '../fixtures/catalog';
import { canonical } from '../../src/storage/state';
import { exportBackup, previewRestore, restoreBackup } from '../../src/interchange/backup';
const check=(x:unknown,m='Catalog assertion failed')=>{if(!x)throw new Error(m);};
let serial=0;
const database=()=>`fiction-catalog-${Date.now()}-${serial++}`;
export const catalogTests:[string,()=>Promise<void>][]=[
 ['catalog fresh, repeat, reload, offline-local and backup history',async()=>{
  const db=database();let r=await Repository.open(db);const target=await Repository.open(database());
  try{const fixture=release(140);await installCatalog(r,fixture);const before=await r.archive();check(before.state.cards.length===140&&before.state.printings.length===140&&before.state.lots.length===0);await installCatalog(r,fixture);check(canonical(await r.archive())===canonical(before),'Repeat installation changed archive');r.close();r=await Repository.open(db);check((await r.readSnapshot()).cards.length===140);const preview=await previewRestore(target,await exportBackup(r));await restoreBackup(target,preview,async()=>{});check(canonical((await target.archive()).state)===canonical(before.state));}finally{r.close();target.close();}
 }],
 ['catalog conflict review adoption preserves reserved and sealed holdings; stale, rollback, replay, undo',async()=>{
  const r=await Repository.open(database());const fixture=release();
  const execute=async(body:Parameters<typeof prepareCommand>[1],guard=true)=>r.execute(await prepareCommand(crypto.randomUUID(),body,guard?[{entity:'revision',id:'collection',version:(await r.readSnapshot()).revision}]:[]));
  try{
   check((await execute({type:'save-card',card:{...fixture.cards[0],classificationSource:'catalog:fiction-old'}})).ok);
   const local={...fixture.printings[0],id:'local-custom',notes:'Owner notes',sourceText:'Owner evidence'};check((await execute({type:'save-printing',printing:local})).ok);
   for(const sealed of [false,true])check((await execute({type:'add-lot',lot:{id:sealed?'sealed':'open',kind:'holding',gameplayCardId:local.gameplayCardId,printingId:local.id,condition:'NM',isSealed:sealed,label:'local',reason:null,quantity:8,protectedQty:2,forTradeQty:1,location:'Fiction shelf',notes:'Physical notes',version:1}})).ok);
   check((await execute({type:'allocate',allocation:{id:'a',lotKind:'holding',lotId:'open',container:'Fiction binder',containerKind:'binder',deckPlanId:null,quantity:2,notes:'retain'}})).ok);
   const before=await r.archive();check(planCatalog(before.state,fixture)[1].status==='potential');
   const body={type:'catalog-release' as const,release:fixture,choices:{cards:[],printings:[{incomingId:fixture.printings[0].id,localId:local.id}]}};
   const stale=await prepareCommand('stale',body,[{entity:'revision',id:'collection',version:before.meta.revision}]);
   check((await execute({type:'quick-add',cardId:local.gameplayCardId,printingId:null,quantity:2,isSealed:false})).ok);
   check(!(await r.execute(stale)).ok,'Stale review accepted');
   const physical=await r.archive();const command=await prepareCommand('review',body,[{entity:'revision',id:'collection',version:physical.meta.revision}]);const result=await r.execute(command);check(result.ok);const replay=await r.execute(command);check(replay.ok&&replay.replayed);
   const after=await r.archive();check(canonical(after.state.lots)===canonical(physical.state.lots));check(canonical(after.state.allocations)===canonical(physical.state.allocations));check(after.state.printings[0].id===local.id&&after.state.printings[0].notes===local.notes&&after.state.printings[0].sourceText===local.sourceText);
   const target=await Repository.open(database());try{const preview=await previewRestore(target,await exportBackup(r));await restoreBackup(target,preview,async()=>{});check(canonical((await target.archive()).state)===canonical(after.state));}finally{target.close();}
   check((await execute({type:'undo',batchId:'review'})).ok);check((await r.readSnapshot()).printings[0].providerMaps.length===0);
   const invalid=release(2,'invalid');invalid.printings[1].gameplayCardId='missing';const unchanged=await r.archive();check(!(await execute({type:'catalog-release',release:invalid,choices:{cards:[],printings:[]}})).ok);check(canonical(await r.archive())===canonical(unchanged));
  }finally{r.close();}
 }],
 ['catalog update additions, metadata review and exact identity conflict rollback',async()=>{
  const r=await Repository.open(database());try{await installCatalog(r,release());const next=release(2,'fiction-2');next.printings[0].rarity='Fictional uncommon';await installCatalog(r,next);check((await r.readSnapshot()).cards.length===2);check((await r.readSnapshot()).printings[0].rarity===null,'Unreviewed metadata overwritten');let s=await r.readSnapshot();const result=await r.execute(await prepareCommand('metadata',{type:'catalog-release',release:next,choices:{cards:[],printings:[{incomingId:next.printings[0].id,localId:next.printings[0].id}]}},[{entity:'revision',id:'collection',version:s.revision}]));check(result.ok);check((await r.readSnapshot()).printings[0].rarity==='Fictional uncommon');const conflict=release(2,'fiction-3');conflict.printings[0].collectorNumber='β007';s=await r.readSnapshot();const before=await r.archive();check(!(await r.execute(await prepareCommand('conflict',{type:'catalog-release',release:conflict,choices:{cards:[],printings:[{incomingId:conflict.printings[0].id,localId:conflict.printings[0].id}]}},[{entity:'revision',id:'collection',version:s.revision}]))).ok);check(canonical(await r.archive())===canonical(before));}finally{r.close();}
 }],
 ['catalog mid-install storage failure rolls back existing inventory and partial writes',async()=>{
  const r=await Repository.open(database());try{await installCatalog(r,release());const before=await r.archive(),original=IDBObjectStore.prototype.put;let writes=0;
   IDBObjectStore.prototype.put=function(value:unknown,key?:IDBValidKey){if(this.name==='printings'&&++writes===2)throw new DOMException('Fictional catalog quota failure','QuotaExceededError');return key===undefined?original.call(this,value):original.call(this,value,key);};
   let failed=false;try{await installCatalog(r,release(3,'fiction-abort'));}catch{failed=true;}finally{IDBObjectStore.prototype.put=original;}
   check(failed&&writes===2);check(canonical(await r.archive())===canonical(before),'Catalog partial writes escaped rollback');await installCatalog(r,release(3,'fiction-abort'));check((await r.readSnapshot()).cards.length===3);
   const reused=release(4,'fiction-abort');let rejected=false;try{await installCatalog(r,reused);}catch{rejected=true;}check(rejected,'Reused catalog version accepted');
  }finally{r.close();}
 }],
 ['catalog installation and update performance 140/500/1000/5000 fictional identities',async()=>{
  for(const size of [140,500,1000,5000]){const r=await Repository.open(database());try{const fixture=release(size);let ticks=0,maxGap=0,last=performance.now();const timer=setInterval(()=>{const now=performance.now();maxGap=Math.max(maxGap,now-last);last=now;ticks++;},16);const start=performance.now();await installCatalog(r,fixture);const installMs=performance.now()-start;const update=release(1,'fiction-2');update.cards[0].id=`future-${size}`;update.cards[0].name=`Fictional Future ${size}`;update.printings[0].id=`future-print-${size}`;update.printings[0].gameplayCardId=update.cards[0].id;update.evidence[0].id=update.cards[0].id;update.evidence[1].id=update.printings[0].id;const updateStart=performance.now();await installCatalog(r,update);const updateMs=performance.now()-updateStart;clearInterval(timer);check((await r.readSnapshot()).cards.length===size+1);((globalThis as unknown as {catalogMetrics:unknown[]}).catalogMetrics??=[]).push({size,installMs,updateMs,ticks,maxGapMs:maxGap});}finally{r.close();}}
 }]
];
