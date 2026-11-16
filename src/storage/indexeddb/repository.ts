import {readMedia, validateMedia, type Media, type PersonalArtwork, type MediaBlob} from '../../artwork/media';
import { validateArchive } from '../../interchange/backup';
import type { CollectionRepository } from '../repository';
import { STORES } from '../repository';
import type { CommandResult, DomainCommand } from '../../domain/commands';
import type { EventRow, Snapshot } from '../../domain/types';
import { deriveLot } from '../../domain/invariants';
import { normalizeName } from '../../domain/analysis';
import { printingIdentity } from '../../domain/printingIdentity';
import { apply, Conflict, validateCommand, undoState } from '../commands';
import { assert, canonical, digest, validateState, MAX_ARCHIVE_BYTES, normalizeState, compactBatch, patchState, byteSize, recordKey, type Archive, type State, type Metadata, type Batch, type Operation } from '../state';
import { openDatabase, request, completion } from './database';
const primary = ['cards', 'printings', 'lots', 'allocations'] as const;
async function readState(tx: IDBTransaction): Promise<State> {
    const values = await Promise.all(primary.map(k => request(tx.objectStore(k).getAll())));
    const s = Object.fromEntries(primary.map((k, i) => [k, values[i]])) as unknown as State;
    // Storage-only unique index key is not a domain field.
    s.printings = s.printings.map(p => {
        const { identity: _, ...row } = p as typeof p & {
            identity?: string;
        };
        return row;
    });
    return normalizeState(s);
}
function writeState(tx: IDBTransaction, s: State) {
    for (const k of primary) {
        const store = tx.objectStore(k);
        store.clear();
        for (const row of s[k])
            store.put(k === 'printings' ? { ...row, identity: printingIdentity(row as State['printings'][number]) } : row);
    }
    const aliases = tx.objectStore('aliases');
    aliases.clear();
    for (const c of s.cards)
        for (const name of [c.name, ...c.aliases]) {
            const normalized = normalizeName(name);
            aliases.put({ id: canonical([c.id, normalized]), cardId: c.id, normalized });
        }
}
/** Routine mutations never clear a store or rewrite an unchanged row. */
function writeChanges(tx: IDBTransaction, before: State, after: State) {
    for (const k of primary) {
        const old = new Map(before[k].map(r => [recordKey(k, r), r]));
        const next = new Map(after[k].map(r => [recordKey(k, r), r]));
        for (const [key, row] of old) if (!next.has(key)) tx.objectStore(k).delete(k === 'lots' ? [(row as State['lots'][number]).kind, row.id] : row.id);
        for (const [key, row] of next) if (canonical(row) !== canonical(old.get(key) ?? null))
            tx.objectStore(k).put(k === 'printings' ? { ...row, identity: printingIdentity(row as State['printings'][number]) } : row);
    }
    const projectAliases = (cards: State['cards']) => {
        const rows = new Map<string, {id:string;cardId:string;normalized:string}>();
        for (const card of cards) for (const name of [card.name, ...card.aliases]) {
            const normalized = normalizeName(name), id = canonical([card.id, normalized]);
            rows.set(id, {id,cardId:card.id,normalized});
        }
        return rows;
    };
    const oldAliases = projectAliases(before.cards), nextAliases = projectAliases(after.cards);
    for (const key of oldAliases.keys()) if (!nextAliases.has(key)) tx.objectStore('aliases').delete(key);
    for (const [key, row] of nextAliases) if (!oldAliases.has(key)) tx.objectStore('aliases').put(row);
}
export async function prepareCommand(operationId: string, body: DomainCommand['body'], expectedVersions: DomainCommand['expectedVersions'] = []): Promise<DomainCommand> {
    const payload = structuredClone({ body, expectedVersions });
    return { operationId, ...payload, fingerprint: await digest(payload) };
}
export class IndexedDBRepository implements CollectionRepository {
    private listeners = new Set<(revision: number) => void>();
    private channel: BroadcastChannel | null;
    private focus = () => { void this.readSnapshot().then(s => this.notify(s.revision)).catch(() => { }); };
    private constructor(private db: IDBDatabase) {
        this.channel = null;
        try {
            if (typeof BroadcastChannel !== 'undefined')
                this.channel = new BroadcastChannel(`community-revision:${db.name}`);
        }
        catch { /* focus refresh remains available */ }
        if (this.channel)
            this.channel.onmessage = e => {
                if (Number.isSafeInteger(e.data))
                    this.notify(e.data);
            };
        globalThis.addEventListener?.('focus', this.focus);
    }
    static async open(name?: string) { return new IndexedDBRepository(await openDatabase(name)); }
    private notify(revision: number) {
        for (const fn of this.listeners) {
            try {
                fn(revision);
            }
            catch { /* observers cannot change commit results */ }
        }
    }
    private committed(revision: number) {
        this.notify(revision);
        try {
            this.channel?.postMessage(revision);
        }
        catch { /* database commit remains authoritative */ }
    }
    subscribeCommittedRevision(listener: (revision: number) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
    close() { this.channel?.close(); globalThis.removeEventListener?.('focus', this.focus); this.db.close(); }
    async readSnapshot(): Promise<Snapshot> {
        const tx = this.db.transaction([...primary, 'meta'], 'readonly'), done = completion(tx);
        const [s, meta] = await Promise.all([readState(tx), request(tx.objectStore('meta').get('state')) as Promise<Metadata>, done]);
        return { ...s, lots: s.lots.map(l => deriveLot(l, s.allocations)), revision: meta.revision, generatedAt: new Date().toISOString(), quoteStaleDays: 30, quotes: [], decks: [], trades: [] };
    }
    async readCatalogReleases():Promise<import('../../catalog/catalog').CatalogRelease[]>{
        const tx=this.db.transaction('operations'),done=completion(tx);
        const [rows]=await Promise.all([request(tx.objectStore('operations').getAll()) as Promise<Operation[]>,done]);
        const releases=new Map<string,import('../../catalog/catalog').CatalogRelease>();
        for(const row of rows){const body=JSON.parse(row.payload).body;if(body.type==='catalog-release')releases.set(body.release.version,body.release);}
        return [...releases.values()];
    }
    async readActivityCommands(batchIds:string[]):Promise<Record<string,DomainCommand['body']>> {
        const tx=this.db.transaction('operations'), done=completion(tx);
        const [rows]=await Promise.all([Promise.all(batchIds.slice(-20).map(id=>request(tx.objectStore('operations').get(id)) as Promise<Operation|undefined>)),done]);
        return Object.fromEntries(rows.filter((row):row is Operation=>!!row).map(row=>[row.id,JSON.parse(row.payload).body]));
    }
    async readEvents(afterSequence: number): Promise<EventRow[]> { const tx = this.db.transaction('events'), done = completion(tx); const [rows] = await Promise.all([request(tx.objectStore('events').getAll(IDBKeyRange.lowerBound(afterSequence, true))), done]); return rows; }
    async archive(includeMedia = false): Promise<Archive> {
        const tx = this.db.transaction([...STORES], 'readonly'), done = completion(tx);
        const [state, meta, batches, events, operations, reserved] = await Promise.all([readState(tx), request(tx.objectStore('meta').get('state')), request(tx.objectStore('batches').getAll()), request(tx.objectStore('events').getAll()), request(tx.objectStore('operations').getAll()), Promise.all(STORES.filter(k => !['meta', ...primary, 'aliases', 'batches', 'events', 'operations', ...(includeMedia ? ['artworkEntries','blobs'] : [])].includes(k)).map(k => request(tx.objectStore(k).count()))), done]);
        // Future stores must never be silently omitted from a Phase 1 backup.
        assert(reserved.every(n => n === 0), 'Unsupported future records: export requires a newer adapter');
        return { state, meta, batches, events, operations };
    }
    async media() { return readMedia(this.db); }
    async artworkEntries():Promise<PersonalArtwork[]> {const tx=this.db.transaction('artworkEntries'),done=completion(tx);const [rows]=await Promise.all([request(tx.objectStore('artworkEntries').getAll()),done]);return rows;}
    async blobIds():Promise<string[]> {const tx=this.db.transaction('blobs'),done=completion(tx);const [keys]=await Promise.all([request(tx.objectStore('blobs').getAllKeys()),done]);return keys.map(String);}
    async imageBlob(id:string):Promise<Blob|undefined> {const tx=this.db.transaction('blobs'),done=completion(tx);const [row]=await Promise.all([request(tx.objectStore('blobs').get(id)),done]);return row?.blob;}
    async changeArtwork(entry:PersonalArtwork|null, blobs:MediaBlob[], removeId:string|undefined, expectedRevision:number) {
        const snapshot=await this.readSnapshot();
        if(entry)await validateMedia({entries:[entry],blobs},snapshot.cards,snapshot.printings);
        const tx=this.db.transaction(['meta','artworkEntries','blobs'],'readwrite'),done=completion(tx);void done.catch(()=>{});
        try {
            const meta=await request(tx.objectStore('meta').get('state')) as Metadata;
            assert(meta.revision===expectedRevision,'Collection changed; reopen artwork management');
            if(removeId)tx.objectStore('artworkEntries').delete(removeId);
            if(entry){tx.objectStore('artworkEntries').put(entry);for(const b of blobs)tx.objectStore('blobs').put(b);}
            const entries=await request(tx.objectStore('artworkEntries').getAll()) as PersonalArtwork[];
            assert(entries.length<=5000,'Artwork association limit exceeded (5000)');
            const referenced=new Set(entries.flatMap(e=>[e.imageBlob,e.thumbnailBlob]));
            const keys=await request(tx.objectStore('blobs').getAllKeys());for(const key of keys)if(!referenced.has(String(key)))tx.objectStore('blobs').delete(key);
            const storedBlobs=await request(tx.objectStore('blobs').getAll()) as MediaBlob[];
            assert(storedBlobs.length<=10000&&storedBlobs.filter(b=>referenced.has(b.id)).reduce((n,b)=>n+b.blob.size,0)<=256*1024*1024,'Artwork storage limit exceeded (256 MiB)');
            const revision=meta.revision+1;tx.objectStore('meta').put({...meta,revision});
            tx.objectStore('meta').delete('archiveBytes');
            await done;this.committed(revision);
        }catch(e){try{tx.abort();}catch{}await done.catch(()=>{});throw new Error(e instanceof DOMException&&e.name==='QuotaExceededError'?'Browser storage quota exceeded. Image was not saved.':String(e));}
    }
    async execute(input: DomainCommand): Promise<CommandResult> {
        let c: DomainCommand;
        try {
            c = structuredClone(input);
            validateCommand(c);
            assert(c.fingerprint === await digest({ body: c.body, expectedVersions: c.expectedVersions }), 'Fingerprint does not match payload');
        }
        catch (e) {
            return { ok: false, code: 'validation', message: String(e) };
        }
        const payload = canonical({ body: c.body, expectedVersions: c.expectedVersions });
        let tx: IDBTransaction | undefined, done: Promise<void> | undefined;
        try {
            tx = this.db.transaction([...STORES], 'readwrite');
            done = completion(tx);
            void done.catch(() => { });
            const [s, meta, old] = await Promise.all([readState(tx), request(tx.objectStore('meta').get('state')) as Promise<Metadata>, request(tx.objectStore('operations').get(c.operationId)) as Promise<Operation | undefined>]);
            if (old) {
                if (old.fingerprint !== c.fingerprint || old.payload !== payload) {
                    await done;
                    return { ok: false, code: 'replay-mismatch', message: 'Operation ID already used for a different payload' };
                }
                await done;
                return { ...old.result, replayed: true };
            }
            for (const v of c.expectedVersions)
                if (v.entity === 'revision' && (v.id !== 'collection' || v.version !== meta.revision))
                    throw new Conflict('Stale collection revision');
            if(c.body.type==='catalog-release'){
                const incoming=c.body.release;
                const prior=await request(tx.objectStore('operations').getAll()) as Operation[];
                for(const operation of prior){const body=JSON.parse(operation.payload).body;if(body.type==='catalog-release'&&body.release.version===incoming.version)assert(canonical(body.release)===canonical(incoming),'Catalog version reused with different content');}
            }
            validateState(s);
            const before = structuredClone(s);
            if (c.body.type === 'undo') {
                const b = await request(tx.objectStore('batches').get(c.body.batchId)) as Batch | undefined;
                if (!b?.undoable || meta.headBatch !== b.id || (!b.format && canonical(s) !== canonical(b.after))) {
                    await done;
                    return { ok: false, code: 'unsupported-undo', message: 'Only the unchanged latest undoable batch can be undone' };
                }
                if (b.format) {
                    try { patchState(s, b.after, b.before); }
                    catch { await done; return { ok: false, code: 'unsupported-undo', message: 'Head records changed since batch' }; }
                }
                Object.assign(s, undoState(s, b));
            }
            else
                apply(s, c);
            normalizeState(s);
            validateState(s);
            assert(Number.isSafeInteger(meta.revision + 1), 'Revision exhausted');
            const revision = meta.revision + 1, batchId = c.operationId;
            const result = { ok: true as const, revision, batchId, undoable: c.body.type !== 'undo', replayed: false };
            const batch: Batch = compactBatch({ id: batchId, before, after: s, revision, undoable: result.undoable });
            const event: EventRow = { seq: revision, batchId, occurredAt: new Date().toISOString(), kind: c.body.type, targetType: 'collection', targetId: batchId, field: 'state', delta: null, beforeValue: null, afterValue: null, gameplayCardId: null, printingId: null, undoesBatchId: c.body.type === 'undo' ? c.body.batchId : null, label: c.body.type };
            let usage = await request(tx.objectStore('meta').get('archiveBytes')) as {key: string; bytes: number; historyCount: number} | undefined;
            if (!usage) {
                const [batches, events, operations] = await Promise.all(['batches', 'events', 'operations'].map(k => request(tx!.objectStore(k).getAll())));
                usage = { key: 'archiveBytes', bytes: byteSize({ state: before, meta, batches, events, operations }), historyCount: batches.length };
            }
            const operation = { id: c.operationId, fingerprint: c.fingerprint, payload, result };
            const stateGrowth = primary.reduce((n, k) => n
                + batch.after[k].reduce((sum, row) => sum + byteSize(row), 0)
                - batch.before[k].reduce((sum, row) => sum + byteSize(row), 0)
                + Math.max(0, s[k].length - 1) - Math.max(0, before[k].length - 1), 0);
            const bytes = usage.bytes + stateGrowth
                + byteSize({ ...meta, revision, headBatch: batchId }) - byteSize(meta)
                + byteSize(batch) + byteSize(event) + byteSize(operation) + (usage.historyCount ? 3 : 0);
            assert(usage.historyCount < 50000, 'History limit reached; no changes committed');
            assert(bytes <= MAX_ARCHIVE_BYTES, 'Restorable collection size limit reached; no changes committed');
            writeChanges(tx, batch.before, batch.after);
            tx.objectStore('meta').put({ key: 'archiveBytes', bytes, historyCount: usage.historyCount + 1 });
            tx.objectStore('meta').put({ ...meta, revision, headBatch: batchId });
            tx.objectStore('batches').add(batch);
            tx.objectStore('events').add(event);
            tx.objectStore('operations').add({ id: c.operationId, fingerprint: c.fingerprint, payload, result });
            await done;
            this.committed(revision);
            return result;
        }
        catch (e) {
            try {
                tx?.abort();
            }
            catch { }
            if (done)
                await done.catch(() => { });
            return { ok: false, code: e instanceof Conflict ? 'conflict' : e instanceof DOMException ? 'storage' : 'validation', message: String(e) };
        }
    }
    /** Caller must retain the returned pre-replacement backup from the interchange layer. */
    async replace(archive: Archive, expectedRevision: number, media:Media={entries:[],blobs:[]}): Promise<void> {
        await validateArchive(archive);
        await validateMedia(media,archive.state.cards,archive.state.printings);
        const tx = this.db.transaction([...STORES], 'readwrite'), done = completion(tx);
        void done.catch(() => { });
        try {
            const meta = await request(tx.objectStore('meta').get('state')) as Metadata;
            if (meta.revision !== expectedRevision)
                throw new Conflict('Collection changed since restore preview');
            const revision = Math.max(meta.revision, archive.meta.revision) + 1;
            assert(Number.isSafeInteger(revision));
            const bytes = byteSize({ ...archive, meta: { ...archive.meta, revision } });
            assert(bytes <= MAX_ARCHIVE_BYTES, 'Restored archive size limit exceeded');
            for (const store of STORES)
                tx.objectStore(store).clear();
            writeState(tx, archive.state);
            for(const e of media.entries)tx.objectStore('artworkEntries').put(e);
            for(const b of media.blobs)tx.objectStore('blobs').put(b);
            tx.objectStore('meta').put({ ...archive.meta, revision });
            tx.objectStore('meta').put({ key: 'archiveBytes', bytes, historyCount: archive.batches.length });
            for (const [store, rows] of [['batches', archive.batches], ['events', archive.events], ['operations', archive.operations]] as const)
                for (const row of rows)
                    tx.objectStore(store).add(row);
            await done;
            this.committed(revision);
        }
        catch (e) {
            try {
                tx.abort();
            }
            catch { }
            await done.catch(() => { });
            throw e;
        }
    }
}
