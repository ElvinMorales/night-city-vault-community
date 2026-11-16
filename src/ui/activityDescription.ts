import type {CommandBody} from '../domain/commands';
import type {Snapshot} from '../domain/types';
export const actionLabels:Record<string,string>={
 'save-card':'Card details saved','save-printing':'Card version saved','quick-add':'Copies added','add-lot':'Copies recorded','adjust-lot':'Copy quantity changed','set-reservations':'Protected copies or trade quantity changed','catalog-release':'Card catalog updated',reconcile:'Card version identified',allocate:'Copies assigned to a deck','remove-allocation':'Copies released from a deck',undo:'Last change undone',
};
export function describeChange(kind:string,body:CommandBody|undefined,snapshot:Snapshot):string{
 const fallback=actionLabels[kind]??'Collection updated';
 if(!body||body.type!==kind)return fallback;
 const name=(id:string)=>snapshot.cards.find(c=>c.id===id)?.name;
 const copies=(n:number)=>`${Math.abs(n)} ${Math.abs(n)===1?'copy':'copies'}`;
 switch(body.type){
  case 'quick-add':return `${copies(body.quantity)} added${name(body.cardId)?` · ${name(body.cardId)}`:''}`;
  case 'save-card':return `${fallback} · ${body.card.name}`;
  case 'save-printing':return `${fallback}${name(body.printing.gameplayCardId)?` · ${name(body.printing.gameplayCardId)}`:''}`;
  case 'add-lot':return `${copies(body.lot.quantity)} recorded${name(body.lot.gameplayCardId)?` · ${name(body.lot.gameplayCardId)}`:''}`;
  case 'adjust-lot':{
   const lot=snapshot.lots.find(l=>l.id===body.lot.id&&l.kind===body.lot.kind);
   return `${copies(body.delta)} ${body.delta<0?'removed':'added'}${lot&&name(lot.gameplayCardId)?` · ${name(lot.gameplayCardId)}`:''}`;
  }
  case 'set-reservations':{
   const lot=snapshot.lots.find(l=>l.id===body.lot.id&&l.kind===body.lot.kind);
   return `${body.protectedQty} protected · ${body.forTradeQty} for trade${lot&&name(lot.gameplayCardId)?` · ${name(lot.gameplayCardId)}`:''}`;
  }
  case 'reconcile':return `${copies(body.quantity)} identified`;
  default:return fallback;
 }
}
