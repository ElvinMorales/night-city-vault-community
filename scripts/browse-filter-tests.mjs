// Read-only production UI checks against the bundled factual metadata.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
export async function reviewBrowseFilters(page){
 const catalog=JSON.parse(await readFile('local-catalog/catalog.json','utf8'));
 const stored=()=>page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('community-collection-local');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{const tx=db.transaction([...db.objectStoreNames]);return await Promise.all([...db.objectStoreNames].map(name=>new Promise((resolve,reject)=>{const r=tx.objectStore(name).getAll();r.onsuccess=()=>resolve([name,r.result]);r.onerror=()=>reject(r.error);})));}finally{db.close();}});
 await page.waitForFunction(()=>!document.querySelector('nav button').disabled);
 const before=await stored();
 // Observe writes as well as final state: a write followed by a compensating write is unsafe too.
 await page.evaluate(()=>{
  window.__browseWrites=[];
  const transaction=IDBDatabase.prototype.transaction;
  IDBDatabase.prototype.transaction=function(...args){
   if(args[1]==='readwrite')window.__browseWrites.push(String(args[0]));
   return transaction.apply(this,args);
  };
 });
 const toggle=page.getByRole('button',{name:/^Filters/});
 const panel=page.getByRole('group',{name:'Additional card filters',exact:true});
 const search=page.getByRole('searchbox',{name:'Search cards'});
 const color=value=>page.getByRole('group',{name:'Card color',exact:true}).getByRole('button',{name:value,exact:true});
 const edition=value=>page.getByLabel('Set / Edition',{exact:true}).selectOption(value);
 const inEdition=(p,e)=>{const en=/^(en|english)$/i.test(p.language);return e==='all'||(e==='retail'?p.setCode==='welcometonightcityretail'&&en:e==='beta'?/beta/i.test(p.setCode):e==='special'?p.isPromo||/promo|special|iconic/i.test(p.setCode+' '+p.treatment):!en);};
 const titles=()=>page.locator('article .card-title').allTextContents();
 assert.equal(await toggle.getAttribute('aria-expanded'),'false');
 assert.equal(await panel.count(),0);
 assert.equal(await page.locator('#additional-card-filters').count(),1,'Collapsed aria-controls target exists');
 await toggle.focus();await page.keyboard.press('Enter');
 assert.equal(await toggle.getAttribute('aria-expanded'),'true');
 for(const control of [page.getByLabel('Set / Edition',{exact:true}),page.getByLabel('View',{exact:true}),color('All')]){await page.keyboard.press('Tab');assert.ok(await control.evaluate(e=>e===document.activeElement));}
 assert.ok(await page.getByText('Catalog colors, types, tags and rarities are source-reported, not independently confirmed.',{exact:false}).isVisible());
 // Each real color in isolation, and a deliberate empty result.
 await edition('all');
 for(const value of ['Red','Green','Blue','Yellow','Unknown']){
  await color(value).click();
  assert.deepEqual(await titles(),catalog.cards.filter(c=>c.colors===value).map(c=>c.name));
 }
 assert.ok(await page.getByText('No cards match these filters.',{exact:true}).isVisible());
 await page.getByRole('button',{name:'Clear browsing filters'}).click();
 for(const type of ['Legend','Unit','Gear','Program','Unknown']){
  await page.getByRole('combobox',{name:'Card type',exact:true}).selectOption(type);
  assert.deepEqual(await titles(),catalog.cards.filter(c=>c.typeLabel.split(' · ')[0]===type).slice(0,100).map(c=>c.name));
 }
 await page.getByRole('combobox',{name:'Card type',exact:true}).selectOption('All');
 await page.getByRole('combobox',{name:'Tag',exact:true}).selectOption('Merc');
 assert.deepEqual(await titles(),catalog.cards.filter(c=>c.typeLabel.split(' · ').slice(1).includes('Merc')).map(c=>c.name));
 await page.getByRole('combobox',{name:'Tag',exact:true}).selectOption('');
 await page.getByRole('combobox',{name:'Rarity',exact:true}).selectOption('Rare');
 assert.deepEqual(await titles(),catalog.cards.filter(c=>catalog.printings.some(p=>p.gameplayCardId===c.id&&p.rarity==='Rare')).slice(0,100).map(c=>c.name));
 await page.getByRole('combobox',{name:'Rarity',exact:true}).selectOption('');
 // All four facets intersect search, ownership, editions and both layouts.
 const target=catalog.cards.find(c=>c.typeLabel.includes(' · ')&&catalog.printings.some(p=>p.gameplayCardId===c.id&&inEdition(p,'retail')));
 const [type,tag]=target.typeLabel.split(' · ');
 await color(target.colors).click();await page.getByRole('combobox',{name:'Card type',exact:true}).selectOption(type);await page.getByRole('combobox',{name:'Tag',exact:true}).selectOption(tag);
 await search.fill(target.name);
 for(const context of ['retail','beta','special','languages','all']){
  await edition(context);
  const printings=catalog.printings.filter(p=>p.gameplayCardId===target.id&&inEdition(p,context));
  if(!printings.length){assert.deepEqual(await titles(),[]);continue;}
  const rarity=printings[0].rarity;
  await page.getByRole('combobox',{name:'Rarity',exact:true}).selectOption(rarity);
  for(const view of ['list','grid']){
   await page.getByLabel('View',{exact:true}).selectOption(view);
   assert.deepEqual(await titles(),[target.name]);
   if(view==='list')assert.ok(await page.locator('article .list-color').filter({hasText:target.colors}).isVisible());
  }
  await page.getByRole('button',{name:'Owned',exact:true}).click();assert.deepEqual(await titles(),[]);
  await page.getByRole('button',{name:'Missing',exact:true}).click();assert.deepEqual(await titles(),[target.name]);
  await page.getByRole('group',{name:'Show cards',exact:true}).getByRole('button',{name:'All',exact:true}).click();
 }
 // Clearing has an explicit scope: retain search, edition and ownership.
 await page.getByRole('button',{name:'Clear browsing filters'}).click();
 assert.equal(await search.inputValue(),target.name);assert.equal(await page.getByLabel('Set / Edition',{exact:true}).inputValue(),'all');
 assert.equal(await page.getByRole('combobox',{name:'Rarity',exact:true}).inputValue(),'');
 await color('Unknown').click();
 await page.getByRole('button',{name:'Pack Desk',exact:true}).click();
 assert.equal(await search.inputValue(),'');assert.equal(await page.getByRole('combobox',{name:'Card type',exact:true}).inputValue(),'All');
 assert.equal(await color('All').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('article').count(),100);
 await color('Unknown').click();await page.getByRole('button',{name:'Binder',exact:true}).click();
 assert.equal(await color('All').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('article').count(),100);
 await edition('retail');
 for(const [width,height] of [[320,568],[390,844],[844,390],[1280,800]]){
  await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Expanded filters overflow at ${width}`);
  const small=await panel.locator('button,select').evaluateAll(es=>es.filter(e=>{const r=e.getBoundingClientRect();return r.width<43||r.height<43;}).map(e=>e.textContent));
  assert.deepEqual(small,[],`Expanded targets at ${width}`);
  await page.getByRole('combobox',{name:'Rarity',exact:true}).focus();
  for(const label of ['Cost','PWR','RAM','Eddies']){
   await page.keyboard.press('Tab');
   const select=page.getByRole('combobox',{name:label,exact:true});
   assert.ok(await select.evaluate(e=>e===document.activeElement),`Keyboard order for ${label} at ${width}`);
   assert.ok(await select.evaluate(e=>{const r=e.getBoundingClientRect();const nav=document.querySelector('nav').getBoundingClientRect();return r.top>=0&&r.bottom<=Math.min(innerHeight,innerWidth<=900?nav.top:innerHeight);}),`Focused ${label} obscured at ${width}`);
  }
  await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Collapsed filters overflow at ${width}`);
  assert.ok(await page.locator('article').first().evaluate(e=>e.getBoundingClientRect().top<innerHeight-60),`First card visible at ${width}`);
  await toggle.click();
 }
 await toggle.click();await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));
 // Source-reported gameplay attributes: exact matching; 0 differs from absent; Eddies is sellability.
 const stats=JSON.parse(await readFile('local-catalog/gameplay-stats.json','utf8'));
 assert.equal(stats.entries.length,catalog.cards.length);
 const byId=new Map(stats.entries.map(x=>[x.id,x]));
 const sourceCard=catalog.cards.find(c=>{const x=byId.get(c.id);return x&&x.cost!==null&&x.power!==null&&x.ram!==null&&x.eddiable===true;});
 assert.ok(sourceCard,'A real catalog card supplies all four stats');
 const row=byId.get(sourceCard.id);
 const statSelect=label=>page.getByRole('combobox',{name:label,exact:true});
 await edition('all');await toggle.click();
 // Exercise every numeric choice independently, including values absent from an edition.
 await search.fill('');
 for(const [field,label] of [['cost','Cost'],['power','PWR'],['ram','RAM'],['eddiable','Eddies']]){
  const choices=field==='eddiable'?['sellable','non-sellable','unknown','']:
   [...new Set(stats.entries.map(r=>r[field]).filter(v=>v!==null))].sort((a,b)=>a-b).map(String).concat('unknown','');
  for(const choice of choices){
   await statSelect(label).selectOption(choice);
   const expected=catalog.cards.filter(c=>{const value=byId.get(c.id)[field];return choice===''||
    (choice==='unknown'?value===null:field==='eddiable'?value===(choice==='sellable'):String(value)===choice);});
   assert.deepEqual(await titles(),expected.slice(0,100).map(c=>c.name),`${label} ${choice}`);
   if(choice!=='')assert.equal(await page.getByRole('status').filter({hasText:/^Showing /}).textContent(),`Showing ${expected.length} of ${catalog.cards.length} cards.`);
  }
 }
 // All gameplay selectors intersect the existing facets on the same gameplay identity,
 // even when rarity and edition are satisfied by one of several source printings.
 const [sourceType,sourceTag]=sourceCard.typeLabel.split(' · ');
 await color(sourceCard.colors).click();
 await page.getByRole('combobox',{name:'Card type',exact:true}).selectOption(sourceType);
 if(sourceTag)await page.getByRole('combobox',{name:'Tag',exact:true}).selectOption(sourceTag);
 await search.fill(sourceCard.name);
 await statSelect('Cost').selectOption(String(row.cost));
 await statSelect('PWR').selectOption(String(row.power));
 await statSelect('RAM').selectOption(String(row.ram));
 await statSelect('Eddies').selectOption('sellable');
 assert.deepEqual(await titles(),[sourceCard.name]);
 for(const context of ['retail','beta','special','languages','all']){
  await edition(context);
  const printings=catalog.printings.filter(p=>p.gameplayCardId===sourceCard.id&&inEdition(p,context));
  if(printings.length)await page.getByRole('combobox',{name:'Rarity',exact:true}).selectOption(printings[0].rarity);
  for(const view of ['grid','list']){
   await page.getByLabel('View',{exact:true}).selectOption(view);
   assert.deepEqual(await titles(),printings.length?[sourceCard.name]:[]);
  }
  await page.getByRole('button',{name:'Owned',exact:true}).click();assert.deepEqual(await titles(),[]);
  await page.getByRole('button',{name:'Missing',exact:true}).click();assert.deepEqual(await titles(),printings.length?[sourceCard.name]:[]);
  await page.getByRole('group',{name:'Show cards',exact:true}).getByRole('button',{name:'All',exact:true}).click();
 }
 await page.getByRole('combobox',{name:'Rarity',exact:true}).selectOption('');
 await statSelect('Eddies').selectOption('non-sellable');assert.deepEqual(await titles(),[]);
 await statSelect('Eddies').selectOption('sellable');
 await statSelect('PWR').selectOption('unknown');assert.deepEqual(await titles(),[]);
 await statSelect('PWR').selectOption('');
 await statSelect('Cost').selectOption('');
 await statSelect('RAM').selectOption('');
 await statSelect('Eddies').selectOption('');
 await color('All').click();
 await page.getByRole('combobox',{name:'Card type',exact:true}).selectOption('All');
 await page.getByRole('combobox',{name:'Tag',exact:true}).selectOption('');
 const missing=catalog.cards.find(c=>byId.get(c.id).cost===null);
 await search.fill(missing.name);await statSelect('Cost').selectOption('unknown');
 assert.deepEqual(await titles(),[missing.name],'Missing Cost must not become 0');
 await statSelect('Cost').selectOption('');
 const zero=catalog.cards.find(c=>byId.get(c.id).power===0);
 await search.fill(zero.name);await statSelect('PWR').selectOption('0');
 assert.deepEqual(await titles(),[zero.name],'Zero PWR must remain searchable');
 await page.getByRole('button',{name:'Clear browsing filters'}).click();
 for(const label of ['Cost','PWR','RAM','Eddies'])assert.equal(await statSelect(label).inputValue(),'');
 await statSelect('RAM').selectOption('6');
 await page.getByRole('button',{name:'Pack Desk',exact:true}).click();
 assert.equal(await statSelect('RAM').inputValue(),'','Navigation clears gameplay filters');
 await toggle.click();
 assert.deepEqual(await page.evaluate(()=>window.__browseWrites),[],'No readwrite transactions while filtering');
 assert.deepEqual(await stored(),before,'Browsing must not write collection records, quantities, ledger or settings');
 console.log('PASS browse facets: real colors, combined metadata/search/ownership/editions/views, empty/reset/navigation, keyboard, responsive controls and unchanged database');
}
