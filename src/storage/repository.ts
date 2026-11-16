import type { Snapshot, EventRow } from '../domain/types';
import type { DomainCommand, CommandResult } from '../domain/commands';
export const DATABASE_NAME = 'community-collection-local';
export const STORES = ['meta', 'cards', 'aliases', 'printings', 'lots', 'allocations', 'decks', 'deckLines', 'trades', 'tradeLines', 'quotes', 'providerMaps', 'events', 'batches', 'operations', 'imports', 'artworkEntries', 'blobs'] as const;
/** Atomic local repository; IndexedDB is the authoritative store. */
export interface CollectionRepository {
 readSnapshot(): Promise<Snapshot>;
 readCatalogReleases?(): Promise<import('../catalog/catalog').CatalogRelease[]>;
 /** Read-only context for recent activity; never establishes Undo eligibility. */
 readActivityCommands?(batchIds:string[]):Promise<Record<string,DomainCommand['body']>>;
 readEvents(afterSequence: number): Promise<EventRow[]>;
 execute(command: DomainCommand): Promise<CommandResult>;
 subscribeCommittedRevision(listener: (revision: number) => void): () => void;
 close(): void;
}
