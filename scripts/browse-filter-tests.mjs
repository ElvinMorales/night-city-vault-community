// Read-only production UI checks against the bundled factual metadata.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
export async function reviewBrowseFilters(page){
 const catalog=JSON.parse(await readFile('local-catalog/catalog.json','utf8'));
 const stored=()=>page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('community-collection-local');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});try{const tx=db.transaction([...db.objectStoreNames]);return await Promise.all([...db.objectStoreNames].map(name=>new Promise((resolve,reject)=>{const r=tx.objectStore(name).getAll();r.onsuccess=()=>resolve([name,r.result]);r.onerror=()=>reject(r.error);})));}finally{db.close();}});
 await page.waitForFunction(()=>!document.querySelector('nav button').disabled);
 const before=await stored();
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
 await page.getByRole('button',{name:'Clear color and advanced filters'}).click();
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
 await page.getByRole('button',{name:'Clear color and advanced filters'}).click();
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
  await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Collapsed filters overflow at ${width}`);
  assert.ok(await page.locator('article').first().evaluate(e=>e.getBoundingClientRect().top<innerHeight-60),`First card visible at ${width}`);
  await toggle.click();
 }
 await toggle.click();await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));
 assert.deepEqual(await stored(),before,'Browsing must not write collection records, quantities, ledger or settings');
 console.log('PASS browse facets: real colors, combined metadata/search/ownership/editions/views, empty/reset/navigation, keyboard, responsive controls and unchanged database');
}
