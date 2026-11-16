// Pure local collection analysis. Sealed copies count as owned, never free/buildable.
// Allocation quantities are derived from rows in the validated read model.
import type { Card, DeckPlan, DeckSection, Lot, Printing, Quote, Snapshot } from './types';

export interface CardStats {
  card: Card;
  lots: Lot[];
  owned: number;          // all confirmed physical copies (resolved + unresolved)
  sealed: number;         // copies in sealed lots (collected, not playable while sealed)
  playable: number;       // owned - sealed
  buildable: number;      // free + allocated: copies that can physically be sleeved
  protectedQty: number;
  allocated: number;
  forTrade: number;
  free: number;           // free for deckbuilding
  goal: number;           // playset goal (1 Legend, 3 otherwise)
  keep: number;           // keep target (override or goal)
  beyondPlayset: number;  // potential extras; never auto-marked for sale
  playsetStatus: 'complete' | 'incomplete' | 'missing' | 'needs-classification';
  unresolvedQty: number;
  printingCount: number;
}

export function lotAvailable(lot: Pick<Lot, 'quantity' | 'protectedQty' | 'allocatedQty' | 'forTradeQty' | 'isSealed'>): number {
  if (lot.isSealed) return 0;
  return Math.max(0, lot.quantity - lot.protectedQty - lot.allocatedQty - lot.forTradeQty);
}

export function playsetGoal(card: Pick<Card, 'playsetClass'>): number {
  return card.playsetClass === 'legend' ? 1 : 3;
}

export function cardStats(card: Card, lots: Lot[]): CardStats {
  const mine = lots.filter((l) => l.gameplayCardId === card.id);
  const sum = (f: (l: Lot) => number) => mine.reduce((a, l) => a + f(l), 0);
  const owned = sum((l) => l.quantity);
  const sealed = sum((l) => (l.isSealed ? l.quantity : 0));
  const protectedQty = sum((l) => l.protectedQty);
  const allocated = sum((l) => l.isSealed ? 0 : l.allocatedQty);
  const forTrade = sum((l) => l.forTradeQty);
  const free = sum(lotAvailable);
  const goal = playsetGoal(card);
  const keep = card.keepTarget ?? goal;
  const playable = owned - sealed;
  const beyondPlayset = Math.max(0, owned - protectedQty - keep);
  let playsetStatus: CardStats['playsetStatus'];
  if (card.playsetClass === 'unknown') playsetStatus = 'needs-classification';
  else if (owned >= keep) playsetStatus = 'complete';
  else if (owned === 0) playsetStatus = 'missing';
  else playsetStatus = 'incomplete';
  const printingIds = new Set(mine.filter((l) => l.quantity > 0 && l.printingId).map((l) => l.printingId));
  return {
    card,
    lots: mine,
    owned,
    sealed,
    playable,
    buildable: free + allocated,
    protectedQty,
    allocated,
    forTrade,
    free,
    goal,
    keep,
    beyondPlayset,
    playsetStatus,
    unresolvedQty: sum((l) => (l.kind === 'unresolved' ? l.quantity : 0)),
    printingCount: printingIds.size,
  };
}

export function allCardStats(s: Pick<Snapshot, 'cards' | 'lots'>): CardStats[] {
  const byCard = new Map<string, Lot[]>();
  for (const l of s.lots) {
    const arr = byCard.get(l.gameplayCardId) ?? [];
    arr.push(l);
    byCard.set(l.gameplayCardId, arr);
  }
  return s.cards.map((c) => cardStats(c, byCard.get(c.id) ?? []));
}

// Collection progress: 0/3 … 3/3, then "4+" style; Legends 0/1, 1/1 (+n).
export function playsetLabel(st: Pick<CardStats, 'owned' | 'goal'>): string {
  if (st.owned > st.goal) return st.goal === 1 ? `1/1 +${st.owned - 1}` : `${st.owned}+`;
  return `${st.owned}/${st.goal}`;
}

export interface CollectionTotals {
  copies: number;
  positiveNames: number;
  names: number;
  unresolvedCopies: number;
  protectedCopies: number;
  pendingMin: number;
  pendingMax: number;
}

export function collectionTotals(s: Pick<Snapshot, 'cards' | 'lots' | 'trades'>): CollectionTotals {
  const stats = allCardStats(s);
  let pendingMin = 0;
  let pendingMax = 0;
  for (const t of s.trades) {
    if (t.status !== 'open') continue;
    for (const l of t.lines) {
      pendingMin += Math.max(0, l.expectedMin - l.receivedQty);
      pendingMax += Math.max(0, l.expectedMax - l.receivedQty);
    }
  }
  return {
    copies: stats.reduce((a, x) => a + x.owned, 0),
    positiveNames: stats.filter((x) => x.owned > 0).length,
    names: stats.length,
    unresolvedCopies: stats.reduce((a, x) => a + x.unresolvedQty, 0),
    protectedCopies: stats.reduce((a, x) => a + x.protectedQty, 0),
    pendingMin,
    pendingMax,
  };
}

