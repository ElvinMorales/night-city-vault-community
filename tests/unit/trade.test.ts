import { it, expect } from 'vitest';
import { cardStats } from '../../src/domain/analysis';
import { tradeCSV, tradeText, tradeRows, csvCell, tradeCapacity } from '../../src/interchange/trade';
import { card, lot, snapshot } from '../fixtures/fictional';
it('uses custom ownership targets, defaults and explicit unknown classification',()=>{
 for(const [playsetClass,goal] of [['standard',3],['legend',1]] as const){
  expect(cardStats({...card,playsetClass},[{...lot,quantity:goal}]).playsetStatus).toBe('complete');
  expect(cardStats({...card,playsetClass,keepTarget:goal+1},[{...lot,quantity:goal}]).playsetStatus).toBe('incomplete');
 }
 expect(cardStats({...card,keepTarget:0},[]).playsetStatus).toBe('complete');
 expect(cardStats({...card,playsetClass:'unknown',keepTarget:0},[lot]).playsetStatus).toBe('needs-classification');
});
it('separates sealed and unresolved completion, extras and free copies',()=>{
 const l={...lot,kind:'unresolved' as const,printingId:null,isSealed:true};
 expect(cardStats(card,[l])).toMatchObject({owned:8,free:0,unresolvedQty:8,beyondPlayset:4,forTrade:1,playsetStatus:'complete'});
 expect(tradeCapacity(l)).toBe(5);
 expect(cardStats(card,[lot])).toMatchObject({free:4,beyondPlayset:4,allocated:2});
});
it('exports only marked quantities and explicit public identity fields',()=>{
 const s=snapshot();s.cards[0].name='=fiction,"Turnip"\nSprout';s.cards[0].notes='PRIVATE_CARD';
 s.lots[0]={...lot,location:'PRIVATE_LOCATION',notes:'PRIVATE_NOTES',isSealed:true};
 s.lots.push({...lot,id:'unknown',kind:'unresolved',printingId:null,forTradeQty:2});
 const csv=tradeCSV(s),text=tradeText(s);
 expect(tradeRows(s).map(r=>r[6])).toEqual(['1','2']);
 expect(csv).toContain("\"'=fiction,\"\"Turnip\"\"\nSprout\"");
 expect(csv).toContain('007');expect(csv).toContain('Unresolved printing');expect(text).toContain('2x');expect(text).toContain('Sealed');
 for(const v of ['PRIVATE_CARD','PRIVATE_LOCATION','PRIVATE_NOTES']){expect(csv).not.toContain(v);expect(text).not.toContain(v);}
 s.lots.forEach(l=>l.forTradeQty=0);expect(tradeText(s)).toBe('');expect(tradeRows(s)).toEqual([]);
});
it('escapes spreadsheet formulas including whitespace and CSV quotes',()=>{
 for(const v of ['=1','+1','-1','@mention','  =1','\tvalue','\rvalue','\nvalue'])expect(csvCell(v)).toBe(`"'${v}"`);
 expect(csvCell('a,"b"')).toBe('"a,""b"""');
});
