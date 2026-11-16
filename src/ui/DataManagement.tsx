import { useEffect, useRef, useState } from 'react';
import { createDataWorker, downloadBackup } from '../data-management/client';
import type { CollectionStore } from './store';
interface Preview {mediaEntries:number;mediaBytes:number;currentMediaEntries:number;cards:number;copies:number;expectedRevision:number;format:string;createdAt:string;printings:number;lots:number;events:number;operations:number;currentCards:number;currentCopies:number}
export function DataManagement({store}:{store:CollectionStore}) {
 const worker=useRef<Worker|null>(null);
 const [stage,setStage]=useState(''),[error,setError]=useState(''),[message,setMessage]=useState('');
 const [preview,setPreview]=useState<Preview>(),[confirmed,setConfirmed]=useState(false),[busy,setBusy]=useState(false),[committing,setCommitting]=useState(false);
 const commitStarted=useRef(false);
 const release=()=>{setBusy(false);setCommitting(false);commitStarted.current=false;store.setDataBusy(false);};
 useEffect(()=>{
  const warn=(e:BeforeUnloadEvent)=>{if(commitStarted.current){e.preventDefault();e.returnValue='';}};
  window.addEventListener('beforeunload',warn);
  return ()=>{window.removeEventListener('beforeunload',warn);worker.current?.terminate();worker.current=null;store.setDataBusy(false);};
 },[store]);
 const fail=(text:string)=>{setError(text);setMessage('');setStage('');setPreview(undefined);worker.current?.terminate();worker.current=null;release();};
 const start=(type:string,file?:File)=>{
  setError('');setMessage('');setStage('Preparing your backup…');setBusy(true);store.setDataBusy(true);setConfirmed(false);
  if(type!=='restore')setPreview(undefined);
  try {
   if(type!=='restore') {worker.current?.terminate();worker.current=createDataWorker();}
   const w=worker.current!;
   w.onerror=e=>{e.preventDefault();if(worker.current!==w)return;fail('Backup worker stopped unexpectedly. No successful restore was confirmed. Reload to inspect the collection before retrying.');};
   w.onmessage=e=>{
    if(worker.current!==w)return;
    const data=e.data;
    if(data.type==='status')setStage(/recovery/i.test(data.stage)?'Preparing and checking your recovery backup…':'Checking your backup…');
    if(data.type==='error')fail(`${data.message}. No successful restore was confirmed. The existing collection was not replaced.`);
    if(data.type==='ready') {commitStarted.current=true;setCommitting(true);setStage('Replacing your collection… Do not close this tab.');w.postMessage({type:'commit'});}
    if(data.type==='preview') {setPreview(data.preview);setStage('Validation complete. Review the replacement preview below.');release();}
    if(data.type==='export') {
     try {downloadBackup(data.source,data.filename);setMessage('Backup download requested. Check your browser downloads and keep the file somewhere safe.');setStage('');release();}
     catch(e) {fail(`Download could not start: ${String(e)}`);}
    }
    if(data.type==='restored') {
     setPreview(undefined);setStage('Reloading the restored collection…');
     void store.reloadAfterRestore().then(()=>{setMessage('Restoration complete. Your collection, history and photos are ready.');setStage('');release();}).catch(()=>fail('Replacement committed, but reloading failed. Reload this tab to inspect the restored collection.'));
    }
   };
   w.postMessage({type,file});
  }catch(e){fail(String(e));}
 };
 const cancel=()=>{
  if(commitStarted.current)return;
  worker.current?.terminate();worker.current=null;setPreview(undefined);setConfirmed(false);setStage('');setMessage('Cancelled before replacement. Your collection is unchanged.');release();
 };
 const stale=preview&&preview.expectedRevision!==store.snapshot?.revision;
 return <section aria-label="Data Management" className="data-management">
 <h3>Back up my collection</h3><p>Back up your collection and card photos regularly. Clearing browser data or losing this device can erase them. Keep backups somewhere safe.</p>
 <div className="actions"><button disabled={busy||store.busy} onClick={()=>start('export')}>Download full backup</button></div>
 <details><summary>Advanced backup details</summary><p>The complete community-media@3 backup includes card versions, copy records, protected quantities, history, replay protection and processed photos. Collection-only exports cannot restore all of this. Files are checked before restoration. Collection data is limited to 16 MiB and photos to 256 MiB (280 MiB total).</p><button disabled={busy||store.busy} onClick={()=>start('recovery')}>Download latest recovery backup</button></details>
 <h3>Restore a backup</h3><p>Choose a backup to review. Nothing changes until you confirm replacement.</p>
 <label>Backup file<input type="file" accept=".ncv,.json,application/json,application/octet-stream" disabled={busy||store.busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)start('preview',file);}}/></label>
 <div role="status" aria-live="polite">{stage||message}</div>{error&&<div className="error" role="alert"><p>{/Replacement committed/i.test(error)?'Your backup replaced the collection, but this screen could not refresh. Reload before making changes.':'This backup action could not finish. No successful replacement was confirmed. Review the details before retrying.'}</p><details><summary>Advanced error details</summary><p>{error}</p></details></div>}
 {busy&&!committing&&<button onClick={cancel}>Cancel operation</button>}
 {preview&&<section aria-label="Restore preview"><h3>Restore preview</h3><p>Backup created {new Date(preview.createdAt).toLocaleString()}</p><p>Replace your whole collection: {preview.currentCopies} current copies → {preview.copies} backup copies. This also replaces card details, history and photos. Collections are not merged.</p><p>Replace {preview.currentMediaEntries} saved photos with {preview.mediaEntries} backup photos. {preview.mediaEntries===0?'This backup has no photos. Your current photos will be removed.':''}</p><p>A recovery copy of your current collection must be checked and saved on this device first. If there is not enough space, replacement stops. Download the recovery backup afterward.</p><details><summary>Advanced restore details</summary><p>{preview.format} · {preview.cards} cards · {preview.printings} versions · {preview.lots} copy groups · {preview.events} history entries · {preview.operations} replay records · {preview.mediaBytes.toLocaleString()} photo bytes. All included photos and source information have been checked.</p></details>
 {stale&&<p role="alert" className="error">Collection changed since preview. Select the file again to validate a new preview.</p>}
 <label className="check"><input type="checkbox" checked={confirmed} disabled={busy||!!stale} onChange={e=>setConfirmed(e.target.checked)}/> I understand this replaces my entire current collection and history.</label>
 <div className="actions"><button className="primary" disabled={!confirmed||busy||!!stale||store.busy} onClick={()=>start('restore')}>Confirm replacement</button>{!busy&&<button onClick={cancel}>Cancel restore</button>}</div></section>}
 </section>;
}
