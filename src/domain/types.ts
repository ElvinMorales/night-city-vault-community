// Local domain read model. No authentication or provider runtime contracts.

export type PlaysetClass = 'legend' | 'standard' | 'unknown';
export type LotKind = 'holding' | 'unresolved';
export type DeckSection = 'legend' | 'main' | 'side';
export type Condition = 'unknown' | 'NM' | 'LP' | 'MP' | 'HP' | 'DMG' | 'sealed';
export const CONDITIONS: Condition[] = ['unknown', 'NM', 'LP', 'MP', 'HP', 'DMG', 'sealed'];

export interface Printing {
  id: string;
  gameplayCardId: string;
  setCode: string;
  setName: string;
  collectorNumber: string | null;
  language: string;
  rarity: string | null;
  treatment: string;
  isPromo: boolean;
  collectorOnly: boolean;
  source: string;
  sourceText: string | null;
  artMediaId: string | null;
  notes: string;
  providerMaps: ProviderMap[];
  version: number;
}

export interface ProviderMap {
  id: string;
  provider: string;
  externalId: string;
  externalSub: string;
  externalUrl: string | null;
  verifiedBy: string;
  verifiedAt: string;
}

export interface Allocation {
  id: string;
  lotKind: LotKind;
  lotId: string;
  container: string;
  containerKind: 'deck' | 'binder' | 'box' | 'other';
  deckPlanId: string | null;
  quantity: number;
  notes: string;
}

export interface Lot {
  kind: LotKind;
  id: string;
  gameplayCardId: string;
  printingId: string | null;
  label: string;
  reason: string | null;
  condition: Condition;
  isSealed: boolean;
  quantity: number;
  protectedQty: number;
  forTradeQty: number;
  allocatedQty: number;
  location: string;
  notes: string;
  version: number;
}

export interface Card {
  id: string;
  name: string;
  playsetClass: PlaysetClass;
  typeLabel: string | null;
  classificationSource: string | null;
  colors: string | null;
  keepTarget: number | null;
  artMediaId: string | null;
  needsReview: string | null;
  notes: string;
  aliases: string[];
  version: number;
}

export interface Quote {
  id: string;
  printingId: string;
  provider: string;
  market: string;
  priceType: string;
  condition: string;
  variant: string;
  currency: 'USD';
  amountCents: number | null;
  status: 'ok' | 'manual' | 'no_data' | 'error';
  observedAt: string;
  fetchedAt: string;
  externalId: string | null;
  url: string | null;
  urlKind: 'listing' | 'search' | null;
  notes: string;
}

export interface DeckLine {
  id: string;
  gameplayCardId: string | null;
  cardName: string;
  section: DeckSection;
  quantity: number;
}

export interface DeckPlan {
  id: string;
  name: string;
  format: string;
  legalityStatus: 'unverified';
  source: string;
  notes: string;
  lines: DeckLine[];
  version: number;
}

export interface TradeLine {
  id: string;
  gameplayCardId: string;
  cardName: string;
  expectedMin: number;
  expectedMax: number;
  receivedQty: number;
  notes: string;
}

export interface PendingTrade {
  id: string;
  counterparty: string;
  title: string;
  status: 'open' | 'completed' | 'cancelled';
  notes: string;
  lines: TradeLine[];
}

export interface Snapshot {
  revision: number;
  generatedAt: string;
  quoteStaleDays: number;
  cards: Card[];
  printings: Printing[];
  lots: Lot[];
  allocations: Allocation[];
  quotes: Quote[]; // latest quote per printing + provider
  decks: DeckPlan[];
  trades: PendingTrade[];
}

export interface EventRow {
  seq: number;
  batchId: string;
  occurredAt: string;
  kind: string;
  targetType: string;
  targetId: string;
  field: string;
  delta: number | null;
  beforeValue: string | null;
  afterValue: string | null;
  gameplayCardId: string | null;
  printingId: string | null;
  undoesBatchId: string | null;
  label: string;
}

