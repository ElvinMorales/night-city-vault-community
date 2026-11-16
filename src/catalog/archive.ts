import type { CatalogRelease } from './catalog';
export const archiveCommit='40eab012f0b683f4dc706df65ebf8dc5587f986c';
export interface ArchiveCard {
 id:string; external_id:string; name:string; subname:string|null; display_name:string;
 color:string|null; card_type:string; classifications:string[];
 printings:{id:string;collector_number:string|null;set:{code:string;name:string};rarity:string|null;finish:string|null;language:string|null;localized_name:string|null}[];
}
/** Source UUIDs, never names or collector-number arithmetic, are persistent keys. */
export function transformArchive(input:ArchiveCard[]):CatalogRelease {
 const rows=[...input].sort((a,b)=>a.id.localeCompare(b.id,'en'));
 const source='night-city-archive';
 const cards=rows.map(c=>({id:`nca-card-${c.id}`,name:c.display_name,aliases:[...new Set([c.name,c.subname,c.external_id,...c.printings.map(p=>p.localized_name)].filter((s):s is string=>!!s&&s!==c.display_name))].sort(),playsetClass:c.card_type==='Legend'?'legend' as const:['Unit','Gear','Program'].includes(c.card_type)?'standard' as const:'unknown' as const,typeLabel:[c.card_type,...c.classifications].join(' · '),classificationSource:`${source}:${c.id}:${c.external_id}`,colors:c.color,keepTarget:null,artMediaId:null,needsReview:null,notes:'',version:1}));
 // Ambiguous short/localized names cannot be global aliases under the existing uniqueness contract.
 const uses=new Map<string,Set<string>>();
 for(const c of cards)for(const name of [c.name,...c.aliases]){const key=name.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' ');const ids=uses.get(key)??new Set<string>();ids.add(c.id);uses.set(key,ids);}
 for(const c of cards)c.aliases=c.aliases.filter(name=>uses.get(name.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' '))?.size===1);
 const printings=rows.flatMap(c=>[...c.printings].sort((a,b)=>a.id.localeCompare(b.id,'en')).map(p=>({id:`nca-print-${p.id}`,gameplayCardId:`nca-card-${c.id}`,setCode:p.set.code,setName:p.set.name,collectorNumber:p.collector_number,language:p.language??'unknown',rarity:p.rarity,treatment:p.finish??'unknown',isPromo:/promo|PRM01|prerelease|brawl|showdown|edgerunner|boxtopper/i.test(p.set.code),collectorOnly:false,source,sourceText:`Source printing ${p.id}; finish ${p.finish??'not specified'}; physical treatment unverified. Rarity: ${p.rarity??'unknown'}.`,artMediaId:null,notes:'',providerMaps:[],version:1})));
 return {format:'community-catalog@1',version:`nca-local-v1-${archiveCommit.slice(0,12)}`,releasedAt:'2026-11-16',sources:[{id:source,reference:`github.com/ttiiggss/night-city-archive @ ${archiveCommit}; data/cards.json; obtained 2026-11-16; transform 1`,rights:'Reviewed factual metadata; no upstream license or endorsement claimed. Provenance and residual risks: docs/catalog-distribution-review.md. No artwork, rules or flavor text included.'}],coverage:`${cards.length} gameplay identities; ${printings.length} source-identified printing records. Finish unspecified remains unknown; no fully verified physical treatments. Retail, Beta, starters, promos and French present; completeness not asserted.`,cards,printings,evidence:[...cards.map(c=>({kind:'card' as const,id:c.id,sourceIds:[source],status:'uncertain' as const,notes:'Source gameplay UUID and external identifier retained; not independently verified.'})),...printings.map(p=>({kind:'printing' as const,id:p.id,sourceIds:[source],status:'uncertain' as const,notes:'Source UUID, set, number and language distinguish this source record. Missing finish is explicitly unknown; this is a provisional physical identity, not verified exact treatment. Do not infer stamp, foil or artwork variant.'}))]};
}
