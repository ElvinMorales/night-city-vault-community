# community-backup@2 (with version 1 compatibility)

Phase 1 implements a complete replacement backup for records supported by the local repository. It is separate from catalogue exports, legacy private snapshots and additive acquisition imports. No private-format or private-data auto-import is supported.

The JSON envelope has exactly these fields:

| Field | Meaning |
| --- | --- |
| format | Literal `community-backup@2` |
| schemaVersion | Literal 3, the database/history schema |
| appVersion | Literal `0.1.0`, the Phase 1 format producer version |
| createdAt | Parseable timestamp, produced as ISO UTC |
| archive | state, meta, batches, events, operations |
| artwork | `{entries:[], blobs:[]}` extension boundary; nonempty payloads rejected until a later version |
| checksum | Lowercase SHA-256 of the canonical envelope excluding checksum |

Canonical JSON sorts object keys lexicographically, retains array order, and uses JSON string/number encoding. The single checksum covers every supported domain record, audit batch/event, replay payload/result and metadata value. This detects accidental changes; it is not a signature, encryption or proof of origin. Duplicate JSON object keys follow native JSON parser behavior; only the resulting strict record schema is accepted. Domain arrays are stored in deterministic key order so insertion order cannot break history comparisons. Unknown fields and unsupported versions are rejected.

`archive.state` contains cards, exact printings (including provider mappings), stored lots without allocatedQty, and allocation rows. Cards contain the authoritative aliases. Alias/index projections are rebuilt at restore. `meta` contains key=`state`, schema=2, revision and headBatch. A new batch contains format=`delta@1`, ID, original revision, undoable flag and paired `before`/`after` images. Each image has cards, printings, lots and allocations arrays containing only changed records, ordered by domain key. A record present only in after is a creation; only in before is a deletion; both is a replacement. Compound lot keys remain mandatory. Unchanged rows and duplicate delta keys are rejected by semantic validation. Snapshot batches without a format remain supported for compatibility. Compacted legacy batches additionally carry `legacyUndo:true`, preserving the original all-surviving-entity version increments on inverse operations. Each EventRow links to a batch and describes its command kind; the batch supplies detailed before/after values. Each operation contains its ID, canonical body+expectedVersions payload, fingerprint and original successful result. History is never synthesized from ownership totals.

Validation checks exact record fields, types, counts, compound lot references, card/printing ownership relationships, exact printing uniqueness, normalized name/alias ambiguity, safe nonnegative quantities and safe total ownership, reservations, sealed allocation prohibition, history uniqueness/linkage/order, replay hashes/results and head state. Full baselines are reconstructed backward from current state with guarded inverse patches; each historical command is replayed against its reconstructed baseline to verify the recorded result; compensating undo is verified against the unchanged preceding undoable batch. Invalid history fails the entire restore.

Maximum UTF-8 input is 16 MiB. A string-length precheck avoids encoding already oversized strings. Array/text/ID limits are documented in architecture.md and enforced on current and historical records. The Settings file-selection worker checks Blob.size before reading a file. Artwork bytes and compressed archives are not accepted. Runtime errors during validation reject before replacement.

`exportBackup(repo)` reads a consistent transaction snapshot. `previewRestore(repo, source)` validates the file and returns checksum, expected current revision, card count and physical copy count without changing data. `restoreBackup(repo, preview, saveRecovery)` revalidates, creates a complete pre-replacement backup and awaits the caller's successful retention/download callback. A rejected callback aborts before writes. The caller must retain the supplied backup. Settings commits it to a separate recovery database and verifies a full readback before permitting replacement. No remote copy is created.

Replacement checks current revision inside a single write transaction, replaces domain/history/replay records and projections, and advances revision above both local and source revisions. Original event/batch/replay revisions remain unchanged, so revision gaps after replacement are intentional. Absolute editors require the collection revision, preventing reuse of a pre-restore editing baseline even if restored entity versions coincide. The source's supported head undo remains available.

Reimport replaces state instead of adding quantities. Original operation IDs and results survive, so retrying a restored acquisition operation does not acquire again. Using an existing operation ID with a changed payload fails. A failed, stale or interrupted restore preserves existing state and history. No merge mode is provided.

## Migration and compatibility

Database version 3 compacts existing snapshot batches where smaller, atomically without changing domain schema 2 or original event/replay records. New backups use envelope schemaVersion 3 to explicitly identify history support, even though `archive.meta.schema` remains 2 for unchanged domain shapes. The derived IndexedDB byte-count cache is not exported.

