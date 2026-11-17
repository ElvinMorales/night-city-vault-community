// Local production UI regression; synthetic CSS/photo fixtures only.
import {createServer} from 'node:http';
import {readFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {reviewBrowseFilters} from './browse-filter-tests.mjs';
const server=createServer(async(req,res)=>{try{let pathname=new URL(req.url,'http://loopback.invalid').pathname;if(!pathname.startsWith('/night-city-vault-community/')){res.writeHead(404);res.end();return;}pathname=pathname.slice('/night-city-vault-community'.length);const file=path.resolve('dist','.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(path.resolve('dist')+path.sep))throw Error('path');res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${server.address().port}/night-city-vault-community/`;
await mkdir('docs/phase-3d',{recursive:true});
try{for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const profile=name==='WebKit'?await mkdtemp(path.join(tmpdir(),'ncv-3d-webkit-')):null;
 const browser=await engine.launch({headless:true,...(name==='Chromium'?{executablePath:process.env.COMMUNITY_CHROMIUM,args:['--no-sandbox']}:{} )});
 let context;
 try{
 const options={viewport:{width:390,height:844},reducedMotion:'reduce'};
 context=profile?await engine.launchPersistentContext(profile,{...options,headless:true}):await browser.newContext(options);
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);await page.locator('article').first().waitFor();
 // Fresh launch must show cards before onboarding has been dismissed.
 for(const [width,height] of [[320,568],[390,844],[844,390],[1280,800]]){
  await page.setViewportSize({width,height});
  assert.ok(await page.locator('article').first().evaluate(e=>e.getBoundingClientRect().top<innerHeight-(innerWidth===320?110:65)),`Fresh launch card hidden at ${width}`);
 }
 await page.setViewportSize({width:320,height:568});
 const welcome=page.locator('.welcome');
 await welcome.locator('summary').focus();await page.keyboard.press('Enter');
 assert.ok(await welcome.getByText(/The cards are already in the catalog/).isVisible());
 await page.keyboard.press('Enter');assert.ok(!(await welcome.getByText(/The cards are already in the catalog/).isVisible()));
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Dismiss welcome'}).click();
 const shot=async label=>{if(name==='Chromium'&&process.env.COMMUNITY_UPDATE_VISUALS==='1')await page.screenshot({path:`docs/phase-3d/${label}.png`,animations:'disabled',caret:'hide'});};
 await reviewBrowseFilters(page);
 // Special version workflow: synthetic player-confirmed metadata, no catalog mutation.
 await page.locator('.tile-add').first().click();
 const specialDialog=page.getByRole('dialog');
 await specialDialog.locator('.picker-toggle').click();
 assert.ok(!(await specialDialog.locator('.picker-options').innerText()).includes('Finish not confirmed'));
 await specialDialog.locator('.picker-toggle').click();
 await specialDialog.getByText('Special version?',{exact:true}).click();
 await specialDialog.getByRole('checkbox',{name:'Foil',exact:true}).check();
 await specialDialog.getByRole('checkbox',{name:'Promo',exact:true}).check();
 assert.ok(await specialDialog.getByRole('button',{name:'Add 1 copy',exact:true}).isDisabled(),'Special attributes cannot silently acquire an unrelated version');
 await specialDialog.getByRole('button',{name:'Record local special version'}).scrollIntoViewIfNeeded();
 if(process.env.COMMUNITY_UPDATE_VISUALS==='1')await page.screenshot({path:`docs/phase-3d/special-controls-${name.toLowerCase()}.png`,animations:'disabled'});
 await specialDialog.getByRole('button',{name:'Record local special version'}).click();
 await page.getByLabel('Set code',{exact:true}).fill('FICTIONAL-SPECIAL');
 await page.getByLabel('Set name',{exact:true}).fill('Fictional special test');
 await page.getByLabel('Collector number',{exact:true}).fill('007');
 await page.getByLabel('Language',{exact:true}).fill('en');
 await page.getByLabel('Where did you find these details?').fill('Synthetic player confirmation for regression');
 await page.getByRole('checkbox',{name:'I checked these details.',exact:false}).check();
 await page.getByRole('button',{name:'Save printing',exact:true}).click();
 await specialDialog.locator('.picker-toggle').filter({hasText:'Fictional special test'}).waitFor();
 assert.match(await specialDialog.locator('.picker-toggle').getAttribute('aria-label'),/Foil.*Promo/);
 await specialDialog.getByRole('button',{name:'Add 1 copy',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('dialog .quantity')?.textContent.includes('1 owned'));
 await specialDialog.locator('.picker-toggle').click();
 await specialDialog.getByRole('searchbox',{name:'Find a version'}).fill('FICTIONAL-SPECIAL');
 // Search by the displayed set name.
 await specialDialog.getByRole('searchbox',{name:'Find a version'}).fill('Fictional special test');
 if(process.env.COMMUNITY_UPDATE_VISUALS==='1')await page.screenshot({path:`docs/phase-3d/special-picker-${name.toLowerCase()}.png`,animations:'disabled'});
 assert.ok((await specialDialog.ariaSnapshot()).includes('Foil'));
 await page.keyboard.press('Escape');
 await page.reload();await page.locator('article').first().waitFor();
 assert.equal(await page.locator('article').first().locator('.special-badge').filter({hasText:'Foil'}).count(),1);
 await page.getByLabel('View',{exact:true}).selectOption('list');
 assert.ok(await page.locator('article').first().evaluate(card=>{const a=card.querySelector('.card-title').getBoundingClientRect(),b=card.querySelector('.tile-footer').getBoundingClientRect();return Math.abs(a.y+a.height/2-b.y-b.height/2)<2&&card.scrollWidth<=card.clientWidth;}),'Special badges preserve compact-list quantities and width');
 await page.getByLabel('View',{exact:true}).selectOption('grid');
 await page.locator('.tile-add').first().click();
 await page.getByText('Versions and collection details',{exact:true}).click();
 await page.getByText('Advanced details',{exact:true}).first().click();
 await specialDialog.getByRole('button',{name:'Add card version',exact:true}).click();
 const localForm=async(treatment)=>{
  await page.getByLabel('Set code',{exact:true}).fill('FICTIONAL-SPECIAL');
  await page.getByLabel('Set name',{exact:true}).fill('Fictional special test');
  await page.getByLabel('Collector number',{exact:true}).fill('007');
  await page.getByLabel('Language',{exact:true}).fill('en');
  await page.getByLabel('Treatment',{exact:true}).fill(treatment);
  await page.getByRole('checkbox',{name:'Promo designation',exact:true}).check();
  await page.getByRole('checkbox',{name:'I checked these details.',exact:false}).check();
  await page.getByRole('button',{name:'Save printing',exact:true}).click();
 };
 await localForm('Foil'); // Collision reuses the existing local identity.
 await specialDialog.locator('.picker-toggle').filter({hasText:'Fictional special test'}).waitFor();
 await page.getByText('Versions and collection details',{exact:true}).click();
 assert.equal(await specialDialog.locator('.advanced-card .special-badge').filter({hasText:'Foil'}).count(),1);
 await specialDialog.getByRole('button',{name:'Add card version',exact:true}).click();
 await localForm(''); // Promo alone does not invent a finish.
 await specialDialog.locator('.picker-toggle').filter({hasText:'Not sure which version'}).waitFor();
 await page.getByText('Versions and collection details',{exact:true}).click();
 await page.getByText('Printing details not confirmed',{exact:true}).waitFor();
 assert.ok((await specialDialog.innerText()).includes('1 owned'));
 // Missing finish belongs inside expanded details only.
 await page.getByRole('button',{name:'Close dialog'}).click();
 // Remove only the test holding through the existing inventory controls to keep later quantity assertions stable.
 await page.locator('.tile-add').first().click();
 await page.getByText('Versions and collection details',{exact:true}).click();
 await page.getByRole('button',{name:/Remove one copy/}).and(specialDialog.locator('button:enabled')).click();
 await page.waitForFunction(()=>document.querySelector('dialog .quantity')?.textContent.includes('0 owned'));
 await page.getByRole('button',{name:'Close dialog'}).click();
 await page.getByRole('button',{name:'Settings',exact:true}).click();assert.equal(await page.locator('main select').count(),0,'No catalog-wide selection in Settings');await page.getByText('Open a card in Binder and tap Add Photo.',{exact:true}).waitFor();await shot('after-settings-empty');await page.getByRole('button',{name:'Open Binder',exact:true}).click();
 await page.locator('.tile-add').first().click();await page.getByRole('button',{name:'Add 1 copy',exact:true}).click();await page.waitForFunction(()=>document.querySelector('dialog .quantity')?.textContent.includes('1 owned'));
 const dialog=page.getByRole('dialog');const notice=dialog.getByRole('complementary',{name:'Last change'});await notice.getByRole('button',{name:'Undo last action',exact:true}).waitFor();
 const gap=await dialog.evaluate(d=>{const n=d.querySelector('.change-notice').getBoundingClientRect(),b=d.querySelector('.dialog-body').getBoundingClientRect();return n.top-b.bottom;});assert.ok(gap>=0,'Dialog notice reserves space outside scrolling controls');await shot('after-add-undo');
 await page.waitForFunction(()=>!document.querySelector('dialog button[aria-label="Undo last action"]').disabled);await notice.getByRole('button',{name:'Undo last action',exact:true}).focus();assert.ok(await notice.getByRole('button',{name:'Undo last action',exact:true}).evaluate(e=>e===document.activeElement));await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('dialog .quantity')?.textContent.includes('0 owned'));assert.equal(await notice.getByRole('button',{name:'Undo last action',exact:true}).count(),0,'No undoing undo');
 await page.getByRole('button',{name:'Add 1 copy',exact:true}).click();await page.waitForFunction(()=>document.querySelector('dialog .quantity')?.textContent.includes('1 owned'));await page.getByRole('button',{name:'Close dialog'}).click();
 const positions=await page.evaluate(()=>({notice:document.querySelector('.change-notice').getBoundingClientRect().toJSON(),nav:document.querySelector('nav').getBoundingClientRect().toJSON()}));assert.ok(positions.notice.bottom<=positions.nav.top,'Notice above mobile navigation');
 await page.getByRole('button',{name:'Recent Activity',exact:true}).click();await page.getByRole('heading',{name:'Recent Activity',exact:true}).waitFor();assert.ok((await dialog.innerText()).includes(await page.locator('article .card-title').first().innerText()),'Activity names the affected card');const tree=await dialog.ariaSnapshot();assert.ok(tree.includes('list:'));assert.ok(tree.includes('1 copy added'));assert.ok(tree.includes('Last change undone'));await shot('after-activity');await page.keyboard.press('Escape');assert.ok(await page.getByRole('button',{name:'Recent Activity',exact:true}).evaluate(e=>e===document.activeElement));
 // Another tab commits before this tab attempts Undo. Broadcast invalidates the offer.
 const other=await context.newPage();await other.goto(origin);await other.locator('.tile-add').first().click();await other.getByRole('button',{name:'Add 1 copy',exact:true}).click();await other.waitForFunction(()=>document.querySelector('dialog .quantity')?.textContent.includes('2 owned'));await page.getByText('Your collection changed. Undo is no longer available for the previous change.',{exact:false}).waitFor();assert.equal(await page.getByRole('button',{name:'Undo last action',exact:true}).count(),0);await other.close();
 await page.locator('.tile-add').first().click();await page.getByRole('button',{name:'Add Photo',exact:true}).click();assert.equal(await dialog.locator('[aria-label="Personal artwork"] select').count(),0,'Artwork version uses searchable selection');
 await page.getByLabel('Choose photo').setInputFiles('public/icons/vault-192.png');await page.getByText('Preview ready. Save to keep this image.',{exact:true}).waitFor();assert.ok(await page.getByRole('button',{name:'Save photo',exact:true}).isDisabled());
 await page.getByRole('checkbox',{name:'I understand that this image may be copyrighted.',exact:false}).check();await page.getByRole('button',{name:'Save photo',exact:true}).click();await page.getByText('Photo saved on this device.',{exact:true}).waitFor();await shot('after-photo');
 await page.getByRole('button',{name:'Back to card',exact:true}).click();assert.ok(await page.getByRole('button',{name:'Add Photo',exact:true}).evaluate(e=>e===document.activeElement));await page.getByRole('button',{name:'Close dialog'}).click();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Find saved photos').fill('no matching saved photo');await page.getByText('No saved photos match.',{exact:true}).waitFor();await page.getByLabel('Find saved photos').fill('');await page.locator('.saved-photos').scrollIntoViewIfNeeded();await shot('after-photo-library');await page.locator('.saved-photos button').first().click();
 await page.getByRole('button',{name:'Replace photo',exact:true}).click();assert.ok(await page.getByLabel('Choose photo').evaluate(e=>e===document.activeElement));await page.getByLabel('Choose photo').setInputFiles('public/icons/vault-512.png');await page.getByText('Preview ready. Save to keep this image.',{exact:true}).waitFor();await page.getByRole('checkbox',{name:'I understand that this image may be copyrighted.',exact:false}).check();await page.getByRole('button',{name:'Save photo',exact:true}).click();await page.getByText('Photo saved on this device.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Remove photo',exact:true}).click();await page.getByText('Photo removed.',{exact:true}).waitFor();await page.getByRole('button',{name:'Close dialog'}).click();await page.getByText('Open a card in Binder and tap Add Photo.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Binder',exact:true}).click();await page.setViewportSize({width:320,height:568});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewportSize({width:390,height:430});await page.getByRole('searchbox',{name:'Search cards'}).focus();assert.ok(await page.getByRole('searchbox',{name:'Search cards'}).evaluate(e=>e===document.activeElement));
 await page.emulateMedia({forcedColors:'active'});await page.locator('.tile-add').first().click();await page.getByRole('button',{name:'Add 1 copy',exact:true}).waitFor();const focus=await dialog.ariaSnapshot();assert.ok(focus.includes('button "Close dialog"'));await page.keyboard.press('Tab');assert.ok(await dialog.evaluate(d=>d.contains(document.activeElement)));await page.keyboard.press('Escape');assert.deepEqual(errors,[]);
 console.log(`PASS ${name} Phase 3D: commit-only Undo, keyboard action, compensating history, dialog/footer bounds, mobile nav clearance, cross-tab invalidation, saved-photo search, preview/acknowledgment, replacement/removal, return focus, 320px/keyboard space, reduced motion, forced colors, accessibility tree`);
 await context.close();
 }finally{await context?.close();await browser.close();if(profile)await rm(profile,{recursive:true,force:true});}
}}finally{await new Promise(r=>server.close(r));}
