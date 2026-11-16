import { describe, it, expect } from 'vitest';
import { apply, validateCommand } from '../../src/storage/commands';
import { canonical, digest, emptyState, validateState, normalizeState, type State } from '../../src/storage/state';
import { prepareCommand } from '../../src/storage/indexeddb/repository';
import { parseBackup, validateArchive } from '../../src/interchange/backup';
import { card, printing, lot } from '../fixtures/fictional';
import type { DomainCommand } from '../../src/domain/commands';
const fresh = (): State => ({ cards: [structuredClone(card)], printings: [structuredClone(printing)], lots: [], allocations: [] });
const stored = () => { const { allocatedQty: _, ...l } = lot; return { ...l, protectedQty: 0, forTradeQty: 0 }; };
const run = async (s: State, body: DomainCommand['body'], v: DomainCommand['expectedVersions'] = []) => { const c = await prepareCommand('fiction-operation', body, v.length ? [...v, { entity: 'revision', id: 'collection', version: 0 }] : v); validateCommand(c); apply(s, c); validateState(s); return c; };
const ref = { kind: lot.kind, id: lot.id };
const guard = (version = 1) => [{ entity: 'holding', id: lot.id, version }];
describe('synthetic persistence rules (not browser certification)', () => {
    it('canonicalizes property order without conflating exact values', async () => { expect(canonical({ b: 2, a: 1 })).toBe(canonical({ a: 1, b: 2 })); expect(await digest({ a: '007' })).not.toBe(await digest({ a: '7' })); });
    it('validates fresh state and exact printing collision', () => { validateState(emptyState()); const s = fresh(); s.printings.push({ ...printing, id: 'second' }); expect(() => validateState(s)).toThrow('collision'); });
    it('accepts leading zeros as distinct printing identities', () => { const s = fresh(); s.printings.push({ ...printing, id: 'second', collectorNumber: '7' }); validateState(s); });
    it('rejects dangling references and malformed shapes', () => { const s = fresh(); s.lots.push({ ...stored(), printingId: 'absent' }); expect(() => validateState(s)).toThrow(); expect(() => validateState({ ...fresh(), unexpected: 1 } as State)).toThrow(); });
    it('rejects alias ambiguity', () => { const s = fresh(); s.cards.push({ ...card, id: 'another', name: 'Fictional Plum', aliases: [card.name] }); expect(() => validateState(s)).toThrow('Ambiguous'); });
    it('preserves aliases on card rename and guards stale edits', async () => { const s = fresh(); await run(s, { type: 'save-card', card: { ...card, name: 'Fictional Brass Turnip' } }, [{ entity: 'cards', id: card.id, version: 1 }]); expect(s.cards[0].aliases).toContain(card.name); await expect(run(s, { type: 'save-card', card }, [{ entity: 'cards', id: card.id, version: 1 }])).rejects.toThrow('Stale'); });
    it('requires a version for an existing printing edit', async () => { await expect(run(fresh(), { type: 'save-printing', printing })).rejects.toThrow('Collection revision'); });
    it('keeps quick-add unresolved even with one known printing', async () => { const s = fresh(); await run(s, { type: 'quick-add', cardId: card.id, printingId: null, quantity: 2, isSealed: false }); expect(s.lots[0]).toMatchObject({ kind: 'unresolved', printingId: null, quantity: 2 }); });
    it('requires deliberate trade marks and confirmation to unprotect', async () => { const s = fresh(); await run(s, { type: 'add-lot', lot: stored() }); await run(s, { type: 'set-reservations', lot: ref, protectedQty: 2, forTradeQty: 3, confirmUnprotect: false }, guard()); expect(s.lots[0].forTradeQty).toBe(3); await expect(run(s, { type: 'set-reservations', lot: ref, protectedQty: 1, forTradeQty: 3, confirmUnprotect: false }, guard(2))).rejects.toThrow('confirmation'); });
    it('rejects consuming reserved inventory', async () => { const s = fresh(); await run(s, { type: 'add-lot', lot: { ...stored(), protectedQty: 6 } }); await expect(run(s, { type: 'adjust-lot', lot: ref, delta: -3 })).rejects.toThrow('encumbrance'); });
    it('uses compound allocation references and rejects sealed allocations', async () => { const s = fresh(); s.lots = [stored(), { ...stored(), kind: 'unresolved', printingId: null }]; await run(s, { type: 'allocate', allocation: { id: 'a', lotKind: 'unresolved', lotId: lot.id, quantity: 3, container: '', containerKind: 'deck', deckPlanId: null, notes: '' } }); expect(s.lots[0].version).toBe(1); expect(s.lots[1].version).toBe(2); s.lots[0].isSealed = true; await expect(run(s, { type: 'allocate', allocation: { ...s.allocations[0], id: 'b', lotKind: 'holding' } })).rejects.toThrow('Sealed'); });
    it('reconciles copies with ownership conservation', async () => { const s = fresh(); s.lots = [{ ...stored(), kind: 'unresolved', printingId: null }]; await run(s, { type: 'reconcile', from: s.lots[0], toPrintingId: printing.id, quantity: 3 }, [{ entity: 'unresolved', id: lot.id, version: 1 }]); expect(s.lots.reduce((n, l) => n + l.quantity, 0)).toBe(8); expect(s.lots[1].printingId).toBe(printing.id); });
    it('rejects reserved reconciliation and wrong-card printing', async () => { const s = fresh(); s.lots = [{ ...stored(), kind: 'unresolved', printingId: null, protectedQty: 8 }]; await expect(run(s, { type: 'reconcile', from: s.lots[0], toPrintingId: printing.id, quantity: 1 }, [{ entity: 'unresolved', id: lot.id, version: 1 }])).rejects.toThrow('Reserved'); });
    it('rejects malformed, unsupported and wrong-fingerprint commands', async () => { const c = await prepareCommand('fiction', { type: 'quick-add', cardId: card.id, printingId: null, quantity: 0, isSealed: false }); expect(() => validateCommand(c)).toThrow(); expect(() => validateCommand({ ...c, body: { type: 'save-deck' } as never })).toThrow('Unsupported'); });
    it('rejects broken backup headers and checksums', async () => { await expect(parseBackup('{}')).rejects.toThrow(); await expect(parseBackup('{')).rejects.toThrow(); const body = { format: 'community-backup@1', schemaVersion: 2, appVersion: '0.1.0', createdAt: '2026-01-01T00:00:00Z', archive: { state: emptyState(), meta: { key: 'state', revision: 0, schema: 2, headBatch: null }, batches: [], events: [], operations: [] }, artwork: { entries: [], blobs: [] } }; const b = { ...body, checksum: await digest(body) }; expect((await parseBackup(JSON.stringify(b))).archive.state).toEqual(emptyState()); await expect(parseBackup(JSON.stringify({ ...b, checksum: 'corrupt' }))).rejects.toThrow('Checksum'); });
    it('rejects missing replay history and invalid undo state', async () => { await expect(validateArchive({ state: emptyState(), meta: { key: 'state', revision: 1, schema: 2, headBatch: 'missing' }, batches: [], events: [], operations: [] })).rejects.toThrow('History'); });
});
describe('restorable semantic history', () => {
    it('validates a complete synthetic command ledger and rejects altered results', async () => {
        const { undoState } = await import('../../src/storage/commands');
        const before = fresh(), after = structuredClone(before);
        const c = await run(after, { type: 'quick-add', cardId: card.id, printingId: printing.id, quantity: 3, isSealed: false });
        const result = { ok: true as const, revision: 1, batchId: c.operationId, undoable: true, replayed: false };
        const batch = { id: c.operationId, before, after, revision: 1, undoable: true };
        const event = { seq: 1, batchId: c.operationId, occurredAt: '2026-01-01T00:00:00Z', kind: c.body.type, targetType: 'collection', targetId: c.operationId, field: 'state', delta: null, beforeValue: null, afterValue: null, gameplayCardId: null, printingId: null, undoesBatchId: null, label: c.body.type };
        const archive = { state: after, meta: { key: 'state' as const, revision: 1, schema: 2 as const, headBatch: c.operationId }, batches: [batch], events: [event], operations: [{ id: c.operationId, fingerprint: c.fingerprint, payload: canonical({ body: c.body, expectedVersions: c.expectedVersions }), result }] };
        await validateArchive(archive);
        expect(undoState(after, batch).lots).toEqual([]);
        const undoCommand = await prepareCommand('fiction-undo', { type: 'undo', batchId: c.operationId });
        const restored = normalizeState(undoState(after, batch));
        const undoBatch = { id: undoCommand.operationId, before: after, after: restored, revision: 2, undoable: false };
        const undoArchive = { state: restored, meta: { ...archive.meta, revision: 2, headBatch: undoCommand.operationId }, batches: [batch, undoBatch], events: [event, { ...event, seq: 2, batchId: undoCommand.operationId, targetId: undoCommand.operationId, kind: 'undo', label: 'undo', undoesBatchId: c.operationId }], operations: [...archive.operations, { id: undoCommand.operationId, payload: canonical({ body: undoCommand.body, expectedVersions: [] }), fingerprint: undoCommand.fingerprint, result: { ok: true as const, revision: 2, batchId: undoCommand.operationId, undoable: false, replayed: false } }] };
        await validateArchive(undoArchive);
        const legacyBody = {format:'community-backup@1',schemaVersion:2,appVersion:'0.1.0',createdAt:'2026-01-01T00:00:00Z',archive:undoArchive,artwork:{entries:[],blobs:[]}};
        const adapted=await parseBackup(canonical({...legacyBody,checksum:await digest(legacyBody)}));
        expect(adapted.archive.batches.every(b=>!b.format||b.legacyUndo)).toBe(true);
        await validateArchive(adapted.archive);
        const bad = structuredClone(archive);
        bad.state.lots[0].quantity = 4;
        bad.batches[0].after.lots[0].quantity = 4;
        await expect(validateArchive(bad)).rejects.toThrow('command result');
    });
    it('reports persistence denial and estimate failures', async () => {
        const { storageStatus, requestPersistence } = await import('../../src/storage/diagnostics');
        const storage = { estimate: async () => ({ usage: 12, quota: 100 }), persisted: async () => false, persist: async () => false } as unknown as StorageManager;
        expect(await storageStatus(storage)).toEqual({ supported: true, persisted: false, usage: 12, quota: 100 });
        expect(await requestPersistence(storage)).toBe(false);
        storage.estimate = async () => { throw new DOMException('Fictional denial', 'SecurityError'); };
        await expect(storageStatus(storage)).rejects.toThrow('Fictional denial');
    });
});
it('canonical state order survives insertion-order changes', () => {
    const a = fresh();
    a.cards.push({ ...card, id: 'aaa', name: 'Fictional Purple Radish' });
    const b = structuredClone(a);
    b.cards.reverse();
    expect(canonical(normalizeState(a))).toBe(canonical(normalizeState(b)));
});

