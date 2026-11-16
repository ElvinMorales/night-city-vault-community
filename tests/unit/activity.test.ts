import {describe,it,expect} from 'vitest';
import {describeChange} from '../../src/ui/activityDescription';
import {snapshot,card} from '../fixtures/fictional';
describe('player activity descriptions',()=>{
 it('names the card and committed quantity',()=>{
  const s=snapshot();s.cards=[card];
  expect(describeChange('quick-add',{type:'quick-add',cardId:card.id,quantity:2,printingId:null,isSealed:false},s)).toBe(`2 copies added · ${card.name}`);
 });
 it('does not expose identifiers for cards no longer present',()=>{
  expect(describeChange('quick-add',{type:'quick-add',cardId:'internal-missing',quantity:1,printingId:null,isSealed:false},snapshot())).toBe('1 copy added');
 });
 it('uses an understandable fallback for missing or mismatched historical context',()=>{
  expect(describeChange('reconcile',undefined,snapshot())).toBe('Card version identified');
  expect(describeChange('private-implementation-term',undefined,snapshot())).toBe('Collection updated');
  expect(describeChange('undo',{type:'quick-add',cardId:card.id,quantity:1,printingId:null,isSealed:false},snapshot())).toBe('Last change undone');
 });
});
