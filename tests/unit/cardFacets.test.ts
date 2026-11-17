import type {Card} from '../../src/domain/types';
import {describe,expect,it} from 'vitest';
import {buildCatalogFacetLookup,matchesCardFacets,resolveCardFacets} from '../../src/ui/cardFacets';
import {card,printing} from '../fixtures/fictional';
describe('color-aware collection browsing',()=>{
 const official={...card,id:'source',name:'Imaginary Netrunner',colors:'Blue',typeLabel:'Unit · Netrunner · Corpo'};
 const older={...card,id:'imported',name:'Imaginary Netrunner',colors:null,typeLabel:null,playsetClass:'standard' as const};
 it('honors known user card fields',()=>{
  const f=resolveCardFacets({...older,colors:'Red',typeLabel:'Gear · Cyberware'},buildCatalogFacetLookup([official]));
  expect(f).toEqual({color:'Red',cardType:'Gear',tags:['Cyberware']});
 });
 it('matches older imports only for visual metadata, without changing records',()=>{
  const original=JSON.stringify(older);
  expect(resolveCardFacets(older,buildCatalogFacetLookup([official]))).toEqual({color:'Blue',cardType:'Unit',tags:['Netrunner','Corpo']});
  expect(JSON.stringify(older)).toEqual(original);
 });
 it('treats a colon versus display em dash as the same unambiguous name',()=>{
  const imported={...older,name:'Imaginary: Netrunner'};
  const catalog={...official,name:'Imaginary — Netrunner'};
  expect(resolveCardFacets(imported,buildCatalogFacetLookup([catalog])).color).toBe('Blue');
 });
 it('does not guess when a catalog name is ambiguous',()=>{
  expect(resolveCardFacets(older,buildCatalogFacetLookup([official,{...official,id:'other',colors:'Green'}])))
   .toEqual({color:'Unknown',cardType:'Unknown',tags:[]});
  expect(resolveCardFacets({...older,colors:'Purple'},new Map()).color).toBe('Unknown');
 });
 it('filters by color, type, tag and edition-matched rarity',()=>{
  const facets=resolveCardFacets(older,buildCatalogFacetLookup([official]));
  const p={...printing,rarity:'Rare',setCode:'retail'};
  const f={color:'Blue',cardType:'Unit',tag:'Netrunner',rarity:'Rare'};
  expect(matchesCardFacets(facets,[p],f,p=>p.setCode==='retail')).toBe(true);
  expect(matchesCardFacets(facets,[p],f,p=>p.setCode==='beta')).toBe(false);
  expect(matchesCardFacets(facets,[p,{...p,id:'beta',setCode:'beta',rarity:'Epic'}],{...f,rarity:'Epic'},p=>p.setCode==='retail')).toBe(false);
  expect(matchesCardFacets(facets,[p],{...f,color:'Red'},()=>true)).toBe(false);
  expect(matchesCardFacets(facets,[p],{...f,tag:'Fixer'},()=>true)).toBe(false);
  expect(matchesCardFacets(facets,[p],{...f,rarity:'Epic'},()=>true)).toBe(false);
 });
 it('preserves explicit metadata conflicts and fills compatible missing tags',()=>{
  const lookup=buildCatalogFacetLookup([official]);
  for(const colors of ['Purple','Red/Blue','Neutral','Unknown'])
   expect(resolveCardFacets({...older,colors},lookup).color).toBe('Unknown');
  expect(resolveCardFacets({...older,typeLabel:'Gear'},lookup)).toEqual({color:'Unknown',cardType:'Gear',tags:[]});
  expect(resolveCardFacets({...older,typeLabel:'Unit'},lookup).tags).toEqual(['Netrunner','Corpo']);
  expect(resolveCardFacets({...older,typeLabel:'Custom'},lookup)).toEqual({color:'Unknown',cardType:'Unknown',tags:[]});
  expect(resolveCardFacets({...older,colors:'Red'},lookup)).toEqual({color:'Red',cardType:'Unknown',tags:[]});
  expect(resolveCardFacets({...older,playsetClass:'legend'},lookup)).toEqual({color:'Unknown',cardType:'Legend',tags:[]});
 });
 it('handles spaced hyphens, curly apostrophes and punctuation collisions conservatively',()=>{
  const source={...official,name:"Imaginary: Runner's"};
  const local={...older,name:'Imaginary - Runner’s'};
  expect(resolveCardFacets(local,buildCatalogFacetLookup([source])).color).toBe('Blue');
  expect(resolveCardFacets(local,buildCatalogFacetLookup([source,{...source,id:'collision',name:'Imaginary — Runner’s'}])).color).toBe('Unknown');
  expect(resolveCardFacets({...older,name:'Imaginary-Runner'},buildCatalogFacetLookup([source])).color).toBe('Unknown');
 });
 it('leaves custom, missing and review-flagged identities unresolved without mutations',()=>{
  const local=Object.freeze({...older,name:'Custom manual card'});
  const source=Object.freeze({...official});
  const lookup=buildCatalogFacetLookup([source]);
  expect(resolveCardFacets(local,lookup)).toEqual({color:'Unknown',cardType:'Unknown',tags:[]});
  expect(resolveCardFacets({...older,needsReview:'Identity uncertain'},lookup).color).toBe('Unknown');
  expect(resolveCardFacets(older,buildCatalogFacetLookup([{...source,needsReview:'Source conflict'}])).color).toBe('Unknown');
  expect(lookup.get('imaginary netrunner')).toBe(source);
 });
 it('covers every actual packaged color and type without promoting source certainty',async()=>{
  const {default:catalog}=await import('../../local-catalog/catalog.json');
  const lookup=buildCatalogFacetLookup(catalog.cards as Card[]);
  const counts:Record<string,number>={};
  for(const card of catalog.cards){const f=resolveCardFacets(card as Card,lookup);counts[f.color]=(counts[f.color]??0)+1;expect(f.cardType).not.toBe('Unknown');}
  expect(counts).toEqual({Red:38,Green:38,Blue:38,Yellow:37});
  expect(catalog.evidence.every(e=>e.status==='uncertain')).toBe(true);
 });

});
