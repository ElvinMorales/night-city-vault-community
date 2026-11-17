import type { Card } from '../domain/types';
import { buildCatalogFacetLookup, lookupName } from './cardFacets';
import statData from '../../local-catalog/gameplay-stats.json';

// Immutable, source-reported, non-creative factual fields. No persisted collection mutations.
export interface GameplayStats { cost: number | null; power: number | null; ram: number | null; eddiable: boolean | null; }
export type StatField = 'cost'|'power'|'ram';
export interface GameplayStatFilters { cost: string; power: string; ram: string; eddies: string; }
export const UNKNOWN_STATS: GameplayStats = Object.freeze({cost:null,power:null,ram:null,eddiable:null});
export const statSource = {source:statData.source, snapshotDate:statData.snapshotDate, verification:statData.verification};

function numberOrNull(v: unknown): v is number | null {
 return v===null || (Number.isSafeInteger(v) && (v as number)>=0);
}
export function validateStatRows(rows: GameplayStatsRow[], ids: string[]): void {
 if (!Array.isArray(rows) || rows.length !== ids.length || rows.length > 1000) throw Error('Gameplay stat coverage mismatch');
 const allowed = new Set(ids), seen = new Set<string>();
 for(const row of rows){
  if(!row || Object.keys(row).sort().join(',')!=='cost,eddiable,id,power,ram' || !allowed.has(row.id) || seen.has(row.id)
   || !numberOrNull(row.cost) || !numberOrNull(row.power) || !numberOrNull(row.ram)
   || typeof row.eddiable!=='boolean') throw Error('Invalid or unreviewed gameplay stat record');
  seen.add(row.id);
 }
}
export interface GameplayStatsRow extends GameplayStats { id: string; eddiable: boolean; }
export const gameplayStatsRows: GameplayStatsRow[] = statData.entries as GameplayStatsRow[];

export function buildGameplayStatsResolver(catalogCards: Card[], rows: GameplayStatsRow[] = gameplayStatsRows): (card: Card) => GameplayStats {
 const byId = new Map(catalogCards.map(c=>[c.id,c]));
 const byName = buildCatalogFacetLookup(catalogCards);
 const stats = new Map(rows.filter(x=>byId.has(x.id)).map(x=>[x.id,x]));
 return card=>{
  const candidate = byId.get(card.id) ?? byName.get(lookupName(card.name));
  if(!candidate || !stats.has(candidate.id) || card.needsReview || candidate.needsReview) return UNKNOWN_STATS;
  // An ID alone cannot override contradictory saved identity metadata.
  if(!lookupName(card.name) || lookupName(card.name)!==lookupName(candidate.name)) return UNKNOWN_STATS;
  // Never infer values for a local card that conflicts with the source identity.
  if(card.playsetClass!=='unknown' && card.playsetClass!==candidate.playsetClass) return UNKNOWN_STATS;
  const color=card.colors?.trim().toLowerCase();
  if(color && color!==candidate.colors?.trim().toLowerCase())return UNKNOWN_STATS;
  const ownType=card.typeLabel?.trim().split(' · ')[0].trim().toLowerCase();
  const candidateType=candidate.typeLabel?.trim().split(' · ')[0].trim().toLowerCase();
  if(ownType && ownType!==candidateType) return UNKNOWN_STATS;
  const {cost,power,ram,eddiable}=stats.get(candidate.id)!;
  return {cost,power,ram,eddiable};
 };
}

function exactNumber(value: number | null, choice: string): boolean {
 if(choice==='')return true;
 if(choice==='unknown')return value===null;
 return value!==null && String(value)===choice;
}
/** Eddies is the source's sellable flag, not a price or amount of currency. */
export function matchesGameplayStats(stats: GameplayStats, filters: GameplayStatFilters): boolean {
 return exactNumber(stats.cost,filters.cost)
 && exactNumber(stats.power,filters.power)
 && exactNumber(stats.ram,filters.ram)
 && (filters.eddies==='' || (filters.eddies==='unknown' ? stats.eddiable===null
   : filters.eddies==='sellable' ? stats.eddiable===true
   : filters.eddies==='non-sellable' ? stats.eddiable===false : false));
}
export function statOptions(rows: GameplayStatsRow[], field: StatField): number[] {
 return [...new Set(rows.map(r=>r[field]).filter((n):n is number=>n!==null))].sort((a,b)=>a-b);
}