// ---------- Deck readiness ----------

export interface DeckLineReadiness {
  cardName: string;
  gameplayCardId: string | null;
  sections: Partial<Record<DeckSection, number>>;
  needed: number;
  owned: number;
  allocatedHere: number;
  free: number;
  usable: number;           // allocatedHere + free
  shortBy: number;
  blockedProtected: number;
  allocatedElsewhere: number;
  markedTrade: number;
  sealed: number;
  explanation: string;
  status: 'ready' | 'short' | 'unknown-card';
}

export interface DeckReadiness {
  deck: DeckPlan;
  lines: DeckLineReadiness[];
  sectionTotals: Record<DeckSection, { needed: number; covered: number }>;
  needed: number;
  covered: number;
  shortBy: number;
}

export function deckReadiness(deck: DeckPlan, s: Pick<Snapshot, 'cards' | 'lots' | 'allocations'>): DeckReadiness {
  const statsById = new Map(allCardStats(s).map((x) => [x.card.id, x]));
  const grouped = new Map<string, DeckLineReadiness>();
  for (const line of deck.lines) {
    const key = line.gameplayCardId ?? `name:${line.cardName.toLowerCase()}`;
    const g = grouped.get(key) ?? {
      cardName: line.cardName,
      gameplayCardId: line.gameplayCardId,
      sections: {},
      needed: 0,
      owned: 0,
      allocatedHere: 0,
      free: 0,
      usable: 0,
      shortBy: 0,
      blockedProtected: 0,
      allocatedElsewhere: 0,
      markedTrade: 0,
      sealed: 0,
      explanation: '',
      status: 'ready' as const,
    };
    g.sections[line.section] = (g.sections[line.section] ?? 0) + line.quantity;
    g.needed += line.quantity;
    grouped.set(key, g);
  }
  const lotIds = new Map(s.lots.map((l) => [`${l.kind}:${l.id}`, l]));
  for (const g of grouped.values()) {
    const st = g.gameplayCardId ? statsById.get(g.gameplayCardId) : undefined;
    if (!st) {
      g.status = 'unknown-card';
      g.shortBy = g.needed;
      g.explanation = 'Card name is not in the vault catalogue — check spelling or add the card.';
      continue;
    }
    let here = 0;
    for (const a of s.allocations) {
      const lot = lotIds.get(`${a.lotKind}:${a.lotId}`);
      if (lot && !lot.isSealed && lot.gameplayCardId === st.card.id && a.deckPlanId === deck.id) here += a.quantity;
    }
    g.owned = st.owned;
    g.allocatedHere = here;
    g.free = st.free;
    g.usable = here + st.free;
    g.blockedProtected = st.protectedQty;
    g.allocatedElsewhere = st.allocated - here;
    g.markedTrade = st.forTrade;
    g.sealed = st.sealed;
    g.shortBy = Math.max(0, g.needed - g.usable);
    g.status = g.shortBy > 0 ? 'short' : 'ready';
    const parts: string[] = [`Owned ${st.owned}`];
    if (here) parts.push(`${here} already sleeved for this deck`);
    parts.push(`${st.free} free`);
    if (st.protectedQty) parts.push(`${st.protectedQty} protected`);
    if (g.allocatedElsewhere) parts.push(`${g.allocatedElsewhere} allocated elsewhere`);
    if (st.forTrade) parts.push(`${st.forTrade} marked trade/sell`);
    let why = parts.join(' · ');
    if (g.shortBy > 0) {
      why +=
        st.owned >= g.needed
          ? ` — short ${g.shortBy} because owned copies are protected, allocated or marked for trade.`
          : ` — short ${g.shortBy}: not enough copies owned.`;
    }
    g.explanation = why;
  }
  const lines = [...grouped.values()].sort((a, b) => a.cardName.localeCompare(b.cardName));
  const sectionTotals: DeckReadiness['sectionTotals'] = {
    legend: { needed: 0, covered: 0 },
    main: { needed: 0, covered: 0 },
    side: { needed: 0, covered: 0 },
  };
  // Cover sections in order legend → main → side using each card's usable pool once.
  for (const g of lines) {
    let pool = g.status === 'unknown-card' ? 0 : g.usable;
    for (const sec of ['legend', 'main', 'side'] as DeckSection[]) {
      const n = g.sections[sec] ?? 0;
      const c = Math.min(n, pool);
      pool -= c;
      sectionTotals[sec].needed += n;
      sectionTotals[sec].covered += c;
    }
  }
  const needed = lines.reduce((a, x) => a + x.needed, 0);
  const shortBy = lines.reduce((a, x) => a + x.shortBy, 0);
  return { deck, lines, sectionTotals, needed, covered: needed - shortBy, shortBy };
}

