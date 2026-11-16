import { useEffect, useState } from 'react';
export function OfflineStatus({compact=false}:{compact?:boolean}){
 const [message,setMessage]=useState('Preparing offline app. First launch requires a connection.'),[waiting,setWaiting]=useState(false),[online,setOnline]=useState(navigator.onLine),[storage,setStorage]=useState('');
 useEffect(()=>{
  const connection=()=>setOnline(navigator.onLine);window.addEventListener('online',connection);window.addEventListener('offline',connection);
  let disposed=false;let stopWorkerListeners=()=>{};
  if(!import.meta.env.PROD)setMessage('Offline use is available after installing a built app.');
  else if(!('serviceWorker' in navigator)||!isSecureContext)setMessage('Offline installation unavailable in this browser. Reopen using your usual Vault address.');
  else void navigator.serviceWorker.register(import.meta.env.BASE_URL+'sw.js',{scope:import.meta.env.BASE_URL,updateViaCache:'none'}).then(reg=>{
   if(disposed)return;
   const status=()=>{if(disposed)return;setWaiting(!!reg.waiting);setMessage(navigator.serviceWorker.controller?'Offline app ready. Installed catalog, inventory and personal images stay on this device.':'Preparing offline use. Keep this window connected until the offline app is ready.');};
   status();navigator.serviceWorker.addEventListener('controllerchange',status);
   const update=()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{status();if(!disposed&&worker.state==='redundant')setMessage(navigator.serviceWorker.controller?'App update could not be cached. Your previous offline app is still available.':'First offline installation failed. Reconnect and reload before relying on offline use.');});};
   update();
   reg.addEventListener('updatefound',update);
   stopWorkerListeners=()=>{navigator.serviceWorker.removeEventListener('controllerchange',status);reg.removeEventListener('updatefound',update);};
   void reg.update().catch(()=>{});
  }).catch(()=>setMessage('Offline app could not be cached. Reconnect and reopen before relying on offline use.'));
  void navigator.storage?.persisted?.().then(p=>{if(!disposed)setStorage(p?'Browser protection enabled. Keep backups somewhere safe.':'Your browser may clear saved data. Keep backups somewhere safe.');}).catch(()=>{});
  return()=>{disposed=true;stopWorkerListeners();window.removeEventListener('online',connection);window.removeEventListener('offline',connection);};
 },[]);
 if(compact)return <>{waiting&&<p className="offline-status" role="status">App update ready. Finish edits and backups, then close all Vault windows and reopen.</p>}{(!online||/failed|could not|unavailable/i.test(message))&&<p className="offline-status" role="status">{online?'Connected':'Offline'} · {message}</p>}</>;
 return <aside className="offline-status" aria-label="Offline and storage status"><p role="status">{online?'Connected':'Offline'} · {message}</p>{waiting&&<p role="status">App update ready. Finish all edits, image processing and backups, then close every Vault tab and Home Screen window. Reopen to load the update. No automatic reload occurs.</p>}<p>{storage}</p><p>Ask your browser to reduce automatic data clearing. This cannot prevent data loss or replace a backup.</p><button onClick={()=>void (navigator.storage?.persist?navigator.storage.persist():Promise.reject(new Error('unavailable'))).then(p=>setStorage(p?'Browser protection enabled. Keep backups somewhere safe.':'Your browser did not enable protection. Keep backups somewhere safe.')).catch(()=>setStorage('Browser protection unavailable. Keep backups somewhere safe.'))}>Help protect my collection</button></aside>;
}
