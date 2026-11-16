import { compactBatch } from '../state';
import { normalizeName } from '../../domain/analysis';
import { DATABASE_NAME, STORES } from '../repository';
export const DATABASE_VERSION = 3;
export function request<T>(r: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
export function completion(tx: IDBTransaction): Promise<void> { return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted')); tx.onerror = () => { }; }); }
/** v1 establishes stores; v2 backfills identity/alias indexes; v3 compacts legacy history atomically. */
export function openDatabase(name = DATABASE_NAME): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const r = indexedDB.open(name, DATABASE_VERSION);
        r.onerror = () => reject(r.error);
        let blocked = false;
        r.onblocked = () => { blocked = true; reject(new Error('Database upgrade blocked: close older tabs')); };
        r.onupgradeneeded = e => {
            const db = r.result, tx = r.transaction!;
            // An aborted upgrade must not leave its provisional connection blocking retry.
            db.onversionchange = () => db.close();
            tx.onabort = () => db.close();
            if (e.oldVersion < 1) {
                for (const store of STORES)
                    db.createObjectStore(store, { keyPath: store === 'meta' ? 'key' : store === 'lots' ? ['kind', 'id'] : store === 'events' ? 'seq' : 'id' });
                tx.objectStore('meta').put({ key: 'state', revision: 0, schema: 2, headBatch: null });
            }
            if (e.oldVersion < 2) {
                const index = (store: string, name: string, key: string | string[], unique = false) => tx.objectStore(store).createIndex(name, key, { unique });
                index('cards', 'name', 'name');
                index('aliases', 'normalized', 'normalized');
                index('aliases', 'cardId', 'cardId');
                // Array index values preserve null/empty identity semantics through an explicit serialized key.
                index('printings', 'identity', 'identity', true);
                index('printings', 'cardId', 'gameplayCardId');
                index('lots', 'cardId', 'gameplayCardId');
                index('lots', 'printingId', 'printingId');
                index('allocations', 'lot', ['lotKind', 'lotId']);
                index('allocations', 'deck', 'deckPlanId');
                index('events', 'batch', 'batchId');
                index('batches', 'revision', 'revision', true);
                const cursor = tx.objectStore('printings').openCursor();
                cursor.onsuccess = () => { const c = cursor.result; if (c) {
                    const p = c.value;
                    p.identity = JSON.stringify([p.gameplayCardId, p.setCode, p.collectorNumber ?? '', p.treatment, p.language]);
                    c.update(p);
                    c.continue();
                } };
                const cards = tx.objectStore('cards').openCursor();
                cards.onsuccess = () => { const c = cards.result; if (c) {
                    for (const name of [c.value.name, ...c.value.aliases]) {
                        const normalized = normalizeName(name);
                        tx.objectStore('aliases').put({ id: JSON.stringify([c.value.id, normalized]), cardId: c.value.id, normalized });
                    }
                    c.continue();
                } };
                const meta = tx.objectStore('meta').get('state');
                meta.onsuccess = () => { if (meta.result)
                    tx.objectStore('meta').put({ ...meta.result, schema: 2 }); };
            }
            if (e.oldVersion < 3) {
                const batches = tx.objectStore('batches').openCursor();
                batches.onsuccess = () => { const c = batches.result; if (c) {
                    c.update(compactBatch(c.value, true)); c.continue();
                } };
                tx.objectStore('meta').delete('archiveBytes');
            }
        };
        r.onsuccess = () => { if (blocked) {
            r.result.close();
            return;
        } r.result.onversionchange = () => r.result.close(); resolve(r.result); };
    });
}
