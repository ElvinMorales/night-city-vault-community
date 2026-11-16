import {describeChange} from './activityDescription';
import {useRef} from 'react';
import type {CollectionStore} from './store';
export function UndoAction({store,compact=false,onFinished}:{store:CollectionStore;compact?:boolean;onFinished?:()=>void}){
 return <button aria-label="Undo last action" disabled={store.busy||!store.undo} onClick={async e=>{const focused=document.activeElement===e.currentTarget;const latest=store.undo;if(latest){await store.run({type:'undo',batchId:latest.batchId},[{entity:'revision',id:'collection',version:latest.revision}]);if(focused)onFinished?.();}}}>{compact?'Undo':'Undo last action'}</button>;
}
export function ChangeNotice({store,dismiss}:{store:CollectionStore;dismiss:()=>void}){
 const close=useRef<HTMLButtonElement>(null);
 return <aside className="change-notice" aria-label="Last change"><span role="status" aria-live="polite" aria-atomic="true">{store.notice}{store.undo&&<span className="sr-only"> — Undo available.</span>}</span>{store.undo&&<UndoAction store={store} compact onFinished={()=>close.current?.focus()}/>}<button ref={close} aria-label="Dismiss notification" onClick={dismiss}>×</button></aside>;
}
export function RecentActivity({store}:{store:CollectionStore}){
 return <section aria-label="Recent changes"><p>Your 20 most recent collection changes. Photos are managed in My Card Photos.</p><UndoAction store={store}/><p>You can undo the last change made in this visit until another change is saved. Earlier changes cannot be undone here. Undo keeps a record of the original change.</p>{!store.events.length?<p>No collection changes yet.</p>:<ol className="activity-list">{[...store.events].reverse().map(e=><li key={e.seq}><strong>{describeChange(e.kind,store.activityCommands[e.batchId],store.snapshot!)}</strong><p><time dateTime={e.occurredAt}>{new Date(e.occurredAt).toLocaleString()}</time></p><p>{e.batchId===store.undo?.batchId?'Available to undo':e.kind==='undo'?'Completed reversal':e.seq===store.snapshot?.revision?'Undo is unavailable for this change in this visit.':'A later change was saved. This change can no longer be undone here.'}</p><details><summary>Advanced details</summary><p>Revision {e.seq} · Operation {e.batchId}</p>{e.undoesBatchId&&<p>Reverses {e.undoesBatchId}</p>}</details></li>)}</ol>}</section>;
}
