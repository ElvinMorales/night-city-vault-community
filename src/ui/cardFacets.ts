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
function tags(value: string | null): string[] {
 return (value ?? '').split(' · ').slice(1).map(t => t.trim()).filter(Boolean);
}

/** Read-only display lookup; ambiguous names never supply inferred metadata. */
export function buildCatalogFacetLookup(cards: Card[]): Map<string, Card | null> {
 const map = new Map<string, Card | null>();
 for (const card of cards) {
  const key = normalizeName(card.name);
  if (!key) continue;
  if (map.has(key)) map.set(key,null);
  else map.set(key,card);
 }
 return map;
}

export function resolveCardFacets(card: Card, lookup: Map<string, Card | null>): CardFacets {
 const fallback = lookup.get(normalizeName(card.name));
 const ownTags = tags(card.typeLabel);
 return {
  color: recognizedColor(card.colors) ?? recognizedColor(fallback?.colors ?? null) ?? 'Unknown',
  cardType: recognizedType(card.typeLabel) ?? (card.playsetClass==='legend'?'Legend':null) ?? recognizedType(fallback?.typeLabel ?? null) ?? 'Unknown',
  tags: ownTags.length ? ownTags : tags(fallback?.typeLabel ?? null),
 };
}

export function matchesCardFacets(facets: CardFacets, printings: Printing[], f: BrowseFacets, edition: (p: Printing)=>boolean): boolean {
 if(f.color!=='All' && facets.color!==f.color) return false;
 if(f.cardType!=='All' && facets.cardType!==f.cardType) return false;
 if(f.tag && !facets.tags.some(t=>normalizeName(t)===normalizeName(f.tag))) return false;
 if(f.rarity && !printings.some(p=>p.rarity===f.rarity&&edition(p))) return false;
 return true;
}
