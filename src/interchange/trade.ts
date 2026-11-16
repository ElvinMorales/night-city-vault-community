import type { Snapshot, Lot } from '../domain/types';
/** Explicit public fields only; never serialize inventory records wholesale. */
export function tradeRows(s: Snapshot) {
 const cards=new Map(s.cards.map(c=>[c.id,c]));
 const printings=new Map(s.printings.map(p=>[p.id,p]));
 return s.lots.filter(l=>l.forTradeQty>0).map(l=>{
  const p=l.printingId?printings.get(l.printingId):undefined;
  return [cards.get(l.gameplayCardId)?.name??'Unknown card',p?.setCode??'Unresolved printing',p?.setName??'',p?.collectorNumber??'',p?.treatment??'',p?.language??'',String(l.forTradeQty),l.condition,l.isSealed?'Sealed':'Unsealed'];
 });
}
export function csvCell(value:string) {
 const safe=/^[\s]*[=+\-@]/.test(value)||/^[\t\r\n]/.test(value)?`'${value}`:value;
 return `"${safe.replaceAll('"','""')}"`;
}
export function tradeCSV(s:Snapshot) {
 return [['Card name','Set code','Set name','Collector number','Treatment','Language','Quantity offered','Condition','Sealed status'],...tradeRows(s)].map(r=>r.map(csvCell).join(',')).join('\r\n')+'\r\n';
}
export function tradeText(s:Snapshot) {
 const clean=(v:string)=>v.replace(/[\r\n\t]/g,' ').replace(/[@`]/g,'');
 return tradeRows(s).map(r=>`${r[6]}x ${clean(r[0])} — ${r.slice(1,6).filter(Boolean).map(clean).join(' · ')} · ${r[7]} · ${r[8]}`).join('\n');
}
export function tradeCapacity(l:Lot) { return l.quantity-l.protectedQty-l.allocatedQty; }