// ---------- Market value ----------

export interface ValueLine {
  printing: Printing;
  cardName: string;
  quantity: number;
  quote: Quote | null;
  stale: boolean;
  subtotalCents: number | null;
}

export interface ValueSummary {
  knownCents: number;
  pricedCopies: number;
  unpricedCopies: number;      // exact printing known, but no usable quote
  unresolvedCopies: number;    // printing unknown: never valued
  staleQuotes: number;
  lines: ValueLine[];
}

export function bestQuote(quotes: Quote[], printingId: string): Quote | null {
  const usable = quotes
    .filter((q) => q.printingId === printingId && (q.status === 'ok' || q.status === 'manual') && q.amountCents !== null)
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  return usable[0] ?? null;
}

export function isStale(observedAt: string, staleDays: number, now = Date.now()): boolean {
  return now - Date.parse(observedAt) > staleDays * 86_400_000;
}

export function valueSummary(s: Pick<Snapshot, 'cards' | 'lots' | 'printings' | 'quotes' | 'quoteStaleDays'>, now = Date.now()): ValueSummary {
  const names = new Map(s.cards.map((c) => [c.id, c.name]));
  const qtyByPrinting = new Map<string, number>();
  let unresolvedCopies = 0;
  for (const l of s.lots) {
    if (l.kind === 'unresolved' || !l.printingId) unresolvedCopies += l.quantity;
    else qtyByPrinting.set(l.printingId, (qtyByPrinting.get(l.printingId) ?? 0) + l.quantity);
  }
  const lines: ValueLine[] = [];
  let knownCents = 0;
  let pricedCopies = 0;
  let unpricedCopies = 0;
  let staleQuotes = 0;
  for (const p of s.printings) {
    const quantity = qtyByPrinting.get(p.id) ?? 0;
    const quote = bestQuote(s.quotes, p.id);
    const stale = quote ? isStale(quote.observedAt, s.quoteStaleDays, now) : false;
    const subtotalCents = quote && quote.amountCents !== null ? quote.amountCents * quantity : null;
    if (quantity > 0) {
      if (subtotalCents !== null) {
        knownCents += subtotalCents;
        pricedCopies += quantity;
        if (stale) staleQuotes++;
      } else unpricedCopies += quantity;
    }
    lines.push({ printing: p, cardName: names.get(p.gameplayCardId) ?? '?', quantity, quote, stale, subtotalCents });
  }
  return { knownCents, pricedCopies, unpricedCopies, unresolvedCopies, staleQuotes, lines };
}

export function formatUsd(cents: number | null): string {
  if (cents === null) return 'No verified quote';
  return `$${(cents / 100).toFixed(2)}`;
}

export function printingLabel(p: Pick<Printing, 'setName' | 'collectorNumber' | 'rarity' | 'treatment'>): string {
  const bits = [p.setName];
  if (p.collectorNumber) bits.push(`#${p.collectorNumber}`);
  if (p.rarity) bits.push(p.rarity);
  if (p.treatment && p.treatment !== 'regular' && p.treatment !== 'unknown') bits.push(p.treatment);
  return bits.join(' · ');
}

export function normalizeName(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Parses "3 Card Name", "3x Card Name", "Card Name x3" lines with optional "Legends:", "Main:", "Sideboard:" headers.
export interface ParsedDeckLine {
  section: DeckSection;
  quantity: number;
  cardName: string;
}

export function parseDecklist(text: string): { lines: ParsedDeckLine[]; errors: string[] } {
  const lines: ParsedDeckLine[] = [];
  const errors: string[] = [];
  let section: DeckSection = 'main';
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/#.*$/, '').replace(/\/\/.*$/, '').trim();
    if (!line) return;
    const header = line.replace(/[:\s]+$/, '').toLowerCase();
    if (/^(legends?|leaders?)( \(\d+\))?$/.test(header)) return void (section = 'legend');
    if (/^(main( deck)?|deck)( \(\d+\))?$/.test(header)) return void (section = 'main');
    if (/^(side( ?board)?|sb)( \(\d+\))?$/.test(header)) return void (section = 'side');
    let m = line.match(/^(\d{1,2})\s*x?\s+(.+)$/i);
    let qty: number;
    let name: string;
    if (m) {
      qty = Number(m[1]);
      name = m[2];
    } else if ((m = line.match(/^(.+?)\s+x\s*(\d{1,2})$/i))) {
      qty = Number(m[2]);
      name = m[1];
    } else {
      errors.push(`Line ${i + 1}: expected "<qty> <card name>" — got "${line}"`);
      return;
    }
    if (qty < 1 || qty > 99) {
      errors.push(`Line ${i + 1}: quantity must be 1–99`);
      return;
    }
    lines.push({ section, quantity: qty, cardName: name.trim() });
  });
  return { lines, errors };
}
