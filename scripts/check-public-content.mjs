import { readdir, readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = process.cwd();
const findings = [];
const boundary=JSON.parse(await readFile('docs/local-catalog-boundary.json','utf8'));
const release=process.argv.includes('--release');
const decisions=JSON.parse(await readFile('docs/release-decisions.json','utf8'));
if(boundary.status!=='reviewed-factual-metadata' || decisions.catalogReview!==boundary.status || boundary.review!=='docs/catalog-distribution-review.md') findings.push('Catalog field/provenance review missing');
for(const file of ['local-catalog/archive-metadata.json','local-catalog/catalog.json','local-catalog/gameplay-stats.json']) {
 const digest=createHash('sha256').update(await readFile(file)).digest('hex');
 if(!boundary.approvedDistributableCatalogAssets.includes(file)||boundary.reviewedAssetHashes[file]!==digest) findings.push(`${file}: content differs from field-level review`);
}
const raw=JSON.parse(await readFile('local-catalog/archive-metadata.json','utf8'));
const catalog=JSON.parse(await readFile('local-catalog/catalog.json','utf8'));
const statSheet=JSON.parse(await readFile('local-catalog/gameplay-stats.json','utf8'));
if(!shapeStatSheet(statSheet)) findings.push('Gameplay stats missing/unknown fields or version');
function shapeStatSheet(sheet) {
 return sheet&&Object.keys(sheet).sort().join(',')==='entries,format,snapshotDate,source,verification'
  && sheet.format==='community-gameplay-stats@1'
  && sheet.snapshotDate==='2026-11-01'
  && sheet.source==='night-city-archive:40eab012f0b683f4dc706df65ebf8dc5587f986c'
  && sheet.verification==='source-reported; not independently confirmed'
  && Array.isArray(sheet.entries);
}

const shape=(value,keys)=>value && Object.keys(value).sort().join(',')===keys.split(',').sort().join(',');
if(raw.length!==151 || catalog.cards.length!==151 || catalog.printings.length!==860) findings.push('Real catalog/printing coverage changed; review required');
const statKeys=new Set((statSheet.entries??[]).map(r=>r.id));
if((statSheet.entries??[]).length!==151 || statKeys.size!==151) findings.push('Gameplay stats must cover exactly 151 unique catalog identities');
for(const c of raw) if(!statKeys.has(`nca-card-${c.id}`)) findings.push('Gameplay stat source ID mismatch');
for(const r of statSheet.entries??[]) {
 if(!shape(r,'id,cost,power,ram,eddiable') || typeof r.id!=='string' || !statKeys.has(r.id)
   || !['cost','power','ram'].every(k=>r[k]===null || Number.isSafeInteger(r[k])&&r[k]>=0&&r[k]<=100)
   || typeof r.eddiable!=='boolean') findings.push('Invalid factual gameplay stat record');
}
for(const c of raw) {
 if(!shape(c,'id,external_id,name,subname,display_name,color,card_type,classifications,printings')) findings.push('Unreviewed raw card field (possible creative content)');
 for(const p of c.printings??[]) if(!shape(p,'id,collector_number,set,rarity,finish,language,localized_name')||!shape(p.set,'code,name')) findings.push('Unreviewed raw printing field');
}
for(const c of catalog.cards) if(c.artMediaId!==null||c.notes!=='') findings.push('Bundled card contains artwork association or unreviewed creative notes');
for(const p of catalog.printings) if(p.artMediaId!==null||p.notes!==''||p.providerMaps.length) findings.push('Bundled printing contains media, creative notes or provider dependency');
for(const name of ['react','react-dom','scheduler']) {
 const upstream=await readFile(`node_modules/${name}/LICENSE`,'utf8');
 const shipped=await readFile('public/THIRD_PARTY_NOTICES.txt','utf8');
 if(!shipped.includes(upstream.trim())) findings.push(`${name}: required runtime license notice missing`);
}
if(release) {
 if(decisions.codeAuthority!=='confirmed' || decisions.softwareLicense!=='MIT' || ! (await readFile('LICENSE','utf8')).includes('Permission is hereby granted, free of charge')) findings.push('PUBLIC RELEASE BLOCKED: CODE-AUTHORITY — confirm authority over manifest adaptations/contributions and apply scoped software license');
 if(JSON.parse(await readFile('package.json','utf8')).license!=='MIT' || JSON.parse(await readFile('package-lock.json','utf8')).packages[''].license!=='MIT' || !(await readFile('LICENSE','utf8')).includes('It excludes card metadata')) findings.push('PUBLIC RELEASE BLOCKED: software metadata or license scope mismatch');
 for(const issue of decisions.unresolvedPublicationIssues) if(!issue.startsWith('CODE-AUTHORITY:') || decisions.codeAuthority==='confirmed') findings.push(`PUBLIC RELEASE BLOCKED: ${issue}`);
 // Local development history is preserved, but must not become public ancestry.
 const {execFileSync}=await import('node:child_process');
 if(execFileSync('git',['rev-parse','--is-shallow-repository'],{encoding:'utf8'}).trim()==='true') findings.push('PUBLIC RELEASE BLOCKED: HISTORY-REVIEW — shallow history cannot be assessed; fetch full candidate history');
 const commits=execFileSync('git',['rev-list','--all'],{encoding:'utf8'}).split('\n');
 if(decisions.historyStrategy!=='clean-initial-snapshot') findings.push('Public history strategy requires review');
 if(commits.some(c=>c.startsWith('24b13f4'))) findings.push('PUBLIC RELEASE BLOCKED: HISTORY-SNAPSHOT — export the reviewed tree to an independent initial public repository; retain local development history separately');
}
// Both modes still scan every dataset and build file for artwork, network code, private data and secrets.
const inventory = JSON.parse(await readFile('docs/public-content-inventory.json', 'utf8'));
const allowed = new Map(inventory.files.map(f => [f.path, f.sha256]));
const patterns = [
 /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
 /(?:AKIA|ASIA)[A-Z0-9]{16}/,
 /(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}/,
 /(?:sk-proj-|sk-live-)[A-Za-z0-9_-]{16,}/,
 /(?:password|api[_-]?key|secret|access[_-]?token)\s*[:=]\s*["'][^"'\s]{8,}["']/i,
 /https?:\/\/[^\s"'<>]*(?:tailscale|tailnet|\.ts\.net|localhost|127\.0\.0\.1|192\.168\.|10\.\d+\.)/i,
 /\/root\/(?:workspace|ncv-import)|NCV_REFERENCE_DB|physicalVerification|complete-backup-\d/i,
 /(?:fetch\s*\(|XMLHttpRequest|WebSocket\s*\(|sendBeacon\s*\(|https?:\/\/)/,
 /data:image\/|<svg\b|<img\b/i,
];
// Reviewed screenshots contain only development catalog text and original CSS geometry.
const uxScreenshots=new Set(['before-390','after-390','after-welcome-390','after-list-390','after-keyboard-390','after-detail-390','after-picker-390','after-settings-390','after-320','after-landscape','after-desktop'].map(name=>`docs/phase-3c/${name}.png`));
// Phase 3D reviewed mobile evidence: catalog text, CSS geometry and the original app icon only.
for(const name of ['before-add','before-settings','after-390','after-welcome-390','after-list-390','after-keyboard-390','after-detail-390','after-picker-390','after-settings-390','after-320','after-landscape','after-desktop','after-settings-empty','after-add-undo','after-activity','after-photo','after-photo-library'])uxScreenshots.add(`docs/phase-3d/${name}.png`);
for(const engine of ['chromium','webkit'])for(const view of ['picker','controls'])uxScreenshots.add(`docs/phase-3d/special-${view}-${engine}.png`);
const binary = /\.(?:png|jpe?g|gif|webp|avif|svg|ico|pdf|zip|gz|tar|sqlite\d?|db|wal|mp4|woff2?)$/i;
const sha = b => createHash('sha256').update(b).digest('hex');
let sourceCount=0, buildCount=0, dependencyCount=0;
async function walk(dir, build=false) {
 for(const e of await readdir(dir,{withFileTypes:true})) {
  const full=path.join(dir,e.name), rel=path.relative(root,full).split(path.sep).join('/');
  if(['.git','node_modules'].includes(e.name)) continue;
  if((await lstat(full)).isSymbolicLink()) {findings.push(`${rel}: symbolic link`);continue;}
  if(e.isDirectory()) {await walk(full,build||rel==='dist');continue;}
  const bytes=await readFile(full);
  if((binary.test(rel)||bytes.includes(0))&&!uxScreenshots.has(rel)&&!['public/icons/vault-192.png','public/icons/vault-512.png','public/icons/apple-touch-icon.png','dist/icons/vault-192.png','dist/icons/vault-512.png','dist/icons/apple-touch-icon.png'].includes(rel)) findings.push(`${rel}: unapproved binary/asset`);
  if(build) {buildCount++; if(inventory.buildFiles[rel] !== sha(bytes)) findings.push(`${rel}: unreviewed build output (SHA-256 ${sha(bytes)})`);} else {
   sourceCount++;
   if(rel!=='docs/public-content-inventory.json' && (!allowed.has(rel)||allowed.get(rel)!==sha(bytes))) findings.push(`${rel}: absent/changed review inventory`);
  }
  // Audit tooling and lock metadata contain deliberate detection patterns and registry URLs.
  if(rel==='scripts/check-public-content.mjs'||rel==='package-lock.json'||rel==='docs/public-content-inventory.json') continue;
  const s=bytes.toString('utf8').replace(/https?:\/\/(?:react\.dev\/errors\/|www\.w3\.org\/|www\.mozilla\.org\/keymaster\/gatekeeper\/there\.is\.only\.xul)[^\s"'<>`)]*/g, 'REVIEWED_FRAMEWORK_IDENTIFIER');
  // Sole test-driver URL is an intercepted reserved .invalid origin; no connection occurs.
  let scanned=rel==='scripts/run-browser-tests.mjs' ? s.replaceAll('https://community.invalid','REVIEWED_INTERCEPTED_TEST_ORIGIN') : s;
  if(['README.md','docs/phase-4a-results.md','docs/release-review.md'].includes(rel))for(const url of ['https://elvinmorales.github.io/night-city-vault-community/','https://github.com/ttiiggss/night-city-archive','https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages'])scanned=scanned.replaceAll(url,'REVIEWED_PHASE_4A_CITATION');
  if(rel==='scripts/check-pages-artifact.mjs')scanned=scanned.replaceAll('https://pages.invalid','REVIEWED_NONNETWORK_URL_RESOLUTION');
  // Only these manually reviewed documentary citations are permitted; application network rules stay unchanged.
  if(rel==='docs/catalog-source-assessment.md')for(const url of [
   'https://cyberpunktcg.com/cards',
   'https://cyberpunktcg.com/terms-of-service',
   'https://github.com/ttiiggss/night-city-archive',
   'https://github.com/renatom11/cyberpunk-tcg',
   'https://mtcg.app/en/cyberpunk/welcome-to-night-city/cards',
   'https://mtcg.app/en/terms-of-service',
   'https://docs.tcgplayer.com/docs/getting-started',
   'https://help.tcgplayer.com/hc/en-us/articles/360061115874-TCGplayer-API-Terms-Conditions'
  ])scanned=scanned.replaceAll(url+')','REVIEWED_DOCUMENTARY_CITATION)');
  if(rel==='docs/phase-3d-design-findings.md')for(const url of [
   'https://github.com/adobe/react-spectrum',
   'https://react-spectrum.adobe.com/ComboBox',
   'https://react-aria.adobe.com/Modal',
   'https://github.com/shadcn-ui/ui',
   'https://ui.shadcn.com/docs/components/base/combobox',
   'https://github.com/emilkowalski/sonner',
   'https://github.com/radix-ui/primitives',
   'https://www.radix-ui.com/primitives/docs/components/dialog',
   'https://www.radix-ui.com/primitives/docs/components/toast'
  ])scanned=scanned.replaceAll(url+')','REVIEWED_UX_DOCUMENTARY_CITATION)');
  // Reviewed Phase 3A renderer: these two JSX tags receive only local object URLs.
  // Keep data URLs, SVG, binaries, external URLs and every other image tag prohibited.
  // Exact source/build hashes remain mandatory; field-level catalog review remains mandatory.
  if(rel==='src/ui/Artwork.tsx'||(rel.startsWith('dist/')&&rel.endsWith('.js.map')))
   scanned=scanned.replaceAll('<img className=', '<REVIEWED_LOCAL_BLOB_IMAGE className=');
  // Phase 3B reviewed networking: build-owned same-origin shell only; loopback test server only.
  if(rel==='scripts/pwa-build.mjs'||rel==='dist/sw.js')scanned=scanned.replaceAll('fetch(event.request)', 'REVIEWED_SAME_ORIGIN_SHELL_FETCH');
  if(rel==='scripts/pwa-browser-tests.mjs'||rel==='scripts/mobile-ux-tests.mjs'||rel==='scripts/phase-3d-ux-tests.mjs')scanned=scanned.replaceAll('http://loopback.invalid','REVIEWED_LOOPBACK_TEST_BASE').replaceAll('http://127.0.0.1:', 'REVIEWED_LOOPBACK_TEST_ORIGIN');
  if(rel==='docs/iphone-private-testing.md')for(const url of ['https://tailscale.com/docs/features/tailscale-serve','https://tailscale.com/docs/reference/tailscale-cli/serve','https://tailscale.com/docs/reference/syntax/grants'])scanned=scanned.replaceAll(url,'REVIEWED_PRIVATE_ACCESS_DOCUMENTATION');
  if(rel==='docs/phase-3b-results.md')for(const url of ['https://github.com/microsoft/playwright/issues/42795','https://github.com/microsoft/playwright/issues/41618'])scanned=scanned.replaceAll(url,'REVIEWED_BROWSER_LIMITATION_CITATION');
  // Reviewed documentary links are inert; exact file hashes still require review. Runtime URL/network checks remain unchanged.
  const documentary=/\.(?:md|txt)$/.test(rel) ? scanned.replace(/https?:\/\/[^\s<>]+/g,'REVIEWED_DOCUMENTARY_LINK') : scanned;
  for(const [index,p] of patterns.entries()) if(p.test(index===7 ? documentary : scanned)) findings.push(`${rel}: prohibited content ${p.source}`);
 }
}
await walk(root);
for(const rel of allowed.keys()) {try {await lstat(rel);} catch {findings.push(`${rel}: reviewed file missing`);}}
try {await lstat('dist/index.html');} catch {findings.push('Build output missing; run build first');}
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
const pkg=JSON.parse(await readFile('package.json','utf8'));
if(JSON.stringify({...pkg.dependencies,...pkg.devDependencies})!==JSON.stringify(inventory.directDependencies)) findings.push('Unreviewed direct dependencies');
const licenses=new Set(['MIT','ISC','BSD-2-Clause','BSD-3-Clause','Apache-2.0','0BSD','BlueOak-1.0.0']);
for(const [name,meta] of Object.entries(lock.packages)) {
 if(!name)continue;dependencyCount++;
 if(!meta.integrity||!/^https:\/\/registry\.npmjs\.org\//.test(meta.resolved??'')) findings.push(`${name}: unapproved origin/integrity`);
 if(!licenses.has(meta.license) && !(meta.license === 'MPL-2.0' && /^node_modules\/lightningcss(?:-|$)/.test(name)))findings.push(`${name}: review license ${meta.license}`);
 // Verify installed package identity where present (optional platform packages may be absent).
 try {const installed=JSON.parse(await readFile(`${name}/package.json`,'utf8'));if(installed.version!==meta.version) findings.push(`${name}: installed version mismatch`);}catch(err){if(err.code!=='ENOENT')throw err;}
}
let dependencyFiles = 0;
async function dependencyWalk(dir) {
 for(const e of await readdir(dir,{withFileTypes:true})) {
  const full=path.join(dir,e.name), rel=path.relative(root,full).split(path.sep).join('/');
  if((await lstat(full)).isSymbolicLink()) {if(!rel.startsWith('node_modules/.bin/')) findings.push(`${rel}: unexpected dependency symlink`);continue;}
  if(e.isDirectory()) {await dependencyWalk(full);continue;}
  dependencyFiles++;
  const bytes=await readFile(full);
  // npm rewrites installation metadata across versions; the committed lock and package bytes remain authoritative.
  if(rel!=='node_modules/.package-lock.json' && !/^node_modules\/\.(?:vite|vitest-cache)\//.test(rel) && inventory.dependencyFiles[rel]!==sha(bytes)) findings.push(`${rel}: unreviewed dependency content`);
  if(!bytes.includes(0)) {
   const s=bytes.toString('utf8');
   for(const p of [patterns[0],patterns[1],patterns[2],patterns[3],patterns[6]]) if(p.test(s)) findings.push(`${rel}: prohibited dependency content`);
  }
 }
}
await dependencyWalk(path.join(root,'node_modules'));
for(const rel of Object.keys(inventory.dependencyFiles)) {if(/^node_modules\/\.(?:vite|vitest-cache)\//.test(rel))continue;try {await lstat(rel);} catch {findings.push(`${rel}: reviewed dependency file missing`);}}
if(findings.length){console.error(findings.join('\n'));process.exitCode=1;}
else console.log(`PASS: ${sourceCount} reviewed repository files; ${buildCount} build files; ${dependencyCount} locked dependency entries; ${dependencyFiles} dependency files. No prohibited assets or content detected. Field-level factual catalog review verified; ${release?'release checks passed for this candidate':'local safety checks only; run audit:release for publication gates'}.`);
