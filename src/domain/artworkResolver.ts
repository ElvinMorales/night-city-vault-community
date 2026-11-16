import {ACKNOWLEDGMENT} from '../artwork/media';
import type { Card, Printing } from './types';
export interface ArtworkEntry {
 id: string; canonicalCardId: string; printingId: string | null;
 imageBlob: string; thumbnailBlob: string | null; source: string; attribution: string;
 rightsStatus: 'permission-documented' | 'owner-attested' | 'unverified' | 'restricted';
 permissionEvidence: string; printingEvidence: string; confidence: 'exact' | 'generic' | 'missing';
}
export function artworkReport(cards: Card[], printings: Printing[], entries: ArtworkEntry[], availableBlobs: ReadonlySet<string>) {
 const rejected: string[] = [];
 const cardsById=new Map(cards.map(c=>[c.id,c]));
 const printingsByCard=new Map<string,Printing[]>();for(const p of printings){const list=printingsByCard.get(p.gameplayCardId)??[];list.push(p);printingsByCard.set(p.gameplayCardId,list);}
 const valid = entries.filter(e => {
  const card = cardsById.get(e.canonicalCardId);
  if (!card) { rejected.push(e.id); return false; }
  if (e.confidence === 'missing') return false;
  const personal = e.source === 'personal-local' && e.rightsStatus === 'unverified' && e.permissionEvidence === ACKNOWLEDGMENT;
  const permitted = personal || ['permission-documented', 'owner-attested'].includes(e.rightsStatus) && !!e.permissionEvidence.trim();
  const blobs = availableBlobs.has(e.imageBlob) && (!e.thumbnailBlob || availableBlobs.has(e.thumbnailBlob));
  const identity = e.confidence === 'exact' ? !!e.printingEvidence.trim() && (printingsByCard.get(card.id)??[]).some(p=>p.id===e.printingId) : e.printingId === null;
  if (!permitted || !blobs || !identity) { rejected.push(e.id); return false; }
  return true;
 });
 const entriesByCard=new Map<string,ArtworkEntry[]>();for(const e of valid){const list=entriesByCard.get(e.canonicalCardId)??[];list.push(e);entriesByCard.set(e.canonicalCardId,list);}
 const rows = cards.flatMap(card => ([null, ...(printingsByCard.get(card.id)??[])] as (Printing | null)[]).map(p => {
  const exact = p ? (entriesByCard.get(card.id)??[]).filter(e => e.confidence === 'exact' && e.printingId === p.id) : [];
  const candidates = exact.length ? exact : (entriesByCard.get(card.id)??[]).filter(e => e.confidence === 'generic');
  const special = !!p && (p.isPromo || /iconic|promo/i.test(`${p.rarity} ${p.treatment} ${p.setName}`));
  return {cardId: card.id, printingId: p?.id ?? null, candidates, confidence: candidates.length === 1 ? candidates[0].confidence : 'missing', needsReview: candidates.length > 1 || (special && candidates.length > 0 && !exact.length)};
 }));
 const coverage = rows.filter(r => r.printingId !== null || !printingsByCard.has(r.cardId));
 return {rows, rejected, totals: Object.fromEntries(['exact', 'generic', 'missing'].map(c => [c, coverage.filter(r => r.confidence === c).length]))};
}
