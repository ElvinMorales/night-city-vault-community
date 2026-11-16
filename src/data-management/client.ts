export function createDataWorker() {
 if(typeof Worker==='undefined')throw new Error('This browser cannot run backup validation in a worker. Use a browser with Web Worker support.');
 return new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
}
export function downloadBackup(source:string|Blob,filename:string) {
 const url=URL.createObjectURL(source instanceof Blob ? source : new Blob([source],{type:'application/json'}));
 try {
  const a=document.createElement('a');a.href=url;a.download=filename;
  document.body.append(a);try {a.click();} finally {a.remove();}
 } finally {setTimeout(()=>URL.revokeObjectURL(url),60000);}
}
