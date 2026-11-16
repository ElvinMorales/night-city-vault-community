import type { Card, Printing } from '../domain/types';
import { normalizeName } from '../domain/analysis';
import { printingIdentity } from '../domain/printingIdentity';
import { assert, canonical, validateState, type State } from '../storage/state';
export interface CatalogRelease {
 format: 'community-catalog@1'; version: string; releasedAt: string;
 sources: {id:string; reference:string; rights:string}[];
 evidence: {kind:'card'|'printing'; id:string; sourceIds:string[]; status:'verified'|'uncertain'; notes:string}[];
 coverage: string; cards: Card[]; printings: Printing[];
}
export type Decision = {incomingId:string; localId:string | null};
export interface CatalogChoices {cards:Decision[]; printings:Decision[]}
export interface Candidate {kind:'card'|'printing'; incomingId:string; localIds:string[]; status:'new'|'existing'|'potential'|'ambiguous'|'conflict'; matching:string[]; differences:string[]}
const provider = 'community-catalog';
export const managedPrinting = (p:Printing) => p.providerMaps.some(m=>m.provider===provider);
export const managedCard = (c:Card) => c.classificationSource?.startsWith('catalog:') ?? false;
export function validateRelease(r:CatalogRelease) {
 assert(r && Object.keys(r).sort().join(',')==='cards,coverage,evidence,format,printings,releasedAt,sources,version','Invalid catalog shape');
 assert(r.format==='community-catalog@1' && typeof r.version==='string' && /^[a-zA-Z0-9.-]{1,80}$/.test(r.version));
 assert(typeof r.releasedAt==='string' && /^\d{4}-\d{2}-\d{2}$/.test(r.releasedAt) && Number.isFinite(Date.parse(r.releasedAt)) && new Date(r.releasedAt).toISOString().slice(0,10)===r.releasedAt);
 assert(typeof r.coverage==='string' && r.coverage.length<=10000 && Array.isArray(r.sources) && r.sources.length>0 && r.sources.length<=100);
 assert(new Set(r.sources.map(s=>s.id)).size===r.sources.length,'Duplicate source ID');
 for(const s of r.sources) assert(s && Object.keys(s).sort().join(',')==='id,reference,rights' && [s.id,s.reference,s.rights].every(x=>typeof x==='string'&&x.length>0&&x.length<=10000));
 validateState({cards:r.cards,printings:r.printings,lots:[],allocations:[]});
 assert(Array.isArray(r.evidence)&&r.evidence.length===r.cards.length+r.printings.length,'Every entry requires evidence status');
 const keys=new Set<string>(),sources=new Set(r.sources.map(x=>x.id)),cards=new Set(r.cards.map(c=>c.id)),printings=new Set(r.printings.map(p=>p.id));
 for(const e of r.evidence){assert(e&&Object.keys(e).sort().join(',')==='id,kind,notes,sourceIds,status'&&['card','printing'].includes(e.kind)&&['verified','uncertain'].includes(e.status)&&typeof e.notes==='string'&&e.notes.length<=10000&&Array.isArray(e.sourceIds)&&e.sourceIds.length>0&&e.sourceIds.every(id=>sources.has(id)));assert((e.kind==='card'?cards:printings).has(e.id)&&!keys.has(`${e.kind}:${e.id}`),'Invalid evidence identity');keys.add(`${e.kind}:${e.id}`);}

 assert(r.cards.every(c=>c.version===1&&c.keepTarget===null&&c.artMediaId===null&&c.notes==='') && r.printings.every(p=>p.version===1&&p.artMediaId===null&&p.notes===''&&p.providerMaps.length===0),'Catalog contains local or media fields');
}
export function planCatalog(s:State,r:CatalogRelease,choices:CatalogChoices={cards:[],printings:[]}):Candidate[] {
 validateRelease(r);
 const rows:Candidate[]=[];
 const cardIds=new Map(s.cards.map(c=>[c.id,c]));
 const names=new Map<string,Card[]>();
 for(const c of s.cards)for(const n of [c.name,...c.aliases]){const key=normalizeName(n);names.set(key,[...(names.get(key)??[]),c]);}
 const printingIds=new Map(s.printings.map(p=>[p.id,p]));
 const printingNumbers=new Map<string,Printing[]>(),mappedIds=new Map<string,Printing>();
 const numberKey=(p:Printing)=>JSON.stringify([p.gameplayCardId,p.setCode,p.collectorNumber]);
 for(const p of s.printings){const key=numberKey(p);printingNumbers.set(key,[...(printingNumbers.get(key)??[]),p]);for(const m of p.providerMaps)if(m.provider===provider)mappedIds.set(m.externalId,p);}
 const cardChoices=new Map(choices.cards.map(d=>[d.incomingId,d]));
 const cardMap=new Map<string,string>();
 for(const c of r.cards){
  const matches=[...new Set([cardIds.get(c.id),...[c.name,...c.aliases].flatMap(n=>names.get(normalizeName(n))??[])].filter((x):x is Card=>!!x))], stable=matches.find(x=>x.id===c.id&&managedCard(x));
  const decision=cardChoices.get(c.id);
  if(stable)cardMap.set(c.id,stable.id);
  else if(decision?.localId)cardMap.set(c.id,decision.localId);
  else if(!matches.length)cardMap.set(c.id,c.id);
  rows.push({kind:'card',incomingId:c.id,localIds:matches.map(x=>x.id),status:stable?'existing':matches.length>1?'ambiguous':matches.length?'potential':'new',matching:matches.length?['Exact normalized name or alias (candidate only)']:[],differences:matches.flatMap(x=>['name','playsetClass','typeLabel'].filter(k=>canonical(x[k as keyof Card])!==canonical(c[k as keyof Card])))});
 }
 for(const p of r.printings){
  const cardId=cardMap.get(p.gameplayCardId);
  const mapped={...p,gameplayCardId:cardId??p.gameplayCardId};
  const stable=mappedIds.get(p.id);
  const matches=[...new Set([printingIds.get(p.id),...(cardId&&p.collectorNumber!==null?printingNumbers.get(numberKey(mapped))??[]:[])].filter((x):x is Printing=>!!x))];
  if(stable&&!matches.includes(stable))matches.push(stable);
  const exact=matches.filter(x=>printingIdentity(x)===printingIdentity(mapped));
  const differences=matches.flatMap(x=>['gameplayCardId','setCode','collectorNumber','treatment','language','rarity','isPromo','collectorOnly','setName','source','sourceText'].filter(k=>canonical(x[k as keyof Printing])!==canonical(mapped[k as keyof Printing])));
  rows.push({kind:'printing',incomingId:p.id,localIds:matches.map(x=>x.id),status:!cardId?'conflict':stable?(printingIdentity(stable)===printingIdentity(mapped)?'existing':'conflict'):matches.length>1?'ambiguous':matches.length?(exact.length?'potential':'conflict'):'new',matching:matches.length?['Gameplay identity, set code, collector number; exact identity also requires treatment and language']:[],differences:[...new Set(differences)]});
 }
 return rows;
}
/** Adoption retains local primary keys and all physical lots. The operation ledger records incoming→local mappings. */
export function applyCatalog(s:State,r:CatalogRelease,choices:CatalogChoices) {
 const plan=planCatalog(s,r,choices);
 const byKey=new Map(plan.map(row=>[`${row.kind}:${row.incomingId}`,row]));
 const cardChoices=new Map(choices.cards.map(d=>[d.incomingId,d])),printingChoices=new Map(choices.printings.map(d=>[d.incomingId,d]));
 const cardsById=new Map(s.cards.map(c=>[c.id,c])),printingsById=new Map(s.printings.map(p=>[p.id,p]));
 const managed=new Map(s.printings.flatMap(p=>p.providerMaps.filter(m=>m.provider===provider).map(m=>[m.externalId,p] as const)));
 const evidence=new Map(r.evidence.filter(e=>e.kind==='printing').map(e=>[e.id,e]));

 assert(choices && Object.keys(choices).sort().join(',')==='cards,printings');
 for(const [kind,list] of [['card',choices.cards],['printing',choices.printings]] as const){
  assert(Array.isArray(list)&&new Set(list.map(d=>d.incomingId)).size===list.length,'Duplicate decisions');
  for(const d of list){assert(d&&Object.keys(d).sort().join(',')==='incomingId,localId'&&(d.localId===null||typeof d.localId==='string'));const row=byKey.get(`${kind}:${d.incomingId}`);assert(row&&(d.localId===null||row.localIds.includes(d.localId)),'Unsupported match');}
 }
 const cardMap=new Map<string,string>();
 for(const c of r.cards){
  const row=byKey.get(`card:${c.id}`)!;
  const d=cardChoices.get(c.id);
  if(d?.localId===null)continue;
  if(row.status==='new'){s.cards.push({...structuredClone(c),classificationSource:`catalog:${r.version}:${c.classificationSource??'unknown'}`});cardMap.set(c.id,c.id);}
  else {
   const localId=d?.localId??(row.status==='existing'?c.id:null);
   if(!localId)continue;
   const old=cardsById.get(localId)!;cardMap.set(c.id,localId);
   // Custom gameplay identities are retained verbatim; name matching never merges holdings.
   if(managedCard(old)&&d){const next={...old,name:c.name,aliases:[...new Set([...old.aliases,...c.aliases])],playsetClass:c.playsetClass,typeLabel:c.typeLabel,classificationSource:`catalog:${r.version}:${c.classificationSource??'unknown'}`,version:old.version};if(canonical(next)!==canonical(old))Object.assign(old,{...next,version:old.version+1});}
  }
 }
 for(const p of r.printings){
  const cardId=cardMap.get(p.gameplayCardId);if(!cardId)continue;
  const row=byKey.get(`printing:${p.id}`)!;
  const d=printingChoices.get(p.id);
  if(d?.localId===null)continue;
  const stable=managed.get(p.id);
  if(row.status!=='new'&&!d)continue;
  const old=d?.localId?printingsById.get(d.localId):undefined;
  assert(!stable||!old||stable.id===old.id,'Catalog mapping already assigned');
  const incoming={...structuredClone(p),gameplayCardId:cardId};
  if(old){
   assert(printingIdentity(old)===printingIdentity(incoming),'Conflicting exact identity; retain separately');
   assert(!old.providerMaps.some(m=>m.provider===provider&&m.externalId!==p.id),'Local printing already mapped');
  }else assert(row.status==='new','Review required');
  const mapping={id:`catalog:${p.id}`,provider,externalId:p.id,externalSub:r.version,externalUrl:null,verifiedBy:`Catalog ${evidence.get(p.id)!.status}; see operation provenance`,verifiedAt:r.releasedAt};
  const next={...incoming,id:old?.id??p.id,notes:old?.notes??'',sourceText:old?.sourceText??p.sourceText,providerMaps:[...(old?.providerMaps.filter(m=>m.provider!==provider)??[]),mapping],version:old?.version??1};
  if(old){if(canonical(old)!==canonical(next))Object.assign(old,{...next,version:old.version+1});}else s.printings.push(next);
 }
 validateState(s);
}
