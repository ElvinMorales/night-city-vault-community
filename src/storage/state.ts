import type { Card, Printing, Allocation, EventRow } from '../domain/types';
import { CONDITIONS } from '../domain/types';
import { deriveLot, type StoredLot } from '../domain/invariants';
import { printingIdentity } from '../domain/printingIdentity';
import { normalizeName } from '../domain/analysis';
export const MAX_ARCHIVE_BYTES = 16 * 1024 * 1024 - 4096;
export interface State {
    cards: Card[];
    printings: Printing[];
    lots: StoredLot[];
    allocations: Allocation[];
}
export interface Batch {
    format?: 'delta@1';
    legacyUndo?: true;
    id: string;
    before: State;
    after: State;
    revision: number;
    undoable: boolean;
}
export interface Operation {
    id: string;
    fingerprint: string;
    payload: string;
    result: {
        ok: true;
        revision: number;
        batchId: string;
        undoable: boolean;
        replayed: boolean;
    };
}
export interface Metadata {
    key: 'state';
    revision: number;
    schema: 2;
    headBatch: string | null;
}
export interface Archive {
    state: State;
    meta: Metadata;
    batches: Batch[];
    events: EventRow[];
    operations: Operation[];
}
export const emptyState = (): State => ({ cards: [], printings: [], lots: [], allocations: [] });
export function canonical(value: unknown): string {
    if (value === null || typeof value !== 'object') {
        const s = JSON.stringify(value);
        if (s === undefined)
            throw new Error('Non-JSON input');
        return s;
    }
    if (Array.isArray(value))
        return `[${value.map(canonical).join(',')}]`;
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
}
export async function digest(value: unknown): Promise<string> {
    const bytes = new TextEncoder().encode(canonical(value));
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
}
export function assert(test: unknown, message = 'Invalid input'): asserts test {
    if (!test)
        throw new Error(message);
}
export const count = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0;
export const text = (s: unknown): s is string => typeof s === 'string' && s.length <= 10000;
export const id = (s: unknown): s is string => text(s) && s.length > 0 && s.length <= 200;
function shape(value: unknown, fields: Record<string, (v: unknown) => boolean>) {
    assert(value && typeof value === 'object' && !Array.isArray(value));
    const r = value as Record<string, unknown>;
    assert(Object.keys(r).length === Object.keys(fields).length && Object.entries(fields).every(([k, check]) => check(r[k])), 'Invalid record shape');
}
const nullableText = (x: unknown) => x === null || text(x);
const version = (x: unknown) => count(x) && (x as number) > 0;
export function validateCard(c: Card) {
    shape(c, { id, name: x => id(x) && !!x.trim(), playsetClass: x => ['legend', 'standard', 'unknown'].includes(x as string), typeLabel: nullableText, classificationSource: nullableText, colors: nullableText, keepTarget: x => x === null || count(x), artMediaId: nullableText, needsReview: nullableText, notes: text, aliases: x => Array.isArray(x) && x.length <= 100 && x.every(id), version });
    assert(new Set(c.aliases.map(normalizeName)).size === c.aliases.length, 'Duplicate aliases');
}
export function validatePrinting(p: Printing) {
    shape(p, { id, gameplayCardId: id, setCode: id, setName: id, collectorNumber: nullableText, language: id, rarity: nullableText, treatment: id, isPromo: x => typeof x === 'boolean', collectorOnly: x => typeof x === 'boolean', source: text, sourceText: nullableText, artMediaId: nullableText, notes: text, providerMaps: x => Array.isArray(x) && x.length <= 100, version });
    for (const m of p.providerMaps)
        shape(m, { id, provider: id, externalId: id, externalSub: text, externalUrl: nullableText, verifiedBy: text, verifiedAt: text });
}
export function validateLot(l: StoredLot) {
    shape(l, { id, kind: x => x === 'holding' || x === 'unresolved', gameplayCardId: id, printingId: x => x === null || id(x), label: text, reason: nullableText, condition: x => CONDITIONS.includes(x as never), isSealed: x => typeof x === 'boolean', quantity: count, protectedQty: count, forTradeQty: count, location: text, notes: text, version });
    assert(l.kind === 'holding' ? id(l.printingId) : l.printingId === null, 'Printing certainty mismatch');
    deriveLot(l, []);
}
export function validateAllocation(a: Allocation) {
    shape(a, { id, lotKind: x => x === 'holding' || x === 'unresolved', lotId: id, container: text, containerKind: x => ['deck', 'binder', 'box', 'other'].includes(x as string), deckPlanId: x => x === null || id(x), quantity: x => count(x) && (x as number) > 0, notes: text });
}
export const lotKey = (l: {
    kind: string;
    id: string;
}) => canonical([l.kind, l.id]);
export function validateState(s: State) {
    shape(s, { cards: Array.isArray, printings: Array.isArray, lots: Array.isArray, allocations: Array.isArray });
    const unique = <T>(rows: T[], key: (x: T) => string) => { assert(rows.length <= 50000, 'Too many records'); assert(new Set(rows.map(key)).size === rows.length, 'Duplicate key'); };
    unique(s.cards, x => x.id);
    unique(s.printings, x => x.id);
    unique(s.lots, lotKey);
    unique(s.allocations, x => x.id);
    s.cards.forEach(validateCard);
    s.printings.forEach(validatePrinting);
    s.lots.forEach(validateLot);
    s.allocations.forEach(validateAllocation);
    const cards = new Set(s.cards.map(c => c.id));
    const names = new Map<string, string>();
    for (const c of s.cards)
        for (const name of [c.name, ...c.aliases]) {
            const n = normalizeName(name);
            assert(n && (!names.has(n) || names.get(n) === c.id), 'Ambiguous name or alias');
            names.set(n, c.id);
        }
    assert(new Set(s.printings.map(printingIdentity)).size === s.printings.length, 'Printing identity collision');
    for (const p of s.printings)
        assert(cards.has(p.gameplayCardId), 'Missing printing card');
    const printings = new Map(s.printings.map(p => [p.id, p]));
    const lots = new Set(s.lots.map(lotKey));
    const allocations = new Map<string, Allocation[]>();
    for (const a of s.allocations) {
        const key = lotKey({kind:a.lotKind,id:a.lotId});
        const rows = allocations.get(key) ?? []; rows.push(a); allocations.set(key, rows);
    }
    for (const l of s.lots) {
        assert(cards.has(l.gameplayCardId), 'Missing lot card');
        if (l.printingId !== null)
            assert(printings.get(l.printingId)?.gameplayCardId === l.gameplayCardId, 'Missing exact printing');
        deriveLot(l, allocations.get(lotKey(l)) ?? []);
    }
    assert(Number.isSafeInteger(s.lots.reduce((n, l) => n + l.quantity, 0)), 'Ownership total exceeds safe integer range');
    for (const a of s.allocations) {
        assert(a.deckPlanId === null, 'Deck plan references are not supported in Phase 1');
        assert(lots.has(lotKey({kind:a.lotKind,id:a.lotId})), 'Missing allocation lot');
    }
}
/** Stable collection order makes stored before/after history independent of insertion order. */
export function normalizeState(s: State): State {
    const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
    s.cards.sort((a, b) => compare(a.id, b.id));
    s.printings.sort((a, b) => compare(a.id, b.id));
    s.lots.sort((a, b) => compare(lotKey(a), lotKey(b)));
    s.allocations.sort((a, b) => compare(a.id, b.id));
    return s;
}

