import { describe, it, expect } from 'vitest';
import { cardStats, collectionTotals, deckReadiness, valueSummary, isStale, bestQuote, parseDecklist } from '../../src/domain/analysis';
import { artworkReport, type ArtworkEntry } from '../../src/domain/artworkResolver';
import { printingIdentity } from '../../src/domain/printingIdentity';
import { deriveLot } from '../../src/domain/invariants';
import { card, lot, printing, snapshot } from '../fixtures/fictional';
describe('fictional collection characterization', () => {
 it('preserves ownership, buckets, keep targets and classification', () => {
  expect(cardStats(card,[lot])).toMatchObject({owned:8, free:4, buildable:6, playable:8, beyondPlayset:4, goal:3, forTrade:1});
  expect(cardStats({...card,playsetClass:'legend'},[])).toMatchObject({goal:1,playsetStatus:'missing'});
  expect(cardStats({...card,playsetClass:'unknown',keepTarget:6},[lot])).toMatchObject({goal:3,keep:6,beyondPlayset:1,playsetStatus:'needs-classification'});
 });
 it('explicitly corrects legacy sealed free/buildable while retaining ownership completion', () => {
  const sealed={...lot,isSealed:true,quantity:3,protectedQty:0,allocatedQty:0,forTradeQty:0};
  const legacyFree=Math.max(0,sealed.quantity-sealed.protectedQty-sealed.allocatedQty-sealed.forTradeQty);
  expect(legacyFree).toBe(3);
  expect(cardStats(card,[sealed])).toMatchObject({owned:3,free:0,buildable:0,playable:0,playsetStatus:'complete'});
  expect(cardStats(card,[{...sealed,allocatedQty:1}]).buildable).toBe(0); // Defensive against an invalid read model; commands reject this allocation.
 });
 it('derives allocations by compound reference and rejects invalid encumbrances', () => {
  expect(deriveLot({...lot,kind:'unresolved'},[{id:'a',lotKind:'holding',lotId:lot.id,quantity:4,container:'',containerKind:'deck',deckPlanId:null,notes:''}]).allocatedQty).toBe(0);
  expect(() => deriveLot({...lot,quantity:-1},[])).toThrow();
  expect(() => deriveLot({...lot,isSealed:true},[{id:'a',lotKind:'holding',lotId:lot.id,quantity:1,container:'',containerKind:'deck',deckPlanId:null,notes:''}])).toThrow();
 });
 it('counts unresolved and sealed ownership, clamps open incoming ranges', () => {
  const s=snapshot();s.lots=[{...lot,kind:'unresolved',printingId:null,isSealed:true}];
  s.trades=[{id:'t',counterparty:'Fictional trader',title:'Example',status:'open',notes:'',lines:[{id:'l',gameplayCardId:card.id,cardName:card.name,expectedMin:2,expectedMax:5,receivedQty:3,notes:''}]}];
  expect(collectionTotals(s)).toMatchObject({copies:8,unresolvedCopies:8,pendingMin:0,pendingMax:2});
 });
 it('consumes shared deck pool in section order, handles unknown cards and sealed copies', () => {
  const s=snapshot();s.lots=[{...lot,quantity:2,protectedQty:0,allocatedQty:0,forTradeQty:0}];
  const deck={id:'d',name:'Fiction',format:'fictional',legalityStatus:'unverified' as const,source:'',notes:'',version:1,lines:[{id:'a',gameplayCardId:card.id,cardName:card.name,section:'legend' as const,quantity:1},{id:'b',gameplayCardId:card.id,cardName:card.name,section:'main' as const,quantity:2},{id:'c',gameplayCardId:null,cardName:'Imaginary Missing',section:'side' as const,quantity:1}]};
  expect(deckReadiness(deck,s)).toMatchObject({covered:2,shortBy:2,sectionTotals:{legend:{covered:1},main:{covered:1},side:{covered:0}}});
  s.lots[0].isSealed=true;expect(deckReadiness(deck,s).covered).toBe(0);
 });
 it('preserves printing identity without numeric coercion', () => {
  const key=printingIdentity(printing);
  for(const change of [{setCode:'BETA'},{collectorNumber:'7'},{language:'fr'},{treatment:'regular'}]) expect(printingIdentity({...printing,...change})).not.toBe(key);
  expect(printingIdentity({...printing,collectorNumber:null})).toBe(printingIdentity({...printing,collectorNumber:''}));
 });
 it('distinguishes zero/missing quotes and unresolved value with fixed stale boundary', () => {
  const s=snapshot(); const q={id:'q',printingId:printing.id,provider:'manual',market:'fictional',priceType:'manual',condition:'unknown',variant:'',currency:'USD' as const,amountCents:0,status:'manual' as const,observedAt:'2026-01-01T00:00:00Z',fetchedAt:'2026-01-01T00:00:00Z',externalId:null,url:null,urlKind:null,notes:''};
  s.quotes=[q,{...q,id:'err',status:'error',amountCents:100,observedAt:'2026-02-01T00:00:00Z'}];
  expect(bestQuote(s.quotes,printing.id)).toEqual(q);
  expect(valueSummary(s,Date.parse(q.observedAt))).toMatchObject({knownCents:0,pricedCopies:8,unpricedCopies:0});
  s.quotes=[];s.lots.push({...lot,id:'u',kind:'unresolved',printingId:null,quantity:2});
  expect(valueSummary(s,0)).toMatchObject({unpricedCopies:8,unresolvedCopies:2});
  expect(isStale(q.observedAt,30,Date.parse(q.observedAt)+30*86400000)).toBe(false);
  expect(isStale(q.observedAt,30,Date.parse(q.observedAt)+30*86400000+1)).toBe(true);
 });
 it('parses only fictional deck text',()=>expect(parseDecklist('Legends:\n1 Clockwork Turnip\nSideboard:\nImaginary Plum x2').lines).toHaveLength(2));
});
describe('artwork confidence with symbolic blobs, no image assets',()=>{
 const generic:ArtworkEntry={id:'g',canonicalCardId:card.id,printingId:null,imageBlob:'fictional-blob',thumbnailBlob:null,source:'fictional',attribution:'Test author',rightsStatus:'owner-attested',permissionEvidence:'Synthetic test only',printingEvidence:'',confidence:'generic'};
 const exact:ArtworkEntry={...generic,id:'e',printingId:printing.id,confidence:'exact',printingEvidence:'Fictional evidence'};
 const run=(entries:ArtworkEntry[],p=printing)=>artworkReport([card],[p],entries,new Set(['fictional-blob']));
 it('prefers exact only for matching printing; canonical uses generic; counts once',()=>{
  const r=run([generic,exact]); expect(r.rows.map(x=>x.confidence)).toEqual(['generic','exact']);expect(r.totals).toEqual({exact:1,generic:0,missing:0});
  expect(run([exact]).rows[0].confidence).toBe('missing');
 });
 it('rejects rights, identity, evidence and missing blobs',()=>{
  for(const e of [{...exact,rightsStatus:'restricted' as const},{...exact,rightsStatus:'unverified' as const},{...exact,permissionEvidence:''},{...exact,printingEvidence:''},{...exact,canonicalCardId:'wrong'},{...exact,printingId:'wrong'},{...generic,printingId:printing.id},{...generic,imageBlob:'absent'},{...generic,thumbnailBlob:'absent'}]) expect(run([e]).rejected).toHaveLength(1);
 });
 it('requires review for ambiguity and special-printing generic fallback',()=>{
  expect(run([generic,{...generic,id:'g2'}]).rows[1]).toMatchObject({confidence:'missing',needsReview:true});
  expect(run([generic],{...printing,isPromo:true}).rows[1].needsReview).toBe(true);
 });
 it('uses canonical coverage for cards without printings and never mutates inventory',()=>{
  const state=snapshot();state.printings=[];const before=JSON.stringify(state);expect(artworkReport(state.cards,state.printings,[generic],new Set(['fictional-blob'])).totals.generic).toBe(1);expect(JSON.stringify(state)).toBe(before);
 });
});
