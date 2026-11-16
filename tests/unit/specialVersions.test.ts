import {it,expect} from 'vitest';
import {specialVersionLabels,confirmedTreatment} from '../../src/domain/specialVersions';
import {printingLabel} from '../../src/ui/PrintingPicker';
import {printingLabel as summaryLabel} from '../../src/domain/analysis';
import {printingIdentity} from '../../src/domain/printingIdentity';
import {emptyState,validateState,canonical} from '../../src/storage/state';
import {apply} from '../../src/storage/commands';
import {prepareCommand} from '../../src/storage/indexeddb/repository';
import {card,printing,lot} from '../fixtures/fictional';
import {applyCatalog} from '../../src/catalog/catalog';
import {release} from '../fixtures/catalog';
it('hides missing finish in ordinary labels without changing data or inferring regular',()=>{
 const before=canonical(printing);expect(printingLabel(printing)).not.toMatch(/unknown|finish/i);expect(summaryLabel(printing)).not.toMatch(/unknown|finish/i);expect(specialVersionLabels(printing)).toEqual([]);expect(canonical(printing)).toBe(before);
 const artVariant={...printing,rarity:'Iconic',setName:'Foil art'};expect(specialVersionLabels(artVariant)).toEqual([]);
});
it('keeps finish, stamps and promo independent and multiple attributes stable',()=>{
 expect(specialVersionLabels({...printing,treatment:'foil + WTNC stamped',isPromo:true})).toEqual(['Foil','WTNC stamped','Promo']);
 expect(specialVersionLabels({...printing,treatment:'holographic'})).toEqual(['Holographic']);
 expect(specialVersionLabels({...printing,treatment:'holographic WTNC stamped'})).toEqual(['holographic WTNC stamped']);
 expect(confirmedTreatment(['Promo'],'')).toBe('unknown');
 expect(confirmedTreatment(['Foil'],'foil + Foil')).toBe('foil');
 expect(confirmedTreatment(['Stamped','Foil'],'')).toBe(confirmedTreatment(['Foil','Stamped'],''));
});
it('creates same-number local variants, rejects collisions and preserves inventory on confirmed updates',async()=>{
 const s=emptyState();s.cards=[structuredClone(card)];s.printings=[structuredClone(printing)];
 const {allocatedQty:_,...stored}=lot;s.lots=[stored];s.allocations=[{id:'a',lotKind:'holding',lotId:lot.id,container:'test',containerKind:'binder',deckPlanId:null,quantity:2,notes:''}];
 const physical=canonical([s.lots,s.allocations]);
 const custom={...printing,id:'local-foil',treatment:'foil',isPromo:true,source:'manual-exact'};
 apply(s,await prepareCommand('create',{type:'save-printing',printing:custom}));validateState(s);
 expect(printingIdentity(s.printings[0])).not.toBe(printingIdentity(custom));
 const collision=structuredClone(s);collision.printings.push({...custom,id:'duplicate'});expect(()=>validateState(collision)).toThrow(/collision/);
 apply(s,await prepareCommand('confirm',{type:'save-printing',printing:{...printing,treatment:'holographic'}},[{entity:'printings',id:printing.id,version:1},{entity:'revision',id:'collection',version:0}]));validateState(s);
 expect(canonical([s.lots,s.allocations])).toBe(physical);expect(s.printings[0].id).toBe(printing.id);
 const before=canonical(custom);applyCatalog(s,release(),{cards:[],printings:[]});expect(canonical(s.printings.find(p=>p.id===custom.id))).toBe(before);
});