export const primaryStores = ['cards', 'printings', 'lots', 'allocations'] as const;
export function recordKey(store: typeof primaryStores[number], row: { id: string }): string {
    return store === 'lots' ? lotKey(row as import('../domain/invariants').StoredLot) : row.id;
}
/** Paired changed-row images; unchanged records are never copied into history. */
export function compactBatch(b: Batch, legacyUndo = false): Batch {
    if (b.format === 'delta@1') return b;
    const before = emptyState(), after = emptyState();
    for (const k of primaryStores) {
        const old = new Map(b.before[k].map(r => [recordKey(k, r), r]));
        const next = new Map(b.after[k].map(r => [recordKey(k, r), r]));
        for (const [key, row] of old) if (canonical(row) !== canonical(next.get(key) ?? null)) (before[k] as {id:string}[]).push(row);
        for (const [key, row] of next) if (canonical(row) !== canonical(old.get(key) ?? null)) (after[k] as {id:string}[]).push(row);
    }
    const compact: Batch = { ...b, format: 'delta@1', ...(legacyUndo ? { legacyUndo: true as const } : {}), before, after };
    // A legacy collection with only one changing record may not become smaller.
    // Retain its original representation rather than making a valid archive oversized.
    return legacyUndo && byteSize(compact) >= byteSize(b) ? b : compact;
}
export function patchState(current: State, from: State, to: State): State {
    const result = structuredClone(current);
    for (const k of primaryStores) {
        const rows = new Map(result[k].map(r => [recordKey(k, r), r]));
        for (const row of from[k]) {
            assert(canonical(rows.get(recordKey(k, row)) ?? null) === canonical(row), 'Delta baseline mismatch');
            rows.delete(recordKey(k, row));
        }
        for (const row of to[k]) {
            assert(!rows.has(recordKey(k, row)), 'Delta creation collision');
            rows.set(recordKey(k, row), structuredClone(row));
        }
        (result[k] as {id:string}[]) = [...rows.values()];
    }
    return normalizeState(result);
}
export const byteSize = (x: unknown) => new TextEncoder().encode(canonical(x)).length;
