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
  expect(matchesCardFacets(facets,[p],{...f,color:'Red'},()=>true)).toBe(false);
  expect(matchesCardFacets(facets,[p],{...f,tag:'Fixer'},()=>true)).toBe(false);
  expect(matchesCardFacets(facets,[p],{...f,rarity:'Epic'},()=>true)).toBe(false);
 });
});
