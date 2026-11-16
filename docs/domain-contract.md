# Domain contracts, version 1

Gameplay identity, exact printing and physical lot are distinct. Printing uniqueness is [gameplayCardId,setCode,collectorNumber-or-empty,treatment,language]. Preserve leading zeroes, unknown treatment, source/evidence and aliases. No fuzzy-name or image-based resolution. Lot references are [kind,id]. Unresolved pulls keep labels/reasons. Quick-add without an explicit printing remains unresolved and cannot be sealed. Reconciliation conserves ownership, never acquires copies.

Owned includes resolved, unresolved and sealed copies; pending trades do not count until receipt. Counts must be nonnegative safe integers. protected + allocated + markedTrade <= quantity. Allocation is derived from rows. Sealed allocations are rejected. Commands must reject reductions consuming encumbered copies and require confirmation for sensitive unprotection.

Community sealed decision: free is zero for sealed lots; otherwise max(0,quantity-protected-allocated-markedTrade). Buildable is free+allocated on validated lots. Deck readiness excludes allocations referencing sealed lots defensively. Owned/playset completion still includes sealed copies; playable is owned-sealed.

The reviewed baseline computed free without checking sealed status. A sealed unprotected quantity of three therefore had legacy free=3. A dedicated characterization records that result and separately asserts Community free/buildable=0. This intentional behavior change is authorized by the Phase 0 request. All other calculation semantics remain characterized from the reviewed baseline.

Legend goal=1; other goal=3. Unknown classification remains needs-classification. Phase 2B2: owner keep overrides affect both extras and ownership completion; default classification goals remain 1/3, and unknown classification always remains needs-classification. This explicitly supersedes the Phase 0 completion rule as authorized by Phase 2B2. Extras=max(0,owned-protected-keep), never automatic trade marks. Deck plans do not reserve; grouped demand consumes free+allocations to that deck once in legend/main/side order. Legality is unverified. Open incoming ranges clamp expected-minus-received to zero.

Quotes use integer USD cents, latest usable dated ok/manual observation, explicit null versus zero, fixed-clock staleness strictly beyond the threshold. Unresolved copies are not valued. No new condition-matching policy is introduced.

Phase 1 implements the inventory command subset through a transactional IndexedDB repository; later deck/trade/quote/artwork variants remain unsupported. Implementations must validate quantities, references, identity collisions, alias preservation, stale versions, replay fingerprints and guarded undo in one transaction. Trade receipt/undo must update receipt and ownership together. Unsupported undo must fail without writes.

Phase 1 absolute edits require a collection revision guard as well as entity versions; this deliberately rejects stale editors after backup replacement. Guarded undo supports only the unchanged latest undoable batch, with a compensating event and advancing entity versions. See architecture.md for the exact implemented boundary.