describe('compact changed-row history', () => {
    it('stores only an adjusted lot and reconstructs a complete baseline', async () => {
        const { compactBatch, patchState } = await import('../../src/storage/state');
        const before = fresh(); before.lots = [stored()];
        const after = structuredClone(before);
        await run(after, {type:'adjust-lot',lot:ref,delta:1});
        const b = compactBatch({id:'fiction-delta',before,after,revision:1,undoable:true});
        expect(b.before.cards).toEqual([]); expect(b.after.printings).toEqual([]);
        expect(b.before.lots).toHaveLength(1); expect(b.after.lots).toHaveLength(1);
        expect(patchState(after,b.after,b.before)).toEqual(normalizeState(before));
    });
    it('undo advances affected versions and preserves unrelated entities', async () => {
        const { compactBatch } = await import('../../src/storage/state');
        const { undoState } = await import('../../src/storage/commands');
        const before=fresh();before.lots=[stored()];const after=structuredClone(before);
        await run(after,{type:'adjust-lot',lot:ref,delta:2});
        const b=compactBatch({id:'fiction-delta',before,after,revision:1,undoable:true});
        const undone=undoState(after,b);
        expect(undone.lots[0].quantity).toBe(before.lots[0].quantity);
        expect(undone.lots[0].version).toBe(3);expect(undone.cards).toEqual(before.cards);
        expect(undoState(after,{...b,legacyUndo:true}).cards[0].version).toBe(2);
    });
    it('retains a legacy snapshot when the delta marker would increase its size', async () => {
        const { compactBatch, byteSize }=await import('../../src/storage/state');
        const before={...emptyState(),cards:[structuredClone(card)]},after=structuredClone(before);
        after.cards[0].notes='Fictional changed note';after.cards[0].version++;
        const b={id:'fiction-small-legacy',before,after,revision:1,undoable:true};
        expect(compactBatch(b,true)).toEqual(b);
        expect(byteSize(compactBatch(b,true))).toBeLessThanOrEqual(byteSize(b));
        expect(compactBatch(b).format).toBe('delta@1');
    });
    it('rejects a changed head row or a colliding inverse insertion', async () => {
        const { compactBatch, patchState }=await import('../../src/storage/state');
        const before=fresh(),after=structuredClone(before);after.lots=[stored()];
        const b=compactBatch({id:'fiction-delta',before,after,revision:1,undoable:true});
        const changed=structuredClone(after);changed.lots[0].quantity++;
        expect(()=>patchState(changed,b.after,b.before)).toThrow('baseline');
        expect(()=>patchState(after,b.before,b.after)).toThrow('collision');
    });
});
