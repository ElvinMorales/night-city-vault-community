import {hash} from '../artwork/media';
import { completion, request } from '../storage/indexeddb/database';
const NAME = 'community-pre-restore-recovery';
async function open(): Promise<IDBDatabase> {
 return new Promise((resolve,reject)=>{
  const r=indexedDB.open(NAME,1);
  r.onupgradeneeded=()=>r.result.createObjectStore('backups',{keyPath:'id'}).createIndex('createdAt','createdAt');
  r.onerror=()=>reject(r.error);
  let blocked=false;
  r.onblocked=()=>{blocked=true;reject(new Error('Recovery storage blocked'));};
  r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();if(blocked)r.result.close();else resolve(r.result);};
 });
}
export interface Recovery {id:string;createdAt:string;source:string|Blob}
/** Retain every recovery, then read it back in a new transaction before allowing replacement. */
export async function retainRecovery(source:string|Blob):Promise<void> {
 const db=await open();
 try {
  const row:Recovery={id:crypto.randomUUID(),createdAt:new Date().toISOString(),source};
  const tx=db.transaction('backups','readwrite',{durability:'strict'}),done=completion(tx);
  void done.catch(()=>{});
  tx.objectStore('backups').add(row);await done;
  const read=db.transaction('backups'),readDone=completion(read);
  const [saved]=await Promise.all([request(read.objectStore('backups').get(row.id)) as Promise<Recovery|undefined>,readDone]);
  if(!saved || (typeof source==='string' ? saved.source!==source : !(saved.source instanceof Blob) || saved.source.size!==source.size))throw new Error('Recovery backup could not be verified');
  if(source instanceof Blob && saved.source instanceof Blob){for(let offset=0;offset<source.size;offset+=1024*1024){if(await hash(source.slice(offset,offset+1024*1024))!==await hash(saved.source.slice(offset,offset+1024*1024)))throw new Error('Recovery media readback mismatch');}}
 } finally {db.close();}
}
export async function latestRecovery():Promise<Recovery|undefined> {
 const db=await open();
 try {
  const tx=db.transaction('backups'),done=completion(tx);
  const [cursor]=await Promise.all([request(tx.objectStore('backups').index('createdAt').openCursor(null,'prev')),done]);
  return cursor?.value as Recovery|undefined;
 } finally {db.close();}
}
