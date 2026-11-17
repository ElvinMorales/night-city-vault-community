import {describe,it,expect} from 'vitest';
import {card} from '../fixtures/fictional';
import catalog from '../../local-catalog/catalog.json';
import {buildGameplayStatsResolver,gameplayStatsRows,matchesGameplayStats,statOptions,validateStatRows,UNKNOWN_STATS} from '../../src/ui/gameplayStatFilters';
import type {Card} from '../../src/domain/types';

describe('source-reported gameplay stat browsing',()=>{
 it('matches the pinned 151-card catalog, retains missing values, and validates the source schema',()=>{
  const cards=catalog.cards as Card[];
  expect(cards).toHaveLength(151);expect(gameplayStatsRows).toHaveLength(cards.length);
  expect(()=>validateStatRows(gameplayStatsRows,cards.map(c=>c.id))).not.toThrow();
  expect(gameplayStatsRows.filter(x=>x.cost===null)).toHaveLength(19);
  expect(gameplayStatsRows.filter(x=>x.power===null)).toHaveLength(53);
  expect(gameplayStatsRows.filter(x=>x.ram===null)).toHaveLength(1);
  expect(gameplayStatsRows.filter(x=>x.power===0)).toHaveLength(10);
  expect(gameplayStatsRows.filter(x=>x.eddiable===true)).toHaveLength(78);
  expect(gameplayStatsRows.filter(x=>x.eddiable===false)).toHaveLength(73);
  expect(statOptions(gameplayStatsRows,'power')).toContain(0);
  expect(statOptions(gameplayStatsRows,'ram')).toEqual([1,2,3,4,5,6]);
 });
 it('matches unknown and zero separately, and filters Eddies as sellable, not numeric currency',()=>{
  const base={cost:null,power:0,ram:2,eddiable:false};
  const any={cost:'',power:'',ram:'',eddies:''};
  expect(matchesGameplayStats(base,{...any,power:'0',cost:'unknown',ram:'2',eddies:'non-sellable'})).toBe(true);
  expect(matchesGameplayStats(base,{...any,power:'unknown'})).toBe(false);
  expect(matchesGameplayStats(base,{...any,cost:'0'})).toBe(false);
  expect(matchesGameplayStats(base,{...any,eddies:'sellable'})).toBe(false);
  expect(matchesGameplayStats(UNKNOWN_STATS,{...any,eddies:'unknown',power:'unknown'})).toBe(true);
  expect(matchesGameplayStats(UNKNOWN_STATS,{...any,eddies:'non-sellable'})).toBe(false);
  expect(matchesGameplayStats(base,{...any,eddies:'no-such-choice'})).toBe(false);
 });
 const source={...card,id:'nca-card-source',name:"Imaginary — Runner's",colors:'Blue',typeLabel:'Unit · Netrunner'};
 const row={id:source.id,cost:0,power:10,ram:3,eddiable:true};
 const local={...card,id:'imported-card',name:'Imaginary - Runner’s',colors:null,typeLabel:null,playsetClass:'standard' as const};
 it('uses unique source UUIDs or conservative read-only imported-name matching',()=>{
  const resolve=buildGameplayStatsResolver([source],[row]);
  const frozen=JSON.stringify(local);
  expect(resolve(local)).toEqual({cost:0,power:10,ram:3,eddiable:true});
  expect(resolve(source)).toEqual({cost:0,power:10,ram:3,eddiable:true});
  expect(JSON.stringify(local)).toEqual(frozen);
 });
 it('rejects ambiguous names, conflicting local metadata and review-marked cards',()=>{
  const other={...source,id:'different-id',name:"Imaginary: Runner's"};
  const resolve=buildGameplayStatsResolver([source,other],[row]);
  expect(resolve(local)).toEqual(UNKNOWN_STATS);
  const sole=buildGameplayStatsResolver([source],[row]);
  for(const adjusted of [
   {...local,colors:'Neutral'},{...local,colors:'Red'},
   {...local,typeLabel:'Gear'},{...local,typeLabel:'Custom'},
   {...local,playsetClass:'legend' as const},{...local,needsReview:'Check'},
   {...local,name:'Different Name'},
  ])expect(sole(adjusted)).toEqual(UNKNOWN_STATS);
  expect(sole({...local,typeLabel:'Unit'})).toEqual({cost:0,power:10,ram:3,eddiable:true});
 });
 it('rejects duplicate and non-factual records before use',()=>{
  const ids=[source.id];
  expect(()=>validateStatRows([{...row,ram:-1}],ids)).toThrow();
  expect(()=>validateStatRows([{...row,cost:1.5}],ids)).toThrow();
  expect(()=>validateStatRows([row,row],ids)).toThrow();
  expect(()=>validateStatRows([{...row,id:'unknown'}],ids)).toThrow();
 });
});
