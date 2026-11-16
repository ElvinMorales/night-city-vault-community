import { applyCatalog, validateRelease } from '../catalog/catalog';
import type { DomainCommand } from '../domain/commands';
import type { State } from './state';
import { assert, count, id, validateCard, validatePrinting, validateLot, validateAllocation, lotKey, patchState } from './state';
import type { StoredLot } from '../domain/invariants';
import { deriveLot } from '../domain/invariants';
import { lotAvailable } from '../domain/analysis';
export class Conflict extends Error {
}
export function validateCommand(c: DomainCommand) {
    assert(c && id(c.operationId) && typeof c.fingerprint === 'string' && /^[a-f0-9]{64}$/.test(c.fingerprint));
    assert(Object.keys(c).sort().join(',') === 'body,expectedVersions,fingerprint,operationId');
    assert(Array.isArray(c.expectedVersions) && c.expectedVersions.length <= 100);
    for (const v of c.expectedVersions)
        assert(v && ['cards', 'printings', 'holding', 'unresolved', 'revision'].includes(v.entity) && id(v.id) && count(v.version));
    const b = c.body;
    assert(b && typeof b === 'object');
    const keys: Record<string, string[]> = { 'catalog-release': ['release','choices'], 'save-card': ['card'], 'save-printing': ['printing'], 'add-lot': ['lot'], 'adjust-lot': ['lot', 'delta'], 'set-reservations': ['lot', 'protectedQty', 'forTradeQty', 'confirmUnprotect'], 'quick-add': ['cardId', 'quantity', 'printingId', 'isSealed'], reconcile: ['from', 'toPrintingId', 'quantity'], allocate: ['allocation'], 'remove-allocation': ['allocationId'], undo: ['batchId'] };
    assert(keys[b.type] && Object.keys(b).sort().join(',') === ['type', ...keys[b.type]].sort().join(','), 'Unsupported command or fields');
    switch (b.type) {
        case 'catalog-release':
            validateRelease(b.release);
            assert(b.choices && Array.isArray(b.choices.cards) && Array.isArray(b.choices.printings));
            break;
        case 'save-card':
            validateCard(b.card);
            break;
        case 'save-printing':
            validatePrinting(b.printing);
            break;
        case 'add-lot':
            validateLot(b.lot);
            assert(b.lot.version === 1);
            break;
        case 'adjust-lot':
            assert(Number.isSafeInteger(b.delta) && b.delta !== 0);
            break;
        case 'set-reservations':
            assert(count(b.protectedQty) && count(b.forTradeQty) && typeof b.confirmUnprotect === 'boolean');
            break;
        case 'quick-add':
            assert(id(b.cardId) && count(b.quantity) && b.quantity > 0 && (b.printingId === null || id(b.printingId)) && b.isSealed === false);
            break;
        case 'reconcile':
            assert(id(b.toPrintingId) && count(b.quantity) && b.quantity > 0);
            break;
        case 'allocate':
            validateAllocation(b.allocation);
            break;
        case 'remove-allocation':
            assert(id(b.allocationId));
            break;
        case 'undo':
            assert(id(b.batchId));
            break;
    }
    if ('lot' in b && b.type !== 'add-lot')
        assert(b.lot && ['holding', 'unresolved'].includes(b.lot.kind) && id(b.lot.id));
    if (b.type === 'reconcile')
        assert(b.from && ['holding', 'unresolved'].includes(b.from.kind) && id(b.from.id));
}
export function apply(s: State, c: DomainCommand): void {
    for (const v of c.expectedVersions) {
        if (v.entity === 'revision')
            continue;
        const row = v.entity === 'cards' ? s.cards.find(x => x.id === v.id) : v.entity === 'printings' ? s.printings.find(x => x.id === v.id) : s.lots.find(x => x.kind === v.entity && x.id === v.id);
        if ((row?.version ?? 0) !== v.version)
            throw new Conflict('Stale entity version');
    }
    const guard = (entity: string, row: {
        id: string;
        version: number;
    }) => { if (!c.expectedVersions.some(v => v.entity === 'revision' && v.id === 'collection'))
        throw new Conflict('Collection revision required for an absolute edit'); if (!c.expectedVersions.some(v => v.entity === entity && v.id === row.id && v.version === row.version))
        throw new Conflict('Expected version required'); };
    const getLot = (ref: {
        kind: string;
        id: string;
    }) => { const l = s.lots.find(x => lotKey(x) === lotKey(ref)); assert(l, 'Missing lot'); return l; };
    const newLot = (cardId: string, printingId: string | null, isSealed = false, condition: StoredLot['condition'] = 'unknown') => {
        const l: StoredLot = { kind: printingId ? 'holding' : 'unresolved', id: c.operationId, gameplayCardId: cardId, printingId, label: printingId ? '' : 'Unresolved quick-add', reason: printingId ? null : 'Exact printing not supplied', condition, isSealed, quantity: 0, protectedQty: 0, forTradeQty: 0, location: '', notes: '', version: 1 };
        assert(!s.lots.some(x => lotKey(x) === lotKey(l)), 'Lot ID collision');
        s.lots.push(l);
        return l;
    };
    const b = c.body;
    switch (b.type) {
        case 'catalog-release': {
            assert(c.expectedVersions.some(v=>v.entity==='revision'&&v.id==='collection'),'Catalog review revision required');
            applyCatalog(s,b.release,b.choices);
            break;
        }
        case 'save-card': {
            const i = s.cards.findIndex(x => x.id === b.card.id);
            const row = structuredClone(b.card);
            if (i >= 0) {
                const old = s.cards[i];
                guard('cards', old);
                assert(row.version === old.version, 'Version mismatch');
                row.version++;
                row.aliases = [...new Set([...old.aliases, ...row.aliases, ...(old.name !== row.name ? [old.name] : [])])];
                s.cards[i] = row;
            }
            else {
                assert(row.version === 1);
                s.cards.push(row);
            }
            break;
        }
        case 'save-printing': {
            const i = s.printings.findIndex(x => x.id === b.printing.id);
            const row = structuredClone(b.printing);
            if (i >= 0) {
                const old = s.printings[i];
                guard('printings', old);
                assert(row.version === old.version);
                row.version++;
                s.printings[i] = row;
            }
            else {
                assert(row.version === 1);
                s.printings.push(row);
            }
            break;
        }
        case 'add-lot':
            assert(!s.lots.some(x => lotKey(x) === lotKey(b.lot)), 'Lot already exists');
            s.lots.push(structuredClone(b.lot));
            break;
        case 'quick-add': {
            let l = b.printingId ? s.lots.find(x => x.kind === 'holding' && x.printingId === b.printingId && x.condition === 'unknown' && !x.isSealed) : undefined;
            if (l) {
                assert(l.gameplayCardId === b.cardId);
                l.version++;
            }
            else
                l = newLot(b.cardId, b.printingId);
            l.quantity += b.quantity;
            break;
        }
        case 'adjust-lot': {
            const l = getLot(b.lot);
            l.quantity += b.delta;
            l.version++;
            break;
        }
        case 'set-reservations': {
            const l = getLot(b.lot);
            guard(l.kind, l);
            assert(b.protectedQty >= l.protectedQty || b.confirmUnprotect, 'Unprotect confirmation required');
            l.protectedQty = b.protectedQty;
            l.forTradeQty = b.forTradeQty;
            l.version++;
            break;
        }
        case 'allocate': {
            assert(!s.allocations.some(x => x.id === b.allocation.id), 'Allocation already exists');
            const l = getLot({ kind: b.allocation.lotKind, id: b.allocation.lotId });
            assert(!l.isSealed, 'Sealed copies cannot be allocated');
            s.allocations.push(structuredClone(b.allocation));
            l.version++;
            break;
        }
        case 'remove-allocation': {
            const a = s.allocations.find(x => x.id === b.allocationId);
            assert(a, 'Missing allocation');
            const l = getLot({ kind: a.lotKind, id: a.lotId });
            guard(l.kind, l);
            s.allocations = s.allocations.filter(x => x !== a);
            l.version++;
            break;
        }
        case 'reconcile': {
            const l = getLot(b.from);
            guard(l.kind, l);
            assert(l.kind === 'unresolved', 'Only unresolved copies can be reconciled');
            const p = s.printings.find(x => x.id === b.toPrintingId);
            assert(p && p.gameplayCardId === l.gameplayCardId, 'Printing card mismatch');
            // Reservations remain on their original compound lot; only unencumbered copies move.
            const derived = deriveLot(l, s.allocations);
            const movable = l.isSealed ? l.quantity - l.protectedQty - l.forTradeQty : lotAvailable(derived);
            assert(b.quantity <= movable, 'Reserved inventory cannot move');
            l.quantity -= b.quantity;
            l.version++;
            const dest = newLot(l.gameplayCardId, p.id, l.isSealed, l.condition);
            dest.quantity = b.quantity;
            dest.location = l.location;
            dest.notes = l.notes;
            break;
        }
        default: throw new Error('Command not implemented in Phase 1');
    }
}
/** Conservative compensating undo: only an unchanged head batch is supported. */
export function undoState(current: State, batch: import('./state').Batch): State {
    assert(batch.undoable, 'Batch does not support undo');
    const restored = batch.format === 'delta@1' ? patchState(current, batch.after, batch.before) : structuredClone(batch.before);
    for (const key of ['cards', 'printings', 'lots'] as const)
        for (const row of restored[key]) {
            if (batch.format === 'delta@1' && !batch.legacyUndo && !batch.before[key].some(x => lotKeyForUndo(key, x) === lotKeyForUndo(key, row))) continue;
            const previous = current[key].find(x => key === 'lots' ? ('kind' in x && 'kind' in row && lotKey(x as StoredLot) === lotKey(row as StoredLot)) : x.id === row.id);
            row.version = Math.max(row.version, previous?.version ?? 0) + 1;
        }
    return restored;
}

function lotKeyForUndo(key: string, row: {id:string}): string { return key === 'lots' ? lotKey(row as StoredLot) : row.id; }
