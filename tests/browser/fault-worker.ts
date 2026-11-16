// Test-only storage faults; never imported by production.
import '../../src/data-management/worker';
const scope=globalThis as unknown as {onmessage:(e:MessageEvent)=>void};
const handle=scope.onmessage;
const add=IDBObjectStore.prototype.add,put=IDBObjectStore.prototype.put,get=IDBObjectStore.prototype.get;
IDBObjectStore.prototype.get=function(...args:Parameters<IDBObjectStore['get']>) {
 const r=get.apply(this,args);
 if(fault==='readback'&&this.transaction.db.name==='community-pre-restore-recovery')r.addEventListener('success',()=>Object.defineProperty(r,'result',{value:{...r.result,source:'Fictional corrupt retention'}}));
 return r;
};
let fault='';
IDBObjectStore.prototype.add=function(...args:Parameters<IDBObjectStore['add']>) {
 if(fault==='recovery'&&this.transaction.db.name==='community-pre-restore-recovery')throw new DOMException('Fictional recovery quota exhausted','QuotaExceededError');
 return add.apply(this,args);
};
IDBObjectStore.prototype.put=function(...args:Parameters<IDBObjectStore['put']>) {
 if(fault==='commit'&&this.name==='lots') {this.transaction.abort();throw new Error('Fictional replacement interrupted');}
 return put.apply(this,args);
};
scope.onmessage=e=>{fault=e.data.fault??fault;handle(e);};
