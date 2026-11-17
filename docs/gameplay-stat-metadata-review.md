# Gameplay-stat metadata review — PR #5

Reviewed for the proposed, non-deployed gameplay-stat browsing feature on 2026-11-17.

## Scope, source and limitations

The proposed `local-catalog/gameplay-stats.json` contains **only** stable Community gameplay IDs (original pinned source UUIDs with the existing `nca-card-` prefix), integer-or-null **Cost**, **Power**, **RAM**, and source boolean `is_eddiable` renamed to **`eddiable`**. It contains **no** card names, rules, effects, flavor, images, prices, source code, image URLs, artwork, website layout, editorial prose or gameplay descriptions.

Pinned existing source: `ttiiggss/night-city-archive`, commit `40eab012f0b683f4dc706df65ebf8dc5587f986c`, `data/cards.json`, synced 2026-11-01 06:48 UTC. The Community project's earlier [field-level distribution review](catalog-distribution-review.md) describes this same publicly committed source, its provenance and rights uncertainties. No new live official API calls, scraping jobs or updater are introduced. The data is a scoped factual projection of that pinned source, not a claim of official verification.

The game's current [card database](https://cyberpunktcg.com/cards) showed **152 cards** on 2026-11-17, versus **151** in the pinned snapshot. **Do not invent or infer an additional card's stats.** All existing data remains source-reported and dated; it is not independently verified gameplay/rules text and should not silently change if an official erratum occurs.

## Verified snapshot measurement

| Field | Non-null | Null | Range |
| --- | ---: | ---: | --- |
| Cost | 132 | 19 | 1–9 |
| PWR | 98 | 53 | 0–15 |
| RAM | 150 | 1 | 1–6 |
| Eddies source flag | 151 | 0 | 78 sellable, 73 non-sellable |

`0` PWR is a **real numeric value** for ten cards, distinct from a null / unlisted stat. The source's `is_eddiable` matches its historical `eddiable` filter with the labels **Sellable / Non-Sellable**, **not** an Eddie monetary amount. Unknown is reserved for records without an unambiguous supported source identity, or missing values.

No quantities, printings, canonical cards, protected/trade flags, allocations, backups or imported card records are changed. Ambiguous names and conflicting local identity metadata fail closed to Unknown; saved data is never silently enriched.

## Distribution and terms review

The values are simple mechanical game numbers and binary capability flags rather than expressive text. The preceding Community catalog review considered short product identifiers and classification facts as utilitarian factual metadata under a U.S. copyright analysis; the same reasoning applies here to four factual fields. This is a **bounded technical assessment**, not an assertion that an entire upstream database is unlicensed.

The official [WeirdCo Terms of Service](https://cyberpunktcg.com/terms-of-service), updated 2026-08-18, prohibit automated extraction and unauthorized copying/redistribution of website content (sections 5–6). The public Archive repository does not provide an explicit license or publisher permission. An indirect publicly committed data source does not itself eliminate contractual, compilation, territorial or upstream authorization risks.

**No explicit third-party redistribution grant has been established.** This proposal therefore requires a conscious owner review of the scoped factual-basis decision and residual risks **before merging or deploying**. If that risk is unacceptable, do not release the bundled dataset: defer numeric filters pending rights-cleared independently sourced card facts. Do not invent a license or imply endorsement.

## Engineering and release gates

- A separate versioned static dataset, no database schema or user-data migration.
- Exact schema, ID-set, count and SHA-256 audit against approved factual file; no hidden network fetches.
- Unambiguous imported-name lookup and explicit local color/type conflicts covered by tests.
- Exact selectors with `Not listed` for null; `0` remains selectable.
- Browser filters combine with edition, rarity, ownership, tag, color and search.
- No production deployment or auto publishing from PR CI; source/catalog and build files remain under the existing strict hash audit.

**Status:** Proposed for review on a separate branch; field-level factual-basis review is recorded, explicit external permission remains unconfirmed, and the owner must decide before a public rollout.
