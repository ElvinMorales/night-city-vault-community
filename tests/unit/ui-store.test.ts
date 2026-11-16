import { describe, it, expect } from 'vitest';
import { CollectionStore } from '../../src/ui/store';
import type { CollectionRepository } from '../../src/storage/repository';
import type { CommandResult } from '../../src/domain/commands';
import { snapshot, card } from '../fixtures/fictional';
function setup(execute:CollectionRepository['execute']) {
 let reads=0;
 const repo:CollectionRepository={readSnapshot:async()=>{reads++;return snapshot();},readEvents:async()=>[],execute,subscribeCommittedRevision:()=>()=>{},close:()=>{}};
 return {store:new CollectionStore(repo),reads:()=>reads};
}
describe('shared UI commit state',()=>{
 it('blocks rapid repeats and announces success only after commit',async()=>{
  let resolve!:(r:CommandResult)=>void;let calls=0;
  let entered!:()=>void;const started=new Promise<void>(r=>{entered=r;});
  const {store}=setup(async()=>{calls++;entered();return new Promise(r=>{resolve=r;});});
  const first=store.run({type:'save-card',card});
  expect(store.busy).toBe(true);expect(store.message).toBe('');
  expect(await store.run({type:'save-card',card})).toBe(false);
  await started;expect(calls).toBe(1);expect(store.message).toBe('');
  resolve({ok:true,revision:0,batchId:'x',undoable:true,replayed:false});
  expect(await first).toBe(true);expect(store.message).toContain('Saved');expect(store.busy).toBe(false);
 });
 it('reports conflicts, refreshes the baseline, and never announces a failed save',async()=>{
  const {store,reads}=setup(async()=>({ok:false,code:'conflict',message:'Stale collection revision'}));
  expect(await store.run({type:'save-card',card})).toBe(false);
  expect(store.error).toContain('conflict');expect(store.message).toBe('');expect(reads()).toBe(1);
 });
 it('coalesces component refresh requests',async()=>{
  const {store,reads}=setup(async()=>({ok:false,code:'storage',message:'Unavailable'}));
  await Promise.all([store.refresh(),store.refresh(),store.refresh()]);
  expect(reads()).toBeLessThanOrEqual(2);expect(store.snapshot).not.toBeNull();
 });
 it('replaces cached history when a restored collection has an older ledger',async()=>{
  const {store}=setup(async()=>({ok:false,code:'storage',message:'Unavailable'}));
  store.events=[{seq:99,batchId:'old',occurredAt:'2026-01-01T00:00:00Z',kind:'quick-add',targetType:'collection',targetId:'old',field:'state',delta:null,beforeValue:null,afterValue:null,gameplayCardId:null,printingId:null,undoesBatchId:null,label:'quick-add'}];
  store.undo={batchId:'old',revision:99};
  await store.refresh();expect(store.events).toEqual([]);expect(store.undo).toBeNull();
 });
 it('invalidates undo when a different revision arrives',async()=>{
  const {store}=setup(async()=>({ok:false,code:'storage',message:'Unavailable'}));
  store.undo={batchId:'old',revision:8};await store.refresh();expect(store.undo).toBeNull();
 });
});

describe('Phase 3D action notifications',()=>{
 it('keeps notifications empty while pending and offers undo only after commit',async()=>{
  let finish!:(r:CommandResult)=>void;
  const {store}=setup(async()=>new Promise(r=>{finish=r;}));
  const pending=store.run({type:'quick-add',cardId:card.id,quantity:2,printingId:null,isSealed:false});
  expect(store.notice).toBe('');expect(store.undo).toBeNull();
  while(!finish)await new Promise(r=>setTimeout(r,1));
  expect(store.notice).toBe('');
  finish({ok:true,revision:0,batchId:'new',undoable:true,replayed:false});await pending;
  expect(store.notice).toBe('2 copies added');expect(store.undo?.batchId).toBe('new');
 });
 it('announces cross-tab invalidation without retaining an undo action',async()=>{
  const {store}=setup(async()=>({ok:false,code:'storage',message:'Unavailable'}));
  store.undo={batchId:'old',revision:8};await store.refresh();
  expect(store.undo).toBeNull();expect(store.notice).toContain('no longer available');
 });
 it('passes the captured revision and clears the action after a rejected undo',async()=>{
  let captured:Parameters<CollectionRepository['execute']>[0]|undefined;
  const {store}=setup(async c=>{captured=c;return {ok:false,code:'unsupported-undo',message:'Head changed'};});
  store.undo={batchId:'old',revision:0};
  expect(await store.run({type:'undo',batchId:'old'},[{entity:'revision',id:'collection',version:0}])).toBe(false);
  expect(captured?.expectedVersions).toEqual([{entity:'revision',id:'collection',version:0}]);
  expect(store.undo).toBeNull();expect(store.notice).toContain('could not be completed');expect(store.message).toBe('');
 });
 it('never offers undo after a successful unsupported operation',async()=>{
  const {store}=setup(async()=>({ok:true,revision:0,batchId:'compensation',undoable:false,replayed:false}));
  await store.run({type:'undo',batchId:'original'});
  expect(store.undo).toBeNull();expect(store.notice).toBe('Last change undone');
 });
});
