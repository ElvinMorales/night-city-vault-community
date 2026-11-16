// Explicit offline extraction only: pass a downloaded, pinned committed cards.json.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
const expected='840cacf8180c8a97fe124b5928614e2386bf699f83c443f132f4b0d12b01edbe';
const bytes=readFileSync(process.argv[2]);
if(createHash('sha256').update(bytes).digest('hex')!==expected)throw Error('Pinned source digest mismatch');
const fields=['id','external_id','name','subname','display_name','color','card_type','classifications'];
const printingFields=['id','collector_number','set','rarity','finish','language','localized_name'];
const cards=JSON.parse(bytes).cards.map(c=>({...Object.fromEntries(fields.map(k=>[k,c[k]])),printings:c.printings.map(p=>Object.fromEntries(printingFields.map(k=>[k,p[k]])))}));
mkdirSync('local-catalog',{recursive:true});
writeFileSync('local-catalog/archive-metadata.json',JSON.stringify(cards,null,2)+'\n');
console.log(`Extracted ${cards.length} gameplay records without rules, art, URLs or holdings`);