`community-backup@1`/schemaVersion 2 remains accepted. Its original envelope checksum, strict snapshot records and complete historical command semantics are checked before conversion. The adapter compacts batches where smaller and marks legacy undo behavior, preserving every event and operation. `parseBackup` returns an adapted in-memory archive but retains the input checksum as the source identity used by restore preview; that normalized object is not an unchanged signed/checksummed envelope and must not be serialized as one. Export always computes a fresh version 2 envelope checksum. Version 1 envelopes cannot contain delta batches. No private backup import is supported.

Restoring a legacy backup followed by exporting, restoring, replaying or undoing remains supported. Existing Phase 1 clients cannot read version 2 backups or open database version 3; use the upgraded adapter. The 16 MiB envelope bound, 50,000-row limits, recovery callback, complete replacement semantics and failure atomicity are unchanged. Logical history bytes measure serialized records, not browser disk allocation or quota guarantees.

Legacy snapshot batches remain intact when the explicit delta/legacy-undo markers would increase their size; this prevents migration or compatibility conversion from growing an already valid archive beyond its limit. Routine new commands always produce delta batches.

## Player-facing portability (Phase 2B1)

Settings → Data Management downloads the complete version 2 envelope; the filename includes format and creation timestamp. A collection-only export cannot reconstruct history, replay records or guarded undo and is not accepted as a replacement backup. No new envelope or archive representation is introduced in this phase.

Restore accepts version 1 and version 2 files, validates in a module worker, previews incoming totals and current totals, and requires an explicit replacement checkbox and button. The original source is revalidated at confirmation. Recovery export is validated and durably retained to the extent offered by IndexedDB transaction completion plus readback; storage eviction, device loss and browser clearing are outside that guarantee. The user can download the latest pre-restore recovery from Settings. Failed retention leaves the current Vault untouched. Each retained recovery is itself a complete ordinary version 2 backup, independent of the file being restored.

Cancellation is supported until the worker-to-UI commit handshake. Once replacement begins, cancellation is disabled and success is reported only after atomic commit and UI reload. A changed current revision invalidates the preview and is checked again inside the write transaction. Local browser data is not synchronized. Download initiation cannot prove the user saved the file successfully; the UI asks the player to verify browser downloads. Quota and download errors are visible. Existing 16 MiB and historical semantic validation limits remain unchanged.

## Phase 2C catalog operations

Database version 3, domain schema 2 and community-backup@2 remain unchanged. The command union adds catalog-release with a strict community-catalog@1 release (version/date/source/rights/coverage/per-entry evidence/cards/printings) and explicit card/printing review choices. Choices map an incoming stable ID to a retained local ID, or null to defer. Each release entry has a verified/uncertain evidence status and source references; unknown printing facts stay null or explicit unknown values rather than fabricated variants. No artwork or holdings can enter through a release.

New managed cards use a catalog-prefixed classificationSource. Printing providerMaps retain the catalog stable ID, applied version/date/status; this is local packaged provenance, not third-party API verification. Complete operation payloads retain all release evidence and adoption choices through backup, restore and undo. Reused version content is checked in repository execution and semantic backup validation. No additional mutable store or unbacked metadata ledger is introduced. Older binaries lacking this command adapter will reject newer catalog-bearing histories; forward restore compatibility is not claimed.

A provisional incomplete custom printing is an unresolved lot with zero initial quantity, explicit reason/label and serialized entered metadata in its private notes. It has no printingId. It may receive owned copies, remain provisional indefinitely or use the existing guarded unresolved reconcile command. These notes remain private in trade exports as before. Catalog adoption retains the local exact printing ID and all physical lots, preserving historical references and reservation semantics. Null review decisions defer entries without deletion or ownership changes. Absent release entries are never interpreted as collection removals.

For manually entered records, unchecked promo/collector booleans mean no user designation has been supplied; they are not independent verification that a physical card lacks that property. Source/status and retained evidence distinguish owner-supplied metadata from packaged verification.

Phase 3A complete media backups use the bounded community-media@3 binary .ncv container described in architecture.md. The inner community-backup@2 format and its 16 MiB limit are unchanged; media is raw bytes outside that JSON. Settings full/recovery downloads use complete containers; legacy JSON remains importable. A legacy JSON restore has no images and replaces existing live images only after a complete pre-restore recovery has been retained and verified. Explicit metadata and trade exports are not artwork recovery mechanisms.
