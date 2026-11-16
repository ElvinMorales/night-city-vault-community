import { describe,it,expect } from 'vitest';
import data from '../../local-catalog/archive-metadata.json';
import bundled from '../../local-catalog/catalog.json';
import { transformArchive } from '../../src/catalog/archive';
import { applyCatalog,planCatalog,validateRelease } from '../../src/catalog/catalog';
import { canonical,emptyState } from '../../src/storage/state';
const r=transformArchive(data);
describe('pinned Archive metadata',()=>{
 it('reproduces the bundled local release and validates its strict contract',()=>{expect(r).toEqual(bundled);expect(transformArchive([...data].reverse())).toEqual(r);validateRelease(r);expect(r.cards).toHaveLength(151);expect(r.printings).toHaveLength(860);});
 it('installs without ownership and is idempotent',()=>{const s=emptyState();applyCatalog(s,r,{cards:[],printings:[]});expect(s.lots).toHaveLength(0);const before=canonical(s);applyCatalog(s,r,{cards:[],printings:[]});expect(canonical(s)).toBe(before);expect(planCatalog(s,r).every(p=>p.status==='existing')).toBe(true);});
 it('preserves strings, multiple source printings, language and explicit uncertainty',()=>{const v=r.cards.find(c=>c.name==='V: Streetkid')!;expect(v.playsetClass).toBe('legend');const ps=r.printings.filter(p=>p.gameplayCardId===v.id);for(const n of ['005a','005b','β005a','β005b','144','β144'])expect(ps.some(p=>p.collectorNumber===n)).toBe(true);expect(new Set(r.printings.map(p=>p.id)).size).toBe(860);expect(r.printings.every(p=>p.treatment==='unknown')).toBe(true);expect(r.evidence.every(e=>e.status==='uncertain')).toBe(true);expect(new Set(r.printings.map(p=>p.language))).toEqual(new Set(['en','fr']));});
 it('excludes artwork, rules, URLs and player state from the metadata projection',()=>{expect(JSON.stringify(data)).not.toMatch(/image_url|rules_text|flavor_text|https?:|quantity|forTradeQty/);expect(r.cards.every(c=>c.artMediaId===null&&c.keepTarget===null&&c.notes==='')).toBe(true);});
 it('defers existing user identities without resetting their data',()=>{const s=emptyState();s.cards=[{...r.cards[0],id:'fictional-local-id',notes:'Fictional private test note',classificationSource:null}];applyCatalog(s,r,{cards:[],printings:[]});expect(s.cards.find(c=>c.id==='fictional-local-id')?.notes).toBe('Fictional private test note');expect(s.cards.some(c=>c.id===r.cards[0].id)).toBe(false);expect(planCatalog(s,r)[0].status).toBe('potential');});
});
