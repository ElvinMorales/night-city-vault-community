import {artworkTests,artworkBenchmark} from './artwork';
import { archiveTests } from './archive';
import { catalogTests } from './catalog';
import { IndexedDBRepository as Repository, prepareCommand } from '../../src/storage/indexeddb/repository';
import { exportBackup, parseBackup, previewRestore, restoreBackup, MAX_BACKUP_BYTES } from '../../src/interchange/backup';
import { canonical, digest, patchState, byteSize, type Archive } from '../../src/storage/state';
import { normalizeName } from '../../src/domain/analysis';
import { card, printing, lot } from '../fixtures/fictional';
import type { DomainCommand } from '../../src/domain/commands';
const check = (condition: unknown, message = 'Assertion failed') => { if (!condition)
    throw new Error(message); };
const same = (a: unknown, b: unknown) => check(canonical(a) === canonical(b), 'Values differ');
async function rejects(fn: () => Promise<unknown>) { let failed = false; try {
    await fn();
}
catch {
    failed = true;
} check(failed, 'Expected rejection'); }
let serial = 0;
const name = () => `fiction-phase1-${Date.now()}-${serial++}`;
async function command(r: Repository, body: DomainCommand['body'], versions: DomainCommand['expectedVersions'] = [], op = name()) { return r.execute(await prepareCommand(op, body, versions.length ? [...versions, { entity: 'revision', id: 'collection', version: (await r.readSnapshot()).revision }] : versions)); }
async function seed(db = name()) { const r = await Repository.open(db); check((await command(r, { type: 'save-card', card })).ok); check((await command(r, { type: 'save-printing', printing })).ok); return r; }
const stored = () => { const { allocatedQty: _, ...l } = lot; return { ...l, protectedQty: 0, forTradeQty: 0 }; };
const guard = (version: number) => [{ entity: 'holding', id: lot.id, version }];
const add = (quantity = 1): DomainCommand['body'] => ({ type: 'quick-add', cardId: card.id, printingId: printing.id, quantity, isSealed: false });
export const tests: [
    string,
    () => Promise<void>
][] = [
    ['fresh database and committed audit', async () => { const r = await Repository.open(name()); try {
            const s = await r.readSnapshot();
            same(s.cards, []);
            check(s.revision === 0);
            await command(r, { type: 'save-card', card });
            const a = await r.archive();
            check(a.events.length === 1 && a.operations.length === 1 && a.batches.length === 1 && a.meta.revision === 1);
        }
        finally {
            r.close();
        } }],
    ['atomic invalid reference and encumbrance rollback', async () => { const r = await seed(); try {
            const before = await r.archive();
            check(!(await command(r, { type: 'add-lot', lot: { ...stored(), printingId: 'missing' } })).ok);
            check(!(await command(r, { type: 'add-lot', lot: { ...stored(), quantity: 1, protectedQty: 2 } })).ok);
            same(await r.archive(), before);
        }
        finally {
            r.close();
        } }],
    ['concurrent independent additions serialize', async () => { const db = name(), r = await seed(db), other = await Repository.open(db); try {
            const result = await Promise.all(Array.from({ length: 20 }, (_, i) => command(i % 2 ? r : other, add())));
            check(result.every(x => x.ok));
            check((await r.readSnapshot()).lots.reduce((n, l) => n + l.quantity, 0) === 20);
        }
        finally {
            r.close();
            other.close();
        } }],
    ['replay and conflicting operation payload', async () => { const r = await seed(); try {
            const c = await prepareCommand('fiction-replay', add());
            const first = await r.execute(c), second = await r.execute(c);
            check(first.ok && second.ok && second.replayed && second.revision === first.revision);
            const conflict = await command(r, add(5), [], 'fiction-replay');
            check(!conflict.ok && conflict.code === 'replay-mismatch');
            check((await r.readSnapshot()).lots[0].quantity === 1);
            const forged = { ...c, body: add(9) };
            check(!(await r.execute(forged)).ok);
        }
        finally {
            r.close();
        } }],
    ['compound lot references and derived reservations', async () => { const r = await seed(); try {
            await command(r, { type: 'add-lot', lot: stored() });
            await command(r, { type: 'add-lot', lot: { ...stored(), kind: 'unresolved', printingId: null } });
            check((await command(r, { type: 'allocate', allocation: { id: 'fiction-a', lotKind: 'unresolved', lotId: lot.id, container: 'Fiction box', containerKind: 'box', deckPlanId: null, quantity: 2, notes: '' } })).ok);
            const s = await r.readSnapshot();
            check(s.lots.find(x => x.kind === 'holding')?.allocatedQty === 0 && s.lots.find(x => x.kind === 'unresolved')?.allocatedQty === 2);
        }
        finally {
            r.close();
        } }],
    ['exact printing collisions and leading zero identity', async () => { const r = await seed(); try {
            check(!(await command(r, { type: 'save-printing', printing: { ...printing, id: 'fiction-duplicate' } })).ok);
            check((await command(r, { type: 'save-printing', printing: { ...printing, id: 'fiction-different', collectorNumber: '7' } })).ok);
            check((await r.readSnapshot()).printings.length === 2);
        }
        finally {
            r.close();
        } }],
    ['sealed ownership and allocation rejection', async () => { const r = await seed(); try {
            await command(r, { type: 'add-lot', lot: { ...stored(), isSealed: true } });
            const before = await r.archive();
            check(!(await command(r, { type: 'allocate', allocation: { id: 'a', lotKind: 'holding', lotId: lot.id, container: '', containerKind: 'deck', deckPlanId: null, quantity: 1, notes: '' } })).ok);
            same(await r.archive(), before);
            check((await r.readSnapshot()).lots[0].quantity === 8);
            check(!(await command(r, { ...add(), isSealed: true } as never)).ok);
        }
        finally {
            r.close();
        } }],
    ['protected and deliberate trade inventory with stale guards', async () => { const r = await seed(); try {
            await command(r, { type: 'add-lot', lot: stored() });
            check((await command(r, { type: 'set-reservations', lot, protectedQty: 3, forTradeQty: 2, confirmUnprotect: false }, guard(1))).ok);
            const before = await r.archive();
            check(!(await command(r, { type: 'adjust-lot', lot, delta: -4 })).ok);
            check(!(await command(r, { type: 'set-reservations', lot, protectedQty: 2, forTradeQty: 2, confirmUnprotect: false }, guard(2))).ok);
            same(await r.archive(), before);
            check((await command(r, { type: 'set-reservations', lot, protectedQty: 2, forTradeQty: 3, confirmUnprotect: true }, guard(2))).ok);
            const stale = await command(r, { type: 'set-reservations', lot, protectedQty: 0, forTradeQty: 0, confirmUnprotect: true }, guard(2));
            check(!stale.ok && stale.code === 'conflict');
        }
        finally {
            r.close();
        } }],
    ['reserved quantities cannot be reduced and allocations can be removed', async () => { const r = await seed(); try {
            await command(r, { type: 'add-lot', lot: stored() });
            await command(r, { type: 'allocate', allocation: { id: 'a', lotKind: 'holding', lotId: lot.id, container: '', containerKind: 'deck', deckPlanId: null, quantity: 6, notes: '' } });
            check(!(await command(r, { type: 'adjust-lot', lot, delta: -3 })).ok);
            check((await command(r, { type: 'remove-allocation', allocationId: 'a' }, guard(2))).ok);
            check((await command(r, { type: 'adjust-lot', lot, delta: -8 })).ok);
        }
        finally {
            r.close();
        } }],
    ['unresolved quick-add never infers a printing and reconciliation conserves copies', async () => { const r = await seed(); try {
            await command(r, { type: 'quick-add', cardId: card.id, quantity: 5, printingId: null, isSealed: false });
            let s = await r.readSnapshot();
            check(s.lots[0].kind === 'unresolved' && s.lots[0].printingId === null);
            const l = s.lots[0];
            check((await command(r, { type: 'reconcile', from: l, toPrintingId: printing.id, quantity: 3 }, [{ entity: 'unresolved', id: l.id, version: l.version }])).ok);
            s = await r.readSnapshot();
            check(s.lots.reduce((n, x) => n + x.quantity, 0) === 5 && s.lots.find(x => x.kind === 'holding')?.quantity === 3);
        }
        finally {
            r.close();
        } }],
    ['audit history and guarded undo with monotonic versions', async () => { const r = await seed(); try {
            const c = await command(r, add(2));
            check(c.ok);
            if (!c.ok)
                return;
            const undone = await command(r, { type: 'undo', batchId: c.batchId });
            check(undone.ok && (await r.readSnapshot()).lots.length === 0);
            check(!(await command(r, { type: 'undo', batchId: c.batchId })).ok);
            await command(r, { type: 'add-lot', lot: stored() });
            const absolute = await command(r, { type: 'set-reservations', lot, protectedQty: 2, forTradeQty: 0, confirmUnprotect: false }, guard(1));
            check(absolute.ok);
            if (!absolute.ok)
                return;
            check((await command(r, { type: 'undo', batchId: absolute.batchId })).ok);
            check((await r.readSnapshot()).lots[0].version === 3);
            const c2 = await command(r, add());
            check(c2.ok);
            await command(r, add());
            if (c2.ok)
                check(!(await command(r, { type: 'undo', batchId: c2.batchId })).ok);
        }
        finally {
            r.close();
        } }],
    ['card edits preserve aliases and reject stale editors', async () => { const r = await seed(); try {
            const v = [{ entity: 'cards', id: card.id, version: 1 }];
            check((await command(r, { type: 'save-card', card: { ...card, name: 'Fictional Brass Turnip' } }, v)).ok);
            const result = await command(r, { type: 'save-card', card }, v);
            check(!result.ok && result.code === 'conflict');
            check((await r.readSnapshot()).cards[0].aliases.includes(card.name));
            check(!(await command(r, { type: 'save-card', card: { ...card, id: 'other', name: card.name } })).ok);
        }
        finally {
            r.close();
        } }],
    ['complete backup into fresh database and replay does not reacquire', async () => { const r = await seed(), fresh = await Repository.open(name()); try {
            const c = await prepareCommand('fiction-acquisition', add(4));
            await r.execute(c);
            const source = await exportBackup(r), p = await previewRestore(fresh, source);
            check(p.copies === 4);
            let recovery = '';
            await restoreBackup(fresh, p, async (b) => { recovery = b; });
            check((await parseBackup(recovery)).archive.state.cards.length === 0);
            const a = await r.archive(), b = await fresh.archive();
            same(a.state, b.state);
            same(a.operations, b.operations);
            same(a.batches, b.batches);
            same(a.events, b.events);
            const result = await fresh.execute(c);
            check(result.ok && result.replayed && (await fresh.readSnapshot()).lots[0].quantity === 4);
            check((await command(fresh, { type: 'undo', batchId: c.operationId })).ok);
            check((await fresh.readSnapshot()).lots.length === 0);
            await restoreBackup(fresh, await previewRestore(fresh, source), async () => { });
            check((await fresh.readSnapshot()).lots[0].quantity === 4);
        }
        finally {
            r.close();
            fresh.close();
        } }],
    ['malformed unsupported oversized and checksum failures preserve data', async () => { const r = await seed(); try {
            const before = await r.archive(), source = await exportBackup(r);
            for (const input of ['{', '{}', ' '.repeat(MAX_BACKUP_BYTES + 1), source.replace('community-backup@2', 'community-backup@9'), source.replace('Clockwork Turnip', 'Fictional Corruption')])
                await rejects(() => previewRestore(r, input));
            same(await r.archive(), before);
        }
        finally {
            r.close();
        } }],
    ['valid checksum cannot hide broken references quantities or history', async () => { const r = await seed(); try {
            await command(r, add());
            const source = await exportBackup(r);
            for (const mutate of [(a: Archive) => { a.state.lots[0].printingId = 'missing'; }, (a: Archive) => { a.state.lots[0].quantity = -1; }, (a: Archive) => { a.operations[0].result.revision = 999; }, (a: Archive) => { a.batches[0].after.cards[0].notes = 'Fictional altered history'; }]) {
                const b = JSON.parse(source);
                mutate(b.archive);
                delete b.checksum;
                b.checksum = await digest(b);
                await rejects(() => parseBackup(JSON.stringify(b)));
            }
        }
        finally {
            r.close();
        } }],
    ['failed recovery sink and stale preview leave collection unchanged', async () => { const r = await seed(); try {
            const source = await exportBackup(r), p = await previewRestore(r, source), before = await r.archive();
            await rejects(() => restoreBackup(r, p, async () => { throw new Error('Fictional interrupted download'); }));
            same(await r.archive(), before);
            await command(r, add());
            const current = await r.archive();
            await rejects(() => restoreBackup(r, p, async () => { }));
            same(await r.archive(), current);
        }
        finally {
            r.close();
        } }],
    ['write abort never reports success or changes history', async () => { const r = await seed(); try {
            const before = await r.archive();
            const original = IDBObjectStore.prototype.add;
            IDBObjectStore.prototype.add = function (...args: Parameters<IDBObjectStore['add']>) { if (this.name === 'operations') {
                this.transaction.abort();
                throw new DOMException('Fictional quota exhaustion', 'QuotaExceededError');
            } return original.apply(this, args); };
            try {
                const result = await command(r, add());
                check(!result.ok && result.code === 'storage');
            }
            finally {
                IDBObjectStore.prototype.add = original;
            }
            same(await r.archive(), before);
        }
        finally {
            r.close();
        } }],
    ['interrupted replacement rolls back all stores', async () => { const r = await seed(), other = await seed(); try {
            await command(other, add(3));
            const p = await previewRestore(r, await exportBackup(other)), before = await r.archive();
            const original = IDBObjectStore.prototype.clear;
            let injected = false;
            IDBObjectStore.prototype.clear = function () { if (this.name === 'events' && !injected) {
                injected = true;
                this.transaction.abort();
                throw new DOMException('Fictional interruption', 'AbortError');
            } return original.call(this); };
            try {
                await rejects(() => restoreBackup(r, p, async () => { }));
            }
            finally {
                IDBObjectStore.prototype.clear = original;
            }
            same(await r.archive(), before);
        }
        finally {
            r.close();
            other.close();
        } }],
    ['failed database open surfaces storage error', async () => { const original = IDBFactory.prototype.open; IDBFactory.prototype.open = function () { throw new DOMException('Fictional storage denied', 'SecurityError'); }; try {
            await rejects(() => Repository.open(name()));
        }
        finally {
            IDBFactory.prototype.open = original;
        } }],
    ['v1 to v3 upgrade retains exact identity and records', async () => { const db = name(); await new Promise<void>((resolve, reject) => { const open = indexedDB.open(db, 1); open.onupgradeneeded = () => { for (const store of ['meta', 'cards', 'aliases', 'printings', 'lots', 'allocations', 'decks', 'deckLines', 'trades', 'tradeLines', 'quotes', 'providerMaps', 'events', 'batches', 'operations', 'imports', 'artworkEntries', 'blobs'])
            open.result.createObjectStore(store, { keyPath: store === 'meta' ? 'key' : store === 'lots' ? ['kind', 'id'] : store === 'events' ? 'seq' : 'id' }); const t = open.transaction!; t.objectStore('meta').put({ key: 'state', revision: 0, schema: 1, headBatch: null }); t.objectStore('cards').put(card); t.objectStore('printings').put(printing); }; open.onsuccess = () => { open.result.close(); resolve(); }; open.onerror = () => reject(open.error); }); const r = await Repository.open(db); try {
            same((await r.readSnapshot()).printings, [printing]);
            check((await command(r, add())).ok);
            check(!(await command(r, { type: 'save-printing', printing: { ...printing, id: 'collision' } })).ok);
        }
        finally {
            r.close();
        } }],
];
// Construct the documented Phase 1 snapshot format, without relying on the new exporter.
function legacyArchive(a: Archive): Archive {
    const result = structuredClone(a);
    let current = structuredClone(a.state);
    for (const b of [...result.batches].sort((a, b) => b.revision - a.revision)) {
        const baseline = b.format ? patchState(current, b.after, b.before) : b.before;
        b.after = current; b.before = baseline;
        delete b.format; delete b.legacyUndo;
        current = baseline;
    }
    return result;
}
async function legacySource(a: Archive) {
    const body = { format: 'community-backup@1', schemaVersion: 2, appVersion: '0.1.0', createdAt: '2026-01-01T00:00:00Z', archive: legacyArchive(a), artwork: { entries: [], blobs: [] } };
    return canonical({ ...body, checksum: await digest(body) });
}
async function legacyDatabase(db: string, a: Archive) {
    await new Promise<void>((resolve, reject) => {
        const q = indexedDB.open(db, 2);
        q.onupgradeneeded = () => {
            for (const store of ['meta', 'cards', 'aliases', 'printings', 'lots', 'allocations', 'decks', 'deckLines', 'trades', 'tradeLines', 'quotes', 'providerMaps', 'events', 'batches', 'operations', 'imports', 'artworkEntries', 'blobs'])
                q.result.createObjectStore(store, { keyPath: store === 'meta' ? 'key' : store === 'lots' ? ['kind', 'id'] : store === 'events' ? 'seq' : 'id' });
            const tx = q.transaction!;
            for (const [store, index, key, unique] of [
                ['cards','name','name',false], ['aliases','normalized','normalized',false], ['aliases','cardId','cardId',false],
                ['printings','identity','identity',true], ['printings','cardId','gameplayCardId',false],
                ['lots','cardId','gameplayCardId',false], ['lots','printingId','printingId',false],
                ['allocations','lot',['lotKind','lotId'],false], ['allocations','deck','deckPlanId',false],
                ['events','batch','batchId',false], ['batches','revision','revision',true],
            ] as [string,string,string|string[],boolean][]) tx.objectStore(store).createIndex(index,key,{unique});
            tx.objectStore('meta').put(a.meta);
            for (const k of ['cards','printings','lots','allocations'] as const) for (const row of a.state[k])
                tx.objectStore(k).put(k === 'printings' ? { ...row, identity: canonical([(row as typeof printing).gameplayCardId,(row as typeof printing).setCode,(row as typeof printing).collectorNumber ?? '',(row as typeof printing).treatment,(row as typeof printing).language]) } : row);
            for (const c of a.state.cards) for(const name of [c.name,...c.aliases]) { const normalized=normalizeName(name);tx.objectStore('aliases').put({id:canonical([c.id,normalized]),cardId:c.id,normalized}); }
            for (const k of ['batches','events','operations'] as const) for (const row of a[k]) tx.objectStore(k).put(row);
        };
        q.onsuccess = () => { q.result.close(); resolve(); }; q.onerror = () => reject(q.error);
    });
}
tests.push(
    ['routine writes touch only changed rows and cache exact archive bytes', async () => {
        const r = await seed();
        await command(r, add(10));
        const writes: string[] = [], originalPut = IDBObjectStore.prototype.put, originalClear = IDBObjectStore.prototype.clear, originalGetAll = IDBObjectStore.prototype.getAll;
        IDBObjectStore.prototype.put = function (...args: Parameters<IDBObjectStore['put']>) { writes.push(this.name); return originalPut.apply(this,args); };
        IDBObjectStore.prototype.clear = function () { throw new Error('Routine mutation cleared a store'); };
        IDBObjectStore.prototype.getAll = function (...args: Parameters<IDBObjectStore['getAll']>) { if(['batches','events','operations'].includes(this.name)) throw new Error('Routine write read all history'); return originalGetAll.apply(this,args); };
        try {
            check((await command(r, { type:'adjust-lot', lot:{kind:'holding',id:(await r.readSnapshot()).lots[0].id},delta:1 })).ok);
            same(writes.filter(x => ['cards','printings','lots','allocations','aliases'].includes(x)), ['lots']);
            const current=(await r.readSnapshot()).cards[0];writes.length=0;
            check((await command(r,{type:'save-card',card:{...current,notes:'Fictional incremental note'}},[{entity:'cards',id:current.id,version:current.version}])).ok);
            same(writes.filter(x=>['cards','aliases','printings','lots','allocations'].includes(x)),['cards']);
            IDBObjectStore.prototype.getAll = originalGetAll;
            const a = await r.archive(), head = a.batches.find(b=>b.revision===4)!;
            check(head.format === 'delta@1' && head.before.lots.length === 1 && head.after.lots.length === 1 && !head.after.cards.length && !head.after.printings.length);
            const db = await new Promise<IDBDatabase>(resolve => { const q = indexedDB.open((r as unknown as {db:IDBDatabase}).db.name); q.onsuccess=()=>resolve(q.result); });
            const cache = await new Promise<{bytes:number}>(resolve => {const q=db.transaction('meta').objectStore('meta').get('archiveBytes');q.onsuccess=()=>resolve(q.result);});
            same(cache.bytes, byteSize(a)); db.close();
        } finally { IDBObjectStore.prototype.put=originalPut; IDBObjectStore.prototype.clear=originalClear; IDBObjectStore.prototype.getAll=originalGetAll; r.close(); }
    }],
    ['archive accounting remains exact through inserts deletes undo and restored edits', async () => {
        const r=await seed(),target=await Repository.open(name());
        const verify=async(repo:Repository)=>{
            const a=await repo.archive(),db=(repo as unknown as {db:IDBDatabase}).db;
            const cache=await new Promise<{bytes:number,historyCount:number}>(resolve=>{const q=db.transaction('meta').objectStore('meta').get('archiveBytes');q.onsuccess=()=>resolve(q.result);});
            same(cache.bytes,byteSize(a));same(cache.historyCount,a.batches.length);
        };
        try {
            await command(r,{type:'add-lot',lot:stored()});await verify(r);
            const second=await command(r,{type:'add-lot',lot:{...stored(),id:'fiction-second'}});check(second.ok);await verify(r);
            if(second.ok)check((await command(r,{type:'undo',batchId:second.batchId})).ok);await verify(r);
            await command(r,{type:'allocate',allocation:{id:'fiction-size-allocation',lotKind:'holding',lotId:lot.id,quantity:1,container:'',containerKind:'other',deckPlanId:null,notes:''}});await verify(r);
            const row=(await r.readSnapshot()).lots[0];
            await command(r,{type:'remove-allocation',allocationId:'fiction-size-allocation'},[{entity:'holding',id:row.id,version:row.version}]);await verify(r);
            const source=await exportBackup(r);await restoreBackup(target,await previewRestore(target,source),async()=>{});await verify(target);
            check((await command(target,{type:'adjust-lot',lot,delta:1})).ok);await verify(target);
        } finally {r.close();target.close();}
    }],
    ['legacy backup compatibility preserves full restoration replay and head undo', async () => {
        const r = await seed(), target = await Repository.open(name());
        try {
            const c = await prepareCommand('fiction-legacy-acquire', add(6)); check((await r.execute(c)).ok);
            const source = await legacySource(await r.archive());
            await restoreBackup(target,await previewRestore(target,source),async()=>{});
            same((await target.archive()).state,(await r.archive()).state);
            same((await target.archive()).operations,(await r.archive()).operations);
            same((await target.archive()).events,(await r.archive()).events);
            check((await target.execute(c)).ok && (await target.readSnapshot()).lots[0].quantity===6);
            check((await command(target,{type:'undo',batchId:c.operationId})).ok);
            // Original snapshot inverse advanced unrelated surviving entity versions too.
            check((await target.readSnapshot()).cards[0].version===2);
            await parseBackup(await exportBackup(target));
        } finally {r.close();target.close();}
    }],
    ['populated v2 migration compacts history without changing records or replay', async () => {
        const source = await seed();
        await command(source,add(5));
        const a = legacyArchive(await source.archive()), db = name(); source.close();
        await legacyDatabase(db,a);
        const migrated=await Repository.open(db);
        try {
            const b=await migrated.archive();same(a.state,b.state);same(a.operations,b.operations);same(a.events,b.events);
            check(b.batches.some(x=>x.format==='delta@1'));check(b.batches.every(x=>!x.format||x.legacyUndo));
            await parseBackup(await exportBackup(migrated));
            const o=a.operations.at(-1)!, p=JSON.parse(o.payload);
            const replay=await migrated.execute({operationId:o.id,fingerprint:o.fingerprint,...p});check(replay.ok&&replay.replayed);
            check((await command(migrated,{type:'undo',batchId:o.id})).ok);
            await parseBackup(await exportBackup(migrated));
        } finally {migrated.close();}
    }],
    ['failed v2 upgrade rolls back compacted history and database version', async () => {
        const source=await seed();await command(source,add(3));const a=legacyArchive(await source.archive());source.close();
        const db=name();await legacyDatabase(db,a);
        const original=IDBCursor.prototype.update;
        IDBCursor.prototype.update=function(value:unknown) { const result=original.call(this,value); if(this.source instanceof IDBObjectStore) this.source.transaction.abort(); return result; };
        try {await rejects(()=>Repository.open(db));} finally {IDBCursor.prototype.update=original;}
        const unchanged=await new Promise<IDBDatabase>((resolve,reject)=>{const q=indexedDB.open(db,2);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
        check(unchanged.version===2);
        const read=unchanged.transaction('batches'),readDone=new Promise<void>((resolve,reject)=>{read.oncomplete=()=>resolve();read.onabort=()=>reject(read.error);});
        const batches=await new Promise(resolve=>{const q=read.objectStore('batches').getAll();q.onsuccess=()=>resolve(q.result);});
        await readDone;
        same(batches,[...a.batches].sort((x,y)=>x.id.localeCompare(y.id)));unchanged.close();
        const retry=await Repository.open(db);await parseBackup(await exportBackup(retry));retry.close();
    }],
    ['concurrent constrained reductions cannot overspend inventory', async () => {
        const db=name(), a=await seed(db), b=await Repository.open(db);
        try {
            check((await command(a,{type:'add-lot',lot:{...stored(),quantity:3,protectedQty:1}})).ok);
            const results=await Promise.all([command(a,{type:'adjust-lot',lot,delta:-2}),command(b,{type:'adjust-lot',lot,delta:-2})]);
            check(results.filter(x=>x.ok).length===1);check((await a.readSnapshot()).lots[0].quantity===1);
            await parseBackup(await exportBackup(a));
        } finally {a.close();b.close();}
    }],
    ['delta tampering duplicates and missing inverse rows reject without writes', async () => {
        const r=await seed(); await command(r,add(4)); const source=await exportBackup(r), before=await r.archive();
        try {
            for(const mutate of [
                (a:Archive)=>{a.batches.at(-1)!.after.lots.push(a.batches.at(-1)!.after.lots[0]);},
                (a:Archive)=>{a.batches.at(-1)!.after.lots[0].quantity++;},
                (a:Archive)=>{a.batches.at(-1)!.before.cards.push(card);},
            ]) {const b=JSON.parse(source);mutate(b.archive);delete b.checksum;b.checksum=await digest(b);await rejects(()=>previewRestore(r,canonical(b)));}
            same(before,await r.archive());
        } finally {r.close();}
    }],
);
// Performance fixtures bypass acquisition history only during setup; measured writes use the public command API.
async function benchmark(onlyCount?: number) {
    const rows = [];
    for (const count of onlyCount ? [onlyCount] : [100, 1000, 5000]) {
        const db = name(), setup = await Repository.open(db);
        setup.close();
        const connection = await new Promise<IDBDatabase>((resolve, reject) => { const q = indexedDB.open(db); q.onsuccess = () => resolve(q.result); q.onerror = () => reject(q.error); });
        const tx = connection.transaction(['cards', 'printings', 'lots'], 'readwrite');
        const done = new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); });
        for (let i = 0; i < count; i++) {
            const id = `fiction-bench-${i}`;
            tx.objectStore('cards').put({ ...card, id, name: `Fictional benchmark card ${i}` });
            tx.objectStore('printings').put({ ...printing, id, gameplayCardId: id, identity: JSON.stringify([id, printing.setCode, printing.collectorNumber, printing.treatment, printing.language]) });
            tx.objectStore('lots').put({ ...stored(), id, gameplayCardId: id, printingId: id });
        }
        await done; connection.close();
        const r = await Repository.open(db), times: number[] = [];
        let rejected = '';
        const initial = await r.archive(), initialHistoryBytes = byteSize({batches:initial.batches,events:initial.events,operations:initial.operations});
        for (let cycle = 0; cycle < 26; cycle++) {
            const id = `fiction-bench-${cycle % count}`, ref = {kind:'holding' as const,id};
            const unresolvedId = `fiction-unresolved-${cycle}`, allocationId = `fiction-allocation-${cycle}`;
            const cases: [DomainCommand['body'], string?][] = [
                [{type:'quick-add',cardId:id,printingId:id,quantity:2,isSealed:false}],
                [{type:'adjust-lot',lot:ref,delta:-1}],
                [{type:'quick-add',cardId:id,printingId:null,quantity:4,isSealed:false},unresolvedId],
                [{type:'set-reservations',lot:ref,protectedQty:1,forTradeQty:1,confirmUnprotect:false}],
                [{type:'allocate',allocation:{id:allocationId,lotKind:'holding',lotId:id,quantity:1,container:'Fictional deck',containerKind:'deck',deckPlanId:null,notes:''}}],
                [{type:'reconcile',from:{kind:'unresolved',id:unresolvedId},toPrintingId:id,quantity:2}],
                [{type:'remove-allocation',allocationId}],
                [{type:'add-lot',lot:{...stored(),id:`fiction-sealed-${cycle}`,gameplayCardId:id,printingId:id,isSealed:true,quantity:2}}],
            ];
            for(const [body,op] of cases) {
                const start=performance.now();
                const snapshot=await r.readSnapshot();
                const lotRef=body.type==='set-reservations'?body.lot:body.type==='reconcile'?body.from:body.type==='remove-allocation'?ref:null;
                const row=lotRef?snapshot.lots.find(l=>l.kind===lotRef.kind&&l.id===lotRef.id):null;
                const versions:DomainCommand['expectedVersions']=row?[{entity:row.kind,id:row.id,version:row.version},{entity:'revision',id:'collection',version:snapshot.revision}]:[];
                const result=await r.execute(await prepareCommand(op??name(),body,versions));
                times.push(performance.now()-start);
                if(!result.ok){rejected=result.message;break;}
            }
            if(rejected) break;
        }
        const start = performance.now(), source = await exportBackup(r), exportMs = performance.now() - start;
        const parseStart = performance.now(); await parseBackup(source);
        const parseMs = performance.now() - parseStart;
        const target=await Repository.open(name()), preview=await previewRestore(target,source);
        const restoreStart=performance.now();await restoreBackup(target,preview,async()=>{});const restoreMs=performance.now()-restoreStart;
        const archive=await r.archive(), restored=await target.archive();
        for(const k of ['state','batches','events','operations'] as const) same(archive[k],restored[k]);
        target.close();
        // Upgrade a populated Phase 1B database with one snapshot edit, as in its 5000-row limit.
        const migrationName=name(), legacy=legacyArchive({...initial,batches:archive.batches.slice(0,1),events:archive.events.slice(0,1),operations:archive.operations.slice(0,1),state:patchState(initial.state,archive.batches[0].before,archive.batches[0].after),meta:{...initial.meta,revision:1,headBatch:archive.batches[0].id}});
        await legacyDatabase(migrationName,legacy);
        const migrationStart=performance.now(), upgraded=await Repository.open(migrationName);const migrationMs=performance.now()-migrationStart;
        await parseBackup(await exportBackup(upgraded));upgraded.close();
        const sorted=[...times].sort((a,b)=>a-b), historyBytes=byteSize({batches:archive.batches,events:archive.events,operations:archive.operations});
        rows.push({ recordsPerKind: count, copiesInitially: count * 8, successfulWrites: archive.operations.length, attemptedWrites:times.length, medianMs:Math.round(sorted[Math.floor(sorted.length/2)]),p95Ms:Math.round(sorted[Math.ceil(sorted.length*.95)-1]),historyBytes,historyGrowthBytes:historyBytes-initialHistoryBytes, backupBytes: new TextEncoder().encode(source).length, exportMs: Math.round(exportMs), validateMs: Math.round(parseMs),restoreMs:Math.round(restoreMs),migrationMs:Math.round(migrationMs),transactionOrStorageFailures:rejected?1:0,rejected });
        r.close();
        await new Promise<void>((resolve, reject) => { const q = indexedDB.deleteDatabase(db); q.onsuccess = () => resolve(); q.onerror = () => reject(q.error); });
    }
    return rows;
}
tests.push(['trade reservations: atomic bulk quantities, identity, conflicts, replay, undo and backup',async()=>{
 const r=await seed();const target=await Repository.open(name());
 try {
  check((await command(r,{type:'add-lot',lot:{...stored(),isSealed:true,protectedQty:2}})).ok);
  const snap=await r.readSnapshot(), l=snap.lots[0];
  const guards=[{entity:l.kind,id:l.id,version:l.version},{entity:'revision',id:'collection',version:snap.revision}];
  const body:DomainCommand['body']={type:'set-reservations',lot:{kind:l.kind,id:l.id},protectedQty:l.protectedQty,forTradeQty:6,confirmUnprotect:false};
  const op=await prepareCommand(name(),body,guards);
  const result=await r.execute(op);check(result.ok);
  check((await r.execute(op)).ok);check((await r.archive()).operations.length===4);
  const marked=await r.archive();check(marked.state.lots[0].printingId===printing.id&&marked.state.lots[0].isSealed&&marked.state.lots[0].protectedQty===2);
  check(!(await r.execute(await prepareCommand(name(),{...body,forTradeQty:0},guards))).ok);same(await r.archive(),marked);
  const current=(await r.readSnapshot()).lots[0];
  check(!(await command(r,{...body,forTradeQty:7},guard(current.version))).ok);same(await r.archive(),marked);
  const preview=await previewRestore(target,await exportBackup(r));await restoreBackup(target,preview,async()=>{});
  same((await target.archive()).state,marked.state);
  const undone=await command(r,{type:'undo',batchId:result.ok?result.batchId:''});check(undone.ok);
  check((await r.readSnapshot()).lots[0].forTradeQty===0);
  check(!(await command(r,{type:'undo',batchId:result.ok?result.batchId:''})).ok);
  // Nonsealed allocated copies cannot be offered, and clear/adjust retains allocation/protection.
  const ref={kind:'holding' as const,id:'trade-open'};
  check((await command(r,{type:'add-lot',lot:{...stored(),...ref,protectedQty:2}})).ok);
  check((await command(r,{type:'allocate',allocation:{id:'trade-allocation',lotKind:ref.kind,lotId:ref.id,quantity:3,container:'Fictional deck',containerKind:'deck',deckPlanId:null,notes:''}})).ok);
  for(const quantity of [4,3,1,0]){
   const before=await r.archive(),snap=await r.readSnapshot(),row=snap.lots.find(x=>x.id===ref.id)!;
   const result=await r.execute(await prepareCommand(name(),{type:'set-reservations',lot:ref,protectedQty:2,forTradeQty:quantity,confirmUnprotect:false},[{entity:row.kind,id:row.id,version:row.version},{entity:'revision',id:'collection',version:snap.revision}]));
   check(result.ok===(quantity<=3));if(!result.ok)same(await r.archive(),before);
  }
 }finally{r.close();target.close();}
}]);
tests.push(...archiveTests, ...catalogTests,...artworkTests);
const globals = { artworkBenchmark, canonical, benchmark, tests: tests.map(([title]) => title), run: async (i: number) => { await tests[i][1](); return tests[i][0]; }, seedReload: async () => { const r = await seed('fiction-reload'); await command(r, add(7)); r.close(); }, checkReload: async () => { const r = await Repository.open('fiction-reload'); try {
        check((await r.readSnapshot()).lots[0].quantity === 7);
    }
    finally {
        r.close();
    } }, open: Repository.open, prepareCommand, card, printing, add, exportBackup, previewRestore, restoreBackup };
Object.assign(globalThis, { phase1: globals });
// The suite exports functions for the development-only CDP harness; it is never imported by the app.
