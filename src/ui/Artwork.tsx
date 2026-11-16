import {SaveError} from './SaveError';
import {PrintingPicker,printingLabel} from './PrintingPicker';
import {useEffect,useState,useRef} from 'react';
import {ACKNOWLEDGMENT,type PersonalArtwork,type processImage} from '../artwork/media';
import type {IndexedDBRepository} from '../storage/indexeddb/repository';
import type {Card,Printing} from '../domain/types';
export function LocalImage({repo,id,large=false}:{repo:IndexedDBRepository;id:string;large?:boolean}){
 const [url,setUrl]=useState(''),[error,setError]=useState(false);
 useEffect(()=>{let disposed=false,url='';setUrl('');setError(false);void repo.imageBlob(id).then(blob=>{if(!disposed){if(blob){url=URL.createObjectURL(blob);setUrl(url);}else setError(true);}}).catch(()=>{if(!disposed)setError(true);});return()=>{disposed=true;if(url)URL.revokeObjectURL(url);};},[repo,id]);
 return error?<p role="status">Photo unavailable. Recover it from a complete backup.</p>:url?<img className={large?'personal-large':'personal-thumb'} src={url} alt="Personal local artwork" onError={()=>{URL.revokeObjectURL(url);setUrl('');setError(true);}} decoding="async" loading={large?'eager':'lazy'}/>:null;
}
export function ArtworkManager({repo,card,printings,entries,revision,changed}:{repo:IndexedDBRepository;card:Card;printings:Printing[];entries:PersonalArtwork[];revision:number;changed:()=>Promise<void>}){
 const [error,setError]=useState('');
 const [entryLimit,setEntryLimit]=useState(5);
 const [target,setTarget]=useState(''),[confirmed,setConfirmed]=useState(false),[ack,setAck]=useState(false),[evidence,setEvidence]=useState('');
 const [processed,setProcessed]=useState<Awaited<ReturnType<typeof processImage>>>(),[preview,setPreview]=useState(''),[busy,setBusy]=useState(false),[status,setStatus]=useState('');
 const worker=useRef<Worker|null>(null);
 const fileInput=useRef<HTMLInputElement>(null);
 useEffect(()=>()=>worker.current?.terminate(),[]);
 useEffect(()=>{if(!processed){setPreview('');return;}const url=URL.createObjectURL(processed.full.blob);setPreview(url);return()=>URL.revokeObjectURL(url);},[processed]);
 const current=entries.filter(e=>e.canonicalCardId===card.id);
 const save=async()=>{if(!processed||!ack||target&&(!confirmed||!evidence.trim()))return;setBusy(true);setError('');setStatus('Saving…');let saved=false;try{
  const existing=current.filter(e=>e.printingId===(target||null));if(existing.length>1)throw new Error('More than one photo matches. Remove unwanted photos first.');
  const entry:PersonalArtwork={id:existing[0]?.id??crypto.randomUUID(),canonicalCardId:card.id,printingId:target||null,imageBlob:processed.fullHash,thumbnailBlob:processed.thumbHash,source:'personal-local',attribution:'Personal browser import',rightsStatus:'unverified',permissionEvidence:ACKNOWLEDGMENT,printingEvidence:target?evidence.trim():'',confidence:target?'exact':'generic',createdAt:new Date().toISOString(),width:processed.full.width,height:processed.full.height};
  const blobs=[{id:processed.fullHash,blob:processed.full.blob},...(processed.thumbHash===processed.fullHash?[]:[{id:processed.thumbHash,blob:processed.thumb.blob}])];
  await repo.changeArtwork(entry,blobs,undefined,revision);saved=true;await changed();setProcessed(undefined);setStatus('Photo saved on this device.');
 }catch(e){setStatus('');setError(saved?'Saved, but the photo list could not refresh. Reload to inspect your photos.':String(e));}finally{setBusy(false);}};
 return <section aria-label="Personal artwork"><h3>My Card Photos</h3><p>Choose a photo, review the preview, then save. Photos stay on this device and never confirm which physical version you own.</p><details><summary>Photo rights and advanced details</summary><p>Selection grants no redistribution rights. Your acknowledgment does not certify ownership. Photos are stored with their source and version evidence.</p></details>
 {current.slice(0,entryLimit).map(e=><div key={e.id}><LocalImage repo={repo} id={e.imageBlob} large/><p>{e.confidence==='generic'?'General card photo':`Version photo · ${printingLabel(printings.find(p=>p.id===e.printingId)!)}`}</p><button disabled={busy} onClick={()=>{setTarget(e.printingId??'');setConfirmed(false);setEvidence('');setProcessed(undefined);fileInput.current?.focus();fileInput.current?.scrollIntoView({block:'center'});}}>Replace photo</button><button disabled={busy} onClick={async()=>{setBusy(true);setError('');setStatus('');let removed=false;try{await repo.changeArtwork(null,[],e.id,revision);removed=true;await changed();setStatus('Photo removed.');}catch(error){setStatus('');setError(removed?'Saved, but the photo list could not refresh. Reload to inspect your photos.':String(error));}finally{setBusy(false);}}}>Remove photo</button></div>)}
 {current.length>entryLimit&&<button onClick={()=>setEntryLimit(n=>n+5)}>Show 5 more photos</button>}<PrintingPicker printings={printings} value={target} onChange={id=>{setTarget(id);setConfirmed(false);}} preferred={()=>true} disabled={busy} unknownLabel="General card photo"/>

 {target&&<><p>Only choose a specific version if this photo shows it. This does not confirm the version or finish of your owned copies.</p><label>How does this photo match the version?<input maxLength={2000} value={evidence} onChange={e=>setEvidence(e.target.value)}/></label><label className="check"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> This photo matches the selected version. My copies’ version details stay unchanged.</label></>}
 <label>Choose photo<input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;setBusy(true);setError('');setAck(false);setProcessed(undefined);setStatus('Processing image…');try{worker.current?.terminate();const w=new Worker(new URL('../artwork/worker.ts',import.meta.url),{type:'module'});worker.current=w;w.onmessage=event=>{w.terminate();setBusy(false);if(event.data.error){setStatus('');setError(event.data.error);}else{setProcessed(event.data.result);setStatus('Preview ready. Save to keep this image.');}};w.onerror=()=>{w.terminate();setBusy(false);setStatus('Image worker failed; nothing saved.');};w.postMessage(file);}catch(error){setBusy(false);setStatus('');setError(String(error));}}}/></label><p>JPG, PNG or WebP · up to 20 MB.</p><details><summary>Image size details</summary><p>Maximum 20 MiB and 40 megapixels. Saved photos are resized to 1600 pixels, with 320 pixel thumbnails.</p></details>
 {preview&&<img className="personal-large" src={preview} alt="Unsaved personal artwork preview"/>}
 <label className="check"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>{ACKNOWLEDGMENT}</label>
 <button disabled={busy||!processed||!ack||!!target&&(!confirmed||!evidence.trim())} onClick={()=>void save()}>Save photo</button>{processed&&<button disabled={busy} onClick={()=>setProcessed(undefined)}>Discard preview</button>}<p role="status">{status}</p><SaveError error={error}/></section>;
}
