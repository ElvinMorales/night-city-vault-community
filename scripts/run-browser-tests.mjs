import {runArtwork} from './artwork-browser-tests.mjs';
// Development-only CDP pipe driver. Every test-origin request is fulfilled in memory.
// No listening sockets, application networking or server APIs.
import { spawn } from 'node:child_process';
import { mkdtemp, rm, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { build } from 'vite';
import { runUI, runCatalogUI, runArchiveUI } from './ui-browser-tests.mjs';
import { runData, benchmarkData } from './data-browser-tests.mjs';
const profile = await mkdtemp(path.join(tmpdir(), 'community-fiction-browser-'));
const downloadPath=path.join(profile,'downloads');await mkdir(downloadPath);
const downloads=new Map();
const remoteRequests=[];
const output = await build({ configFile: false, logLevel: 'error', build: { write: false, lib: { entry: 'tests/browser/suite.ts', name: 'FictionHarness', formats: ['iife'] }, minify: false } });
const bundle = (Array.isArray(output) ? output[0] : output).output.find(o => o.type === 'chunk').code;
const document = '<!doctype html><title>Fictional persistence harness</title><script>' + bundle.replaceAll('</script', '<\\/script') + '</script>';
const uiOutput = await build({ configFile:false, define:{'process.env.NODE_ENV':JSON.stringify('production')}, logLevel:'error', build:{write:false, lib:{entry:'tests/browser/ui-entry.ts',name:'UIHarness',formats:['es']},minify:false} });
const uiAssets = (Array.isArray(uiOutput)?uiOutput[0]:uiOutput).output;
const uiScript = uiAssets.find(o=>o.type==='chunk').code;
const workerAssets = new Map([...uiAssets,...(Array.isArray(output)?output[0]:output).output].filter(o=>o.type==='asset'&&o.fileName.endsWith('.js')).map(o=>['/'+o.fileName,o.source]));
const uiDocument = '<!doctype html><html lang="en"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+uiAssets.filter(o=>o.type==='asset'&&o.fileName.endsWith('.css')).map(o=>o.source).join('')+'</style><body><div id="root"></div><script type="module" src="/ui.js"></script></body></html>';
const origin = 'https://community.invalid';
const executable = process.env.COMMUNITY_CHROMIUM ?? 'chromium';
const browser = spawn(executable, ['--headless', '--no-sandbox', '--disable-gpu', '--disable-background-networking', '--no-first-run', '--remote-debugging-pipe', `--user-data-dir=${profile}`], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
let browserErrors = '';
browser.stderr.on('data', d => { browserErrors += d.toString(); });
for (const pipe of [browser.stdio[3], browser.stdio[4]])
    pipe.on('error', () => { });
let send;
try {
    let sequence = 0, buffer = '';
    const pending = new Map();
    send = (method, params = {}, sessionId) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); browser.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0'); });
    browser.stdio[4].on('data', data => { buffer += data.toString(); let end; while ((end = buffer.indexOf('\0')) >= 0) {
        const msg = JSON.parse(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
        if (msg.id) {
            const p = pending.get(msg.id);
            pending.delete(msg.id);
            if (msg.error)
                p.reject(new Error(JSON.stringify(msg.error)));
            else
                p.resolve(msg.result);
        }
        else if(msg.method==='Browser.downloadProgress')downloads.set(msg.params.guid,msg.params.state);
        else if (msg.method === 'Fetch.requestPaused') {
            if(new URL(msg.params.request.url).origin!==origin){remoteRequests.push(msg.params.request.url);void send('Fetch.failRequest',{requestId:msg.params.requestId,errorReason:'BlockedByClient'},msg.sessionId).catch(()=>{});continue;}
            const asset=workerAssets.get(new URL(msg.params.request.url).pathname);
            void send('Fetch.fulfillRequest', { requestId: msg.params.requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: asset || msg.params.request.url.endsWith('/ui.js') ? 'application/javascript' : 'text/html' }], body: Buffer.from(asset ?? (msg.params.request.url.endsWith('/ui.js') ? uiScript : msg.params.request.url.endsWith('/ui') ? uiDocument : document)).toString('base64') }, msg.sessionId).catch(() => {});
        }
    } });
    const failed = error => { for (const p of pending.values())
        p.reject(error); };
    browser.on('error', failed);
    browser.on('exit', (code, signal) => failed(new Error(`Chromium exited (${code ?? signal}): ${browserErrors.slice(-2000)}`)));
    const timeout = setTimeout(() => failed(new Error('Browser command timed out')), process.env.COMMUNITY_ARTWORK_ONLY || process.env.COMMUNITY_ARTWORK_BENCHMARK === '1' || process.env.COMMUNITY_BENCHMARK === '1' || process.env.COMMUNITY_DATA_BENCHMARK==='1' ? 1800000 : 300000);
    timeout.unref();
    const intercept = sessionId => send('Fetch.enable', { patterns: [{ urlPattern: '*' }] }, sessionId);
    const page = async () => { const { targetId } = await send('Target.createTarget', { url: 'about:blank' }); const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true }); await intercept(sessionId); await send('Runtime.enable', {}, sessionId); await send('Page.enable', {}, sessionId); await send('Page.navigate', { url: origin + '/tests/browser/harness.html' }, sessionId); return sessionId; };
    const evaluate = async (sessionId, expression) => { const result = await send('Runtime.evaluate', { expression: `(async()=>(${expression}))()`, awaitPromise: true, returnByValue: true }, sessionId); if (result.exceptionDetails)
        throw new Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
    const ready = async (p) => { for (let i = 0; i < 100; i++) {
        if (await evaluate(p, '!!globalThis.phase1'))
            return;
        await new Promise(r => setTimeout(r, 50));
    } throw new Error('Harness failed to load'); };
    const p = await page();
    await ready(p);
    console.log('Browser: ' + (await send('Browser.getVersion')).product);
    if(process.env.COMMUNITY_ARTWORK_ONLY){
      for(const count of process.env.COMMUNITY_ARTWORK_ONLY.split(',').map(Number)){if(!Number.isInteger(count)||count<1||count>500)throw new Error('Invalid benchmark count');console.log('ARTWORK_BENCHMARK '+JSON.stringify(await evaluate(p,`phase1.artworkBenchmark(${count})`)));}
      if(remoteRequests.length)throw new Error('Unauthorized benchmark requests');
    }else{
    let passed = 0;
    for (const [i, title] of (await evaluate(p, 'phase1.tests')).entries()) {
        await Promise.race([evaluate(p, `phase1.run(${i})`), new Promise((_, reject) => { const t = setTimeout(() => reject(new Error('Test timeout')), 120000); t.unref(); })]);
        console.log(`PASS ${title}`);
        passed++;
    }
    console.log('ARCHIVE_STORAGE_METRICS '+JSON.stringify(await evaluate(p,'globalThis.archiveMetrics??{}')));
    console.log('PHASE2C_STORAGE_METRICS '+JSON.stringify(await evaluate(p,'globalThis.catalogMetrics??[]')));
    await evaluate(p, 'phase1.seedReload()');
    await send('Page.reload', {}, p);
    await new Promise(r => setTimeout(r, 150));
    await ready(p);
    await evaluate(p, 'phase1.checkReload()');
    console.log('PASS persistence survives actual page reload');
    passed++;
    const q = await page();
    await ready(q);
    await evaluate(p, `(async()=>{globalThis.tabRepo=await phase1.open('fiction-tabs');await tabRepo.execute(await phase1.prepareCommand('tab-card',{type:'save-card',card:phase1.card}));globalThis.notified=0;tabRepo.subscribeCommittedRevision(r=>notified=r);})()`);
    await evaluate(q, `(async()=>{globalThis.tabRepo=await phase1.open('fiction-tabs');globalThis.tabCard=(await tabRepo.readSnapshot()).cards[0];})()`);
    await evaluate(p, `(async()=>{const c=(await tabRepo.readSnapshot()).cards[0];return tabRepo.execute(await phase1.prepareCommand('edit-a',{type:'save-card',card:{...c,notes:'Fiction tab A'}},[{entity:'cards',id:c.id,version:c.version},{entity:'revision',id:'collection',version:1}]));})()`);
    const conflict = await evaluate(q, `(async()=>tabRepo.execute(await phase1.prepareCommand('edit-b',{type:'save-card',card:{...tabCard,notes:'Fiction tab B'}},[{entity:'cards',id:tabCard.id,version:tabCard.version},{entity:'revision',id:'collection',version:1}])))()`);
    if (conflict.ok || conflict.code !== 'conflict')
        throw new Error('Cross-tab stale write accepted');
    await evaluate(q, `tabRepo.execute(await phase1.prepareCommand('tab-printing',{type:'save-printing',printing:phase1.printing}))`);
    await new Promise(r => setTimeout(r, 100));
    if (await evaluate(p, 'notified') !== 3)
        throw new Error('Cross-tab revision not received');
    await Promise.all([evaluate(p, `tabRepo.execute(await phase1.prepareCommand('tab-add-a',phase1.add(2)))`), evaluate(q, `tabRepo.execute(await phase1.prepareCommand('tab-add-b',phase1.add(3)))`)]);
    if (await evaluate(p, '(await tabRepo.readSnapshot()).lots[0].quantity') !== 5)
        throw new Error('Cross-tab lost addition');
    console.log('PASS real cross-tab stale edits, concurrent additions and revision notifications');
    passed++;
    // A separate browser context has independent origin storage, like a fresh profile.
    const { browserContextId } = await send('Target.createBrowserContext');
    const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await intercept(sessionId);
    await send('Page.navigate', { url: origin + '/tests/browser/harness.html' }, sessionId);
    await ready(sessionId);
    const source = await evaluate(p, `phase1.exportBackup(tabRepo)`);
    await evaluate(sessionId, `(async()=>{const b=phase1;const r=await phase1.open('fiction-tabs');if((await r.readSnapshot()).cards.length)throw new Error('Context not fresh');await b.restoreBackup(r,await b.previewRestore(r,${JSON.stringify(source)}),async()=>{});if((await r.readSnapshot()).lots[0].quantity!==5)throw new Error('Restore mismatch');const restored=await r.archive();const original=JSON.parse(${JSON.stringify(source)}).archive;for(const key of ['state','operations','batches','events'])if(b.canonical(restored[key])!==b.canonical(original[key]))throw new Error('Archive mismatch: '+key);const replay=await r.execute(await b.prepareCommand('tab-add-a',b.add(2)));if(!replay.ok||!replay.replayed||(await r.readSnapshot()).lots[0].quantity!==5)throw new Error('Restored replay failed');const undo=await r.execute(await b.prepareCommand('isolated-undo',{type:'undo',batchId:restored.meta.headBatch}));if(!undo.ok)throw new Error('Restored undo failed');r.close();})()`);
    console.log('PASS complete restore in fresh browser storage context');
    passed++;
    console.log(`${passed} real Chromium integration tests passed; 0 failed; 0 blocked`);
    const { targetId: uiTarget } = await send('Target.createTarget',{url:'about:blank'});
    const { sessionId: uiSession } = await send('Target.attachToTarget',{targetId:uiTarget,flatten:true});
    await intercept(uiSession); await send('Page.enable',{},uiSession);
    await send('Page.navigate',{url:origin+'/ui'},uiSession);
    await runUI(send,evaluate,uiSession);
    const dataContexts=new Map();
    const dataPage=async(sameAs)=>{
        const browserContextId=dataContexts.get(sameAs)??(await send('Target.createBrowserContext')).browserContextId;
        await send('Browser.setDownloadBehavior',{behavior:'allowAndName',downloadPath,eventsEnabled:true,browserContextId});
        const {targetId}=await send('Target.createTarget',{url:'about:blank',browserContextId});
        const {sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
        await intercept(sessionId);await send('Page.enable',{},sessionId);await send('Page.navigate',{url:origin+'/ui'},sessionId);dataContexts.set(sessionId,browserContextId);return sessionId;
    };
    const dataSession=await dataPage();
    await runData(send,evaluate,dataSession,dataPage);
    const artworkSession=await dataPage();await runArtwork(send,evaluate,artworkSession);
    const realSession=await dataPage();await runArchiveUI(send,evaluate,realSession);
    const catalogSession=await dataPage();await runCatalogUI(send,evaluate,catalogSession,()=>dataPage());
    for(let i=0;i<100&&!Array.from(downloads.values()).includes('completed');i++)await new Promise(r=>setTimeout(r,25));
    const guid=Array.from(downloads).find(([,state])=>state==='completed')?.[0];
    if(!guid)throw new Error('No browser-confirmed file download');
    const downloadedBytes=await readFile(path.join(downloadPath,guid));
    const manifestLength=downloadedBytes.readUInt32BE(12);
    const manifest=JSON.parse(downloadedBytes.subarray(16,16+manifestLength).toString());
    const downloaded=JSON.parse(downloadedBytes.subarray(16+manifestLength,16+manifestLength+manifest.domainBytes).toString());
    if(downloaded.format!=='community-backup@2'||!downloaded.checksum||!downloaded.archive)throw new Error('Downloaded file incomplete');
    console.log('PASS actual Chromium download completed with a complete backup file');
    if(remoteRequests.length)throw new Error('Unauthorized remote requests: '+remoteRequests.join(', '));
    console.log('PASS no unauthorized remote requests during storage, catalog, UI and worker scenarios');
    if(process.env.COMMUNITY_ARTWORK_BENCHMARK==='1')for(const count of [10,100,500])console.log('ARTWORK_BENCHMARK '+JSON.stringify(await evaluate(p,`phase1.artworkBenchmark(${count})`)));
    if(process.env.COMMUNITY_DATA_BENCHMARK==='1')await benchmarkData(evaluate,dataSession);
    if (process.env.COMMUNITY_BENCHMARK === '1') for (const count of [100, 1000, 5000]) console.log('BENCHMARK ' + JSON.stringify(await evaluate(p, `phase1.benchmark(${count})`)));
    }
}
catch(error) { console.error(error); process.exitCode=1; }
finally {
    browser.kill('SIGTERM');
    await new Promise(r => setTimeout(r, 200));
    await rm(profile, { recursive: true, force: true, maxRetries: 5 });
}
