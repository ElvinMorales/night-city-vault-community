import { completion, request } from '../storage/indexeddb/database';
import type { ArtworkEntry } from '../domain/artworkResolver';
export const ACKNOWLEDGMENT='I understand that this image may be copyrighted. It will be stored locally in my browser and will not be uploaded or shared by Night City Vault.';
export const MAX_IMAGE_BYTES=20*1024*1024;
export interface PersonalArtwork extends ArtworkEntry { createdAt:string; width:number; height:number; }
export interface MediaBlob {id:string;blob:Blob}
export interface Media {entries:PersonalArtwork[];blobs:MediaBlob[]}
export async function hash(blob:Blob) {return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function imageType(blob:Blob) {
 if(!blob.size||blob.size>MAX_IMAGE_BYTES)throw new Error('Image must be between 1 byte and 20 MiB.');
 const b=new Uint8Array(await blob.slice(0,12).arrayBuffer());
 const type=b[0]===255&&b[1]===216&&b[2]===255?'image/jpeg':b.slice(0,8).join(',')==='137,80,78,71,13,10,26,10'?'image/png':String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP'?'image/webp':'';
 if(!type||blob.type&&blob.type!==type)throw new Error('Choose a valid JPG, PNG or WebP image with a matching file type.');
 return type;
}
/** Inspect dimensions before allocating decoded pixels. Reject unknown/oversized headers. */
export async function imageDimensions(file:Blob,type:string){
 const b=new Uint8Array(await file.slice(0,1024*1024).arrayBuffer()),v=new DataView(b.buffer);let width=0,height=0;
 if(type==='image/png'&&b.length>=24){width=v.getUint32(16);height=v.getUint32(20);}
 if(type==='image/jpeg'){let i=2;while(i+4<b.length){if(b[i++]!==255)break;while(b[i]===255)i++;const marker=b[i++];if(marker===217||marker===218)break;const length=v.getUint16(i);if(length<2||i+length>b.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=7){height=v.getUint16(i+3);width=v.getUint16(i+5);break;}i+=length;}}
 if(type==='image/webp'&&b.length>=30){const kind=String.fromCharCode(...b.slice(12,16));if(kind==='VP8X'){width=1+b[24]+(b[25]<<8)+(b[26]<<16);height=1+b[27]+(b[28]<<8)+(b[29]<<16);}else if(kind==='VP8L'&&b[20]===47){const bits=v.getUint32(21,true);width=1+(bits&16383);height=1+((bits>>>14)&16383);}else if(kind==='VP8 '&&b[23]===157&&b[24]===1&&b[25]===42){width=v.getUint16(26,true)&16383;height=v.getUint16(28,true)&16383;}}
 if(!width||!height||width*height>40_000_000||Math.max(width,height)>32768)throw new Error('Image dimensions unsupported or exceed 40 megapixels / 32768 pixels.');
 return {width,height};
}
export async function processImage(file:Blob) {
 const type=await imageType(file);await imageDimensions(file,type);
 let bitmap:ImageBitmap;
 try{bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});}catch{throw new Error('Image could not be decoded. Choose another JPG, PNG or WebP.');}
 try{
  if(bitmap.width*bitmap.height>40_000_000||!bitmap.width||!bitmap.height)throw new Error('Image exceeds 40 megapixels.');
  const encode=async(max:number)=>{
   const scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height)),width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale));
   const canvas=new OffscreenCanvas(width,height);const context=canvas.getContext('2d');if(!context)throw new Error('Image processing unavailable in this browser');
   context.drawImage(bitmap,0,0,width,height);return {blob:await canvas.convertToBlob({type:'image/webp',quality:.86}),width,height};
  };
  const full=await encode(1600),thumb=await encode(320);
  return {full,thumb,fullHash:await hash(full.blob),thumbHash:await hash(thumb.blob)};
 }finally{bitmap.close();}
}
export async function readMedia(db:IDBDatabase):Promise<Media>{const tx=db.transaction(['artworkEntries','blobs']),done=completion(tx);const [entries,blobs]=await Promise.all([request(tx.objectStore('artworkEntries').getAll()),request(tx.objectStore('blobs').getAll()),done]);return {entries,blobs};}
const ENTRY_FIELDS=['id','canonicalCardId','printingId','imageBlob','thumbnailBlob','source','attribution','rightsStatus','permissionEvidence','printingEvidence','confidence','createdAt','width','height'].sort().join(',');
function checkProcessedWebP(encoded:Uint8Array) {
 const view=new DataView(encoded.buffer,encoded.byteOffset,encoded.byteLength);
 if(encoded.length<12||view.getUint32(4,true)+8!==encoded.length)throw new Error('Invalid processed WebP length');
 let offset=12;
 while(offset+8<=encoded.length){
  const chunk=String.fromCharCode(...encoded.slice(offset,offset+4)),length=view.getUint32(offset+4,true);
  if(['EXIF','XMP ','ANIM','ANMF'].includes(chunk))throw new Error('Backup media contains unprocessed metadata or animation');
  offset+=8+length+(length%2);
  if(offset>encoded.length)throw new Error('Corrupt WebP chunk');
 }
 if(offset!==encoded.length)throw new Error('Truncated WebP chunk');
}
/** Validate one bounded blob at a time; never decode a complete library together. */
export async function validateMedia(media:Media,cards:{id:string}[],printings:{id:string;gameplayCardId:string}[]) {
 if(!media||!Array.isArray(media.entries)||!Array.isArray(media.blobs)||media.entries.length>5000||media.blobs.length>10000)throw new Error('Media record limit exceeded');
 const ids=new Set<string>(),dimensions=new Map<string,{width:number;height:number}>();
 let bytes=0;
 for(const b of media.blobs){
  if(!b||typeof b.id!=='string'||!/^[a-f0-9]{64}$/.test(b.id)||ids.has(b.id)||!(b.blob instanceof Blob))throw new Error('Invalid or duplicate media blob');
  ids.add(b.id);bytes+=b.blob.size;
 }
 if(bytes>256*1024*1024)throw new Error('Media exceeds 256 MiB portable limit');
 for(const b of media.blobs){
  const type=await imageType(b.blob);
  if(type!=='image/webp')throw new Error('Backup media must be processed WebP');
  checkProcessedWebP(new Uint8Array(await b.blob.arrayBuffer()));
  const dims=await imageDimensions(b.blob,type);
  if(dims.width>1600||dims.height>1600)throw new Error('Invalid media dimensions');
  if(await hash(b.blob)!==b.id)throw new Error('Media checksum mismatch');
  const bitmap=await createImageBitmap(b.blob);
  const valid=bitmap.width<=1600&&bitmap.height<=1600;
  dimensions.set(b.id,{width:bitmap.width,height:bitmap.height});
  bitmap.close();
  if(!valid)throw new Error('Invalid media dimensions');
 }
 const entries=new Set<string>(),references=new Set<string>(),cardIds=new Set(cards.map(c=>c.id));
 for(const e of media.entries){
  if(!e||Object.keys(e).sort().join(',')!==ENTRY_FIELDS||typeof e.id!=='string'||e.id.length>200||entries.has(e.id)||
   typeof e.attribution!=='string'||e.attribution.length>2000||!cardIds.has(e.canonicalCardId)||
   !ids.has(e.imageBlob)||!e.thumbnailBlob||!ids.has(e.thumbnailBlob)||
   e.source!=='personal-local'||e.rightsStatus!=='unverified'||e.permissionEvidence!==ACKNOWLEDGMENT||
   !['generic','exact'].includes(e.confidence)||typeof e.printingEvidence!=='string'||e.printingEvidence.length>2000||
   typeof e.createdAt!=='string'||!Number.isFinite(Date.parse(e.createdAt))||
   !Number.isInteger(e.width)||!Number.isInteger(e.height)||e.width<1||e.height<1||e.width>1600||e.height>1600||
   dimensions.get(e.imageBlob)?.width!==e.width||dimensions.get(e.imageBlob)?.height!==e.height||
   Math.max(dimensions.get(e.thumbnailBlob)?.width??Infinity,dimensions.get(e.thumbnailBlob)?.height??Infinity)>320||
   (e.confidence==='generic'?e.printingId!==null:!e.printingEvidence.trim()||!printings.some(p=>p.id===e.printingId&&p.gameplayCardId===e.canonicalCardId)))
   throw new Error('Invalid artwork association or missing blob');
  entries.add(e.id);references.add(e.imageBlob);references.add(e.thumbnailBlob);
 }
 if(media.blobs.some(b=>!references.has(b.id)))throw new Error('Unreferenced media blob');
}
