import type { Allocation, Lot } from './types';
export type StoredLot = Omit<Lot, 'allocatedQty'>;
export function deriveLot(lot: StoredLot, allocations: Allocation[]): Lot {
 const rows = allocations.filter(a => a.lotId === lot.id && a.lotKind === lot.kind);
 for (const a of rows) if (!Number.isSafeInteger(a.quantity) || a.quantity < 0) throw new Error('Invalid allocation');
 const allocatedQty = rows.reduce((n, a) => n + a.quantity, 0);
 const counts = [lot.quantity, lot.protectedQty, lot.forTradeQty, allocatedQty];
 if (counts.some(n => !Number.isSafeInteger(n) || n < 0) || lot.protectedQty + lot.forTradeQty + allocatedQty > lot.quantity || (lot.isSealed && allocatedQty > 0)) throw new Error('Invalid lot encumbrance');
 return {...lot, allocatedQty};
}
