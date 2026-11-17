import type { Card, Printing } from '../domain/types';
import { normalizeName } from '../domain/analysis';

// Do not infer an unverified color or merge cards when names match.
export const CARD_COLORS = ['Red','Green','Blue','Yellow'] as const;
export type CardColor = typeof CARD_COLORS[number] | 'Unknown';
export type CardType = 'Legend'|'Unit'|'Gear'|'Program'|'Unknown';
export interface CardFacets { color: CardColor; cardType: CardType; tags: string[]; }
export interface BrowseFacets { color: string; cardType: string; tag: string; rarity: string; }

function recognizedColor(value: string | null): CardColor | null {
 return CARD_COLORS.find(c => c.toLowerCase() === (value ?? '').trim().toLowerCase()) ?? null;
}
function recognizedType(value: string | null): CardType | null {
 const name = (value ?? '').split(' · ')[0].trim().toLowerCase();
 return (['Legend','Unit','Gear','Program'] as const).find(t => t.toLowerCase() === name) ?? null;
}
function lookupName(value: string): string {
 // Official display punctuation may use an em/en dash where a legacy collection uses ':'.
 return normalizeName(value).replace(/\s*[—–]\s*|\s+-\s+/g, ':').replace(/\s*:\s*/g, ':');
}
function tags(value: string | null): string[] {
 return (value ?? '').split(' · ').slice(1).map(t => t.trim()).filter(Boolean);
}

/** Read-only display lookup; ambiguous names never supply inferred metadata. */
export function buildCatalogFacetLookup(cards: Card[]): Map<string, Card | null> {
 const map = new Map<string, Card | null>();
 for (const card of cards) {
  const key = lookupName(card.name);
  if (!key) continue;
  if (map.has(key)) map.set(key,null);
  else map.set(key,card);
 }
 return map;
}

export function resolveCardFacets(card: Card, lookup: Map<string, Card | null>): CardFacets {
 const candidate = lookup.get(lookupName(card.name));
 const ownType = recognizedType(card.typeLabel);
 const candidateType = recognizedType(candidate?.typeLabel ?? null);
 const hasColor = !!card.colors?.trim();
 const hasType = !!card.typeLabel?.trim();
 // A name alone cannot justify mixing metadata across conflicting local identities.
 const fallback = candidate && !candidate.needsReview && !card.needsReview &&
  (!hasType || (ownType !== null && ownType === candidateType)) &&
  (!hasColor || (recognizedColor(card.colors) !== null && recognizedColor(card.colors) === recognizedColor(candidate.colors))) &&
  (card.playsetClass !== 'legend' || candidateType === 'Legend') ? candidate : null;
 return {
  color: recognizedColor(card.colors) ?? (!hasColor ? recognizedColor(fallback?.colors ?? null) : null) ?? 'Unknown',
  cardType: ownType ?? (hasType ? null : card.playsetClass==='legend'?'Legend':recognizedType(fallback?.typeLabel ?? null)) ?? 'Unknown',
  tags: tags(card.typeLabel).length ? tags(card.typeLabel) : tags(fallback?.typeLabel ?? null),
 };
}

export function matchesCardFacets(facets: CardFacets, printings: Printing[], f: BrowseFacets, edition: (p: Printing)=>boolean): boolean {
 if(f.color!=='All' && facets.color!==f.color) return false;
 if(f.cardType!=='All' && facets.cardType!==f.cardType) return false;
 if(f.tag && !facets.tags.some(t=>normalizeName(t)===normalizeName(f.tag))) return false;
 if(f.rarity && !printings.some(p=>p.rarity===f.rarity&&edition(p))) return false;
 return true;
}
