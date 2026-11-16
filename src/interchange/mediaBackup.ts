import {digest} from '../storage/state';
import {exportBackup,parseBackup,MAX_BACKUP_BYTES} from './backup';
import {validateMedia,type Media} from '../artwork/media';
import type {IndexedDBRepository} from '../storage/indexeddb/repository';
const MAGIC='NCV-MEDIA-3\n';
export const MAX_PORTABLE_BYTES=280*1024*1024;
/** Length-prefixed manifest, original JSON domain backup, then raw media. No base64. */
export async function exportPortable(repo:IndexedDBRepository):Promise<Blob>{
 const domain=await exportBackup(repo,true),media=await repo.media();
 const b=await parseBackup(domain);await validateMedia(media,b.archive.state.cards,b.archive.state.printings);
 if((await repo.readSnapshot()).revision!==b.archive.meta.revision)throw new Error('Vault changed during backup; try again');
 const body={format:'community-media@3',domainBytes:new Blob([domain]).size,entries:media.entries,blobs:media.blobs.map(b=>({id:b.id,type:b.blob.type,size:b.blob.size}))};
 const manifest=JSON.stringify({...body,checksum:await digest(body)});
 const bytes=new TextEncoder().encode(manifest);if(bytes.length>4*1024*1024)throw new Error('Manifest too large');
 const length=new Uint8Array(4);new DataView(length.buffer).setUint32(0,bytes.length);
 const blob=new Blob([MAGIC,length,bytes,domain,...media.blobs.map(b=>b.blob)],{type:'application/octet-stream'});if(blob.size>MAX_PORTABLE_BYTES)throw new Error('Portable backup exceeds 280 MiB limit');return blob;
}
export async function parsePortable(file:Blob){
 if(file.size>MAX_PORTABLE_BYTES)throw new Error('Backup exceeds 280 MiB limit');
 if(await file.slice(0,MAGIC.length).text()!==MAGIC){if(file.size>MAX_BACKUP_BYTES)throw new Error('Legacy domain backup exceeds 16 MiB');const backup=await parseBackup(await file.text());return {backup,media:{entries:[],blobs:[]} as Media,containerFormat:backup.format};}
 const prefix=await file.slice(MAGIC.length,MAGIC.length+4).arrayBuffer();if(prefix.byteLength!==4)throw new Error('Truncated header');
 const length=new DataView(prefix).getUint32(0);if(length>4*1024*1024)throw new Error('Manifest too large');
 let offset=MAGIC.length+4;const m=JSON.parse(await file.slice(offset,offset+length).text());offset+=length;
 const {checksum,...body}=m;if(checksum!==await digest(body))throw new Error('Media manifest checksum mismatch');
 if(m.format!=='community-media@3'||!Number.isSafeInteger(m.domainBytes)||m.domainBytes<1||m.domainBytes>MAX_BACKUP_BYTES||!Array.isArray(m.blobs)||m.blobs.length>10000)throw new Error('Invalid media manifest');
 const backup=await parseBackup(await file.slice(offset,offset+m.domainBytes).text());offset+=m.domainBytes;
 const media:Media={entries:m.entries,blobs:[]};
 for(const b of m.blobs){if(!Number.isSafeInteger(b.size)||b.size<1||b.size>20*1024*1024||!['image/webp','image/png','image/jpeg'].includes(b.type))throw new Error('Invalid media length or type');media.blobs.push({id:b.id,blob:new Blob([await file.slice(offset,offset+b.size).arrayBuffer()],{type:b.type})});offset+=b.size;}
 if(offset!==file.size)throw new Error('Missing media bytes or trailing data');
 await validateMedia(media,backup.archive.state.cards,backup.archive.state.printings);return {backup,media,containerFormat:'community-media@3' as const};
}
