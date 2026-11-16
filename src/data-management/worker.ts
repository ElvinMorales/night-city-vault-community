import {exportPortable,parsePortable} from '../interchange/mediaBackup';
import { IndexedDBRepository } from '../storage/indexeddb/repository';
import { type RestorePreview } from '../interchange/backup';
import { latestRecovery, retainRecovery } from './recovery';
const scope=globalThis as unknown as {postMessage:(value:unknown)=>void;onmessage:((e:MessageEvent)=>void)|null};
let repo:IndexedDBRepository|undefined,preview:RestorePreview|undefined;
let portable:Awaited<ReturnType<typeof parsePortable>>|undefined;
let proceed:(()=>void)|undefined;
function downloaded(source:string|Blob) {
 if(source instanceof Blob){scope.postMessage({type:'export',source,filename:`vault-community-media@3-${Date.now()}.ncv`});return;}
 const b=JSON.parse(source);
 scope.postMessage({type:'export',source,filename:`vault-${b.format}-${b.createdAt.replaceAll(':','-')}.json`});
}
const status=(stage:string)=>scope.postMessage({type:'status',stage});
scope.onmessage=e=>{
 if(e.data.type==='commit') {proceed?.();proceed=undefined;return;}
 void run(e.data).catch(error=>scope.postMessage({type:'error',message:error instanceof Error?error.message:String(error)}));
};
async function run(message:{type:string;file?:File;database?:string}) {
 repo??=await IndexedDBRepository.open(message.database);
 if(message.type==='export') {
  status('Reading and validating the complete backup…');
  downloaded(await exportPortable(repo));
 } else if(message.type==='recovery') {
  const row=await latestRecovery();
  if(!row)throw new Error('No retained recovery backup is available in this browser.');
  downloaded(row.source);
 } else if(message.type==='preview') {
  preview=undefined;
  if(!message.file)throw new Error('Choose a backup file');
  status('Reading file and validating schema, checksum, references, quantities and history…');
  portable=await parsePortable(message.file);
  const b=portable.backup;
  const source=JSON.stringify(b);
  const snap=await repo.readSnapshot();
  preview={source,checksum:b.checksum,expectedRevision:snap.revision,cards:b.archive.state.cards.length,copies:b.archive.state.lots.reduce((n,l)=>n+l.quantity,0)};
  const current=await repo.readSnapshot();
  if(current.revision!==preview.expectedRevision)throw new Error('Collection changed while preparing preview. Select the file again.');
  scope.postMessage({type:'preview',preview:{mediaEntries:portable.media.entries.length,mediaBytes:portable.media.blobs.reduce((n,b)=>n+b.blob.size,0),currentMediaEntries:(await repo.artworkEntries()).length,cards:preview.cards,copies:preview.copies,expectedRevision:preview.expectedRevision,format:portable.containerFormat,createdAt:b.createdAt,printings:b.archive.state.printings.length,lots:b.archive.state.lots.length,events:b.archive.events.length,operations:b.archive.operations.length,currentCards:current.cards.length,currentCopies:current.lots.reduce((n,l)=>n+l.quantity,0)}});
 } else if(message.type==='restore') {
  if(!preview)throw new Error('Select and validate a backup first.');
  status('Revalidating backup and preparing the complete recovery backup…');
  if(!portable)throw new Error('No validated backup');
  const recovery=await exportPortable(repo);
  if((await repo.readSnapshot()).revision!==preview.expectedRevision)throw new Error('Collection changed since preview');
  status('Retaining and verifying the pre-restore recovery backup…');
  await retainRecovery(recovery);
  await new Promise<void>(resolve=>{proceed=resolve;scope.postMessage({type:'ready'});});
  await repo.replace(portable.backup.archive,preview.expectedRevision,portable.media);
  portable=undefined;
  preview=undefined;
  scope.postMessage({type:'restored'});
 }
}
