import { assert, canonical, count, digest, id, validateState, normalizeState, MAX_ARCHIVE_BYTES, patchState, compactBatch, primaryStores, recordKey, type Archive } from '../storage/state';
import { validateCommand, apply, undoState } from '../storage/commands';
import type { DomainCommand } from '../domain/commands';
import type { IndexedDBRepository } from '../storage/indexeddb/repository';
export const MAX_BACKUP_BYTES = 16 * 1024 * 1024;
export interface Backup {
    format: 'community-backup@1' | 'community-backup@2';
    schemaVersion: 2 | 3;
    appVersion: '0.1.0';
    createdAt: string;
    archive: Archive;
    artwork: {
        entries: never[];
        blobs: never[];
    };
    checksum: string;
}
const exact = (x: unknown, keys: string[]) => { assert(x && typeof x === 'object' && !Array.isArray(x)); assert(Object.keys(x).sort().join(',') === keys.sort().join(','), 'Unknown or missing fields'); };
/** Validate current state AND the history that guarded undo and replay depend on. */
export async function validateArchive(a: Archive) {
    assert(new TextEncoder().encode(canonical(a)).length <= MAX_ARCHIVE_BYTES, 'Archive size limit exceeded');
    exact(a, ['state', 'meta', 'batches', 'events', 'operations']);
    validateState(a.state);
    exact(a.meta, ['key', 'revision', 'schema', 'headBatch']);
    assert(a.meta.key === 'state' && a.meta.schema === 2 && count(a.meta.revision) && (a.meta.headBatch === null || id(a.meta.headBatch)));
    for (const rows of [a.batches, a.events, a.operations])
        assert(Array.isArray(rows) && rows.length <= 50000, 'History limit exceeded');
    assert(a.batches.length === a.events.length && a.events.length === a.operations.length, 'Incomplete history');
    const batches = new Map(a.batches.map(b => [b.id, b])), events = new Map(a.events.map(e => [e.batchId, e]));
    assert(batches.size === a.batches.length && events.size === a.events.length && new Set(a.events.map(e => e.seq)).size === a.events.length && new Set(a.operations.map(o => o.id)).size === a.operations.length, 'Duplicate history');
    for (const b of a.batches) {
        exact(b, ['id', 'before', 'after', 'revision', 'undoable', ...(b.format === 'delta@1' ? ['format'] : []), ...(b.legacyUndo === true && b.format ? ['legacyUndo'] : [])]);
        assert(id(b.id) && count(b.revision) && b.revision > 0 && b.revision <= a.meta.revision && typeof b.undoable === 'boolean');
        if (!b.format) { validateState(b.before); validateState(b.after); }
        else {
            for (const image of [b.before, b.after]) {
                exact(image, ['cards', 'printings', 'lots', 'allocations']);
                for (const rows of Object.values(image)) assert(Array.isArray(rows) && rows.length <= 50000);
            }
        }
        const e = events.get(b.id);
        assert(e && e.seq === b.revision, 'Missing batch event');
    }
    for (const e of a.events) {
        exact(e, ['seq', 'batchId', 'occurredAt', 'kind', 'targetType', 'targetId', 'field', 'delta', 'beforeValue', 'afterValue', 'gameplayCardId', 'printingId', 'undoesBatchId', 'label']);
        assert(typeof e.occurredAt === 'string' && e.occurredAt.length <= 100 && Number.isFinite(Date.parse(e.occurredAt)) && e.targetType === 'collection' && e.targetId === e.batchId && e.field === 'state' && e.delta === null && e.beforeValue === null && e.afterValue === null && e.gameplayCardId === null && e.printingId === null && e.label === e.kind);
        assert(e.undoesBatchId === null || batches.has(e.undoesBatchId), 'Missing undo target');
    }
    const catalogVersions=new Map<string,string>();
    for (const o of a.operations) {
        exact(o, ['id', 'fingerprint', 'payload', 'result']);
        assert(id(o.id) && typeof o.payload === 'string');
        const p = JSON.parse(o.payload) as Pick<DomainCommand, 'body' | 'expectedVersions'>;
        exact(p, ['body', 'expectedVersions']);
        validateCommand({ operationId: o.id, fingerprint: o.fingerprint, ...p });
        if(p.body.type==='catalog-release'){const r=p.body.release,encoded=canonical(r);assert(!catalogVersions.has(r.version)||catalogVersions.get(r.version)===encoded,'Catalog version reused with different content');catalogVersions.set(r.version,encoded);}

        assert(canonical(p) === o.payload && await digest(p) === o.fingerprint, 'Invalid replay payload');
        const b = batches.get(o.id), e = events.get(o.id);
        assert(b && e && e.kind === p.body.type && e.undoesBatchId === (p.body.type === 'undo' ? p.body.batchId : null));
        exact(o.result, ['ok', 'revision', 'batchId', 'undoable', 'replayed']);
        assert(o.result.ok === true && o.result.revision === b.revision && o.result.batchId === b.id && o.result.undoable === b.undoable && o.result.replayed === false && b.undoable === (p.body.type !== 'undo'), 'Invalid replay result');
    }
    // Replay each validated command against its recorded baseline. Checksums alone
    // cannot establish that an acquisition or compensating undo has valid semantics.
    let current = structuredClone(a.state);
    const ordered = [...a.batches].sort((x, y) => x.revision - y.revision);
    const operations = new Map(a.operations.map(o => [o.id, o]));
    for (let index = ordered.length - 1; index >= 0; index--) {
        const recorded = ordered[index];
        const o = operations.get(recorded.id)!;
        const p = JSON.parse(o.payload) as Pick<DomainCommand, 'body' | 'expectedVersions'>;
        const b = batches.get(o.id)!;
        for (const v of p.expectedVersions)
            if (v.entity === 'revision')
                assert(v.id === 'collection' && v.version === b.revision - 1, 'Invalid revision guard');
        const baseline = b.format ? patchState(current, b.after, b.before) : structuredClone(b.before);
        if (!b.format) assert(canonical(current) === canonical(b.after), 'Broken history chain');
        validateState(baseline);
        let simulated = structuredClone(baseline);
        if (p.body.type === 'undo') {
            const target = batches.get(p.body.batchId);
            const prior = a.batches.filter(x => x.revision < b.revision).sort((x, y) => y.revision - x.revision)[0];
            assert(target && prior?.id === target.id && target.undoable && (!target.format ? canonical(target.after) === canonical(baseline) : true), 'Invalid undo baseline');
            simulated = undoState(simulated, target);
        }
        else
            apply(simulated, { operationId: o.id, fingerprint: o.fingerprint, ...p });
        // current was validated on entry or as the preceding reconstructed baseline.
        assert(canonical(normalizeState(simulated)) === canonical(current), 'History command result mismatch');
        if (b.format) {
            for (const k of primaryStores) {
                for (const image of [b.before, b.after]) {
                    const keys = image[k].map(r => recordKey(k, r));
                    assert(keys.every((key, i) => i === 0 || keys[i - 1] < key), 'Unsorted or duplicate delta');
                }
                const before = new Map(b.before[k].map(r => [recordKey(k,r),r]));
                for (const row of b.after[k]) assert(canonical(row) !== canonical(before.get(recordKey(k,row)) ?? null), 'Nonminimal delta');
            }
        }
        current = baseline;
    }
    const head = ordered.at(-1);
    assert((head?.id ?? null) === a.meta.headBatch, 'History does not describe current state');
}
export async function exportBackup(repo: IndexedDBRepository, includeMedia = false): Promise<string> {
    const archive = await repo.archive(includeMedia);
    await validateArchive(archive);
    const body = { format: 'community-backup@2' as const, schemaVersion: 3 as const, appVersion: '0.1.0' as const, createdAt: new Date().toISOString(), archive, artwork: { entries: [], blobs: [] } as Backup['artwork'] };
    const result = canonical({ ...body, checksum: await digest(body) });
    assert(new TextEncoder().encode(result).length <= MAX_BACKUP_BYTES, 'Backup exceeds supported limit');
    return result;
}
export async function parseBackup(source: string): Promise<Backup> {
    assert(typeof source === 'string' && source.length <= MAX_BACKUP_BYTES && new TextEncoder().encode(source).length <= MAX_BACKUP_BYTES, 'Backup size exceeded');
    const b = JSON.parse(source) as Backup;
    exact(b, ['format', 'schemaVersion', 'appVersion', 'createdAt', 'archive', 'artwork', 'checksum']);
    assert(((b.format === 'community-backup@1' && b.schemaVersion === 2) || (b.format === 'community-backup@2' && b.schemaVersion === 3)) && b.appVersion === '0.1.0' && typeof b.createdAt === 'string' && b.createdAt.length <= 100 && Number.isFinite(Date.parse(b.createdAt)), 'Unsupported backup');
    exact(b.artwork, ['entries', 'blobs']);
    assert(Array.isArray(b.artwork.entries) && !b.artwork.entries.length && Array.isArray(b.artwork.blobs) && !b.artwork.blobs.length, 'Artwork payloads require a later version');
    const { checksum, ...body } = b;
    assert(checksum === await digest(body), 'Checksum mismatch');
    if (b.format === 'community-backup@1') assert(b.archive.batches.every(x => x.format === undefined), 'Legacy backup cannot contain delta history');
    await validateArchive(b.archive);
    if (b.format === 'community-backup@1') b.archive.batches = b.archive.batches.map(x => compactBatch(x, true));
    return b;
}
export interface RestorePreview {
    source: string;
    checksum: string;
    expectedRevision: number;
    copies: number;
    cards: number;
}
export async function previewRestore(repo: IndexedDBRepository, source: string): Promise<RestorePreview> {
    const b = await parseBackup(source), snapshot = await repo.readSnapshot();
    return { source, checksum: b.checksum, expectedRevision: snapshot.revision, copies: b.archive.state.lots.reduce((n, l) => n + l.quantity, 0), cards: b.archive.state.cards.length };
}
/** saveRecovery must successfully retain/download the complete pre-replacement backup. */
export async function restoreBackup(repo: IndexedDBRepository, preview: RestorePreview, saveRecovery: (backup: string) => Promise<void>): Promise<void> {
    const b = await parseBackup(preview.source);
    assert(b.checksum === preview.checksum, 'Preview changed');
    const recovery = await exportBackup(repo);
    assert(JSON.parse(recovery).archive.meta.revision === preview.expectedRevision, 'Collection changed since preview');
    await saveRecovery(recovery);
    await repo.replace(b.archive, preview.expectedRevision);
}
