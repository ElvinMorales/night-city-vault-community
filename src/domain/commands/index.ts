import type { Card, Printing, Allocation, DeckPlan, PendingTrade, Quote } from '../types';
import type { StoredLot } from '../invariants';
import type { ArtworkEntry } from '../artworkResolver';
export type LotRef = {kind: 'holding' | 'unresolved'; id: string};
export type CommandBody =
 | {type: 'catalog-release'; release: import('../../catalog/catalog').CatalogRelease; choices: import('../../catalog/catalog').CatalogChoices}
 | {type: 'save-card'; card: Card}
 | {type: 'save-printing'; printing: Printing}
 | {type: 'add-lot'; lot: StoredLot}
 | {type: 'adjust-lot'; lot: LotRef; delta: number}
 | {type: 'set-reservations'; lot: LotRef; protectedQty: number; forTradeQty: number; confirmUnprotect: boolean}
 | {type: 'quick-add'; cardId: string; quantity: number; printingId: string | null; isSealed: false}
 | {type: 'reconcile'; from: LotRef; toPrintingId: string; quantity: number}
 | {type: 'allocate'; allocation: Allocation}
 | {type: 'remove-allocation'; allocationId: string}
 | {type: 'save-deck'; deck: DeckPlan}
 | {type: 'save-trade'; trade: PendingTrade}
 | {type: 'receive-trade'; tradeId: string; lineId: string; quantity: number; destination: StoredLot}
 | {type: 'manual-quote'; quote: Quote & {status: 'manual'}}
 | {type: 'replace-artwork'; entries: ArtworkEntry[]; confirmExactRemoval: boolean}
 | {type: 'undo'; batchId: string};
export interface DomainCommand {
 operationId: string;
 /** SHA-256 of canonical command payload. Same ID/different fingerprint must fail. */
 fingerprint: string;
 /** Absolute edits also require {entity:'revision', id:'collection', version:snapshot.revision}. */
 expectedVersions: {entity: string; id: string; version: number}[];
 body: CommandBody;
}
export type CommandResult = {ok: true; revision: number; batchId: string; undoable: boolean; replayed: boolean} | {ok: false; code: 'validation' | 'conflict' | 'replay-mismatch' | 'storage' | 'unsupported-undo'; message: string};
