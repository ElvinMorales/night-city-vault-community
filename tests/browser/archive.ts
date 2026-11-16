import { IndexedDBRepository,prepareCommand } from '../../src/storage/indexeddb/repository';
import { packagedCatalog } from '../../src/catalog/packaged';
import { installCatalog } from '../../src/catalog/install';
import { exportBackup,previewRestore,restoreBackup } from '../../src/interchange/backup';
import { canonical } from '../../src/storage/state';
import { cardStats } from '../../src/domain/analysis';
const check=(x:unknown,m='Real catalog assertion failed')=>{if(!x)throw Error(m);};
export const archiveTests:[string,()=>Promise<void>][]=[['real Archive install, intake, reconcile, update, persistence and backup',async()=>{
 const name=`archive-local-${crypto.randomUUID()}`;let r=await IndexedDBRepository.open(name);const target=await IndexedDBRepository.open(name+'-restore');
 const release=packagedCatalog!;const execute=async(body:Parameters<typeof prepareCommand>[1])=>{const snap=await r.readSnapshot();const result=await r.execute(await prepareCommand(crypto.randomUUID(),body,[{entity:'revision',id:'collection',version:snap.revision},...snap.lots.map(l=>({entity:l.kind,id:l.id,version:l.version}))]));check(result.ok,JSON.stringify(result));};
 try{
 const start=performance.now();await installCatalog(r,release);const installMs=performance.now()-start;
 let s=await r.readSnapshot();check(s.cards.length===151&&s.printings.length===860&&s.lots.length===0);
 const before=canonical(await r.archive());await installCatalog(r,release);check(canonical(await r.archive())===before,'Repeat modified archive');
 const c=s.cards.find(c=>c.name==='V: Streetkid')!;const p=s.printings.find(p=>p.gameplayCardId===c.id&&p.setCode==='welcometonightcityretail'&&p.collectorNumber==='005a')!;
 const addStart=performance.now();await execute({type:'quick-add',cardId:c.id,printingId:p.id,quantity:4,isSealed:false});const quickAddMs=performance.now()-addStart;
 await execute({type:'quick-add',cardId:c.id,printingId:null,quantity:2,isSealed:false});
 const custom={...p,id:'fictional-missing-stamp',setCode:'FICTIONAL-TEST',setName:'Fictional physical verification',collectorNumber:'β007x',treatment:'fictional-attested-stamp',source:'manual-exact',sourceText:'Fictional evidence',notes:'Fictional note',providerMaps:[]};await execute({type:'save-printing',printing:custom});
 await execute({type:'quick-add',cardId:c.id,printingId:custom.id,quantity:1,isSealed:false});
 s=await r.readSnapshot();const unknown=s.lots.find(l=>l.kind==='unresolved')!;
 await execute({type:'reconcile',from:{kind:'unresolved',id:unknown.id},toPrintingId:p.id,quantity:2});
 s=await r.readSnapshot();check(s.lots.reduce((n,l)=>n+l.quantity,0)===7);check(s.lots.filter(l=>l.kind==='unresolved').reduce((n,l)=>n+l.quantity,0)===0);
 const ownedLot=s.lots.find(l=>l.printingId===p.id&&l.quantity>=3)!;
 await execute({type:'set-reservations',lot:{kind:ownedLot.kind,id:ownedLot.id},protectedQty:1,forTradeQty:1,confirmUnprotect:false});
 await execute({type:'allocate',allocation:{id:'fictional-real-catalog-allocation',lotKind:ownedLot.kind,lotId:ownedLot.id,container:'Fictional binder',containerKind:'binder',deckPlanId:null,quantity:1,notes:'Fictional allocation note'}});
 s=await r.readSnapshot();const physical=canonical([s.lots,s.allocations]);const update={...structuredClone(release),version:release.version+'-test2'};const updateStart=performance.now();await installCatalog(r,update);const updateMs=performance.now()-updateStart;check(canonical([(await r.readSnapshot()).lots,(await r.readSnapshot()).allocations])===physical);
 const stats=cardStats(c,(await r.readSnapshot()).lots);check(stats.owned===7);check(stats.beyondPlayset===5);
 r.close();r=await IndexedDBRepository.open(name);check((await r.readSnapshot()).lots.reduce((n,l)=>n+l.quantity,0)===7);
 await restoreBackup(target,await previewRestore(target,await exportBackup(r)),async()=>{});check(canonical((await target.archive()).state)===canonical((await r.archive()).state));
 Object.assign(globalThis,{archiveMetrics:{cards:151,printings:860,installMs,quickAddMs,updateMs}});
 }finally{r.close();target.close();}
}]];
