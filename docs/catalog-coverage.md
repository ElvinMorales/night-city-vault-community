# Archive catalog coverage — local development

Pinned source: github.com/ttiiggss/night-city-archive, commit `40eab012f0b683f4dc706df65ebf8dc5587f986c`, committed `data/cards.json`, obtained 2026-11-16. Transform version 1. No upstream sync or official API calls. The committed source is from 2026-11-01, before Retail release; its entries are source assertions, not release verification.

**151 gameplay identities, 860 source-identified printing records, zero initial owned copies.** 0 independently verified exact physical treatments; all 860 remain provisional in physical certainty because finish is null. These are selectable source printing references with uncertain evidence, not 860 zero-quantity holdings. No fabricated foil/nonfoil/stamp values. Unknown intake and partial custom unresolved records remain available.

| Set identifier | Source printing records |
| --- | ---: |
| PRM01 | 4 |
| arasakademodeck | 14 |
| boxtoppersbeta | 6 |
| boxtoppersretail | 6 |
| boxtoppersretail-fr | 6 |
| edgerunneropens1 | 53 |
| embracingpowerbetastarterdeck | 20 |
| embracingpowerretailstarterde-fr | 20 |
| embracingpowerretailstarterdeck | 20 |
| judgepromos | 3 |
| mercdemodeck | 15 |
| nightcitybrawls1 | 37 |
| nightcitybrawls1-FR | 37 |
| nightcityshowdowns1 | 5 |
| nightcityshowdowns1-FR | 5 |
| prereleasebeta | 11 |
| prereleaseretail | 11 |
| prereleaseretail-FR | 11 |
| theheistbetastarterdeck | 20 |
| theheistretailstarterdeck | 20 |
| theheistretailstarterdeck-fr | 20 |
| welcometonightcitybeta | 172 |
| welcometonightcityretail | 172 |
| welcometonightcityretail-fr | 172 |

WTNC Retail English contains 140 gameplay identities / 172 source printing records; these are measured counts, not assumed totals. Beta and French each have 172. Set membership overlaps gameplay identities. The top-level source set list omits many nested sets; the import uses every nested printing instead.

## Types / classifications

| Gameplay type | Identities |
| --- | ---: |
| Gear | 17 |
| Legend | 27 |
| Program | 34 |
| Unit | 73 |

Legend playset classification: 27; Standard: 124. Source tags are retained in typeLabel; tags may overlap.

| Tag | Identities |
| --- | ---: |
| 6th Street | 1 |
| AI | 2 |
| Aldecaldo | 4 |
| Animal | 1 |
| Arasaka | 19 |
| Braindance | 13 |
| Corpo | 17 |
| Cyberware | 13 |
| Doll | 3 |
| Drone | 4 |
| Extreme | 1 |
| Fixer | 7 |
| Ganger | 27 |
| Maelstrom | 9 |
| Maine's Crew | 1 |
| Medtech | 3 |
| Merc | 24 |
| Militech | 4 |
| Mox | 6 |
| Mystic | 2 |
| NCPD | 6 |
| Netrunner | 13 |
| Netwatch | 1 |
| Nomad | 7 |
| Plan | 3 |
| Quickhack | 7 |
| Raffen Shiv | 1 |
| Ripperdoc | 5 |
| Rocker | 6 |
| Samurai | 5 |
| Scavenger | 1 |
| Techie | 3 |
| Trauma Team | 4 |
| Tyger Claws | 5 |
| Valentino | 8 |
| Vehicle | 6 |
| Voodoo Boys | 4 |
| Weapon | 4 |
| Zetatech | 6 |

| Printing rarity | Records |
| --- | ---: |
| Common | 256 |
| Epic | 65 |
| Iconic Legend | 54 |
| Iconic Other | 27 |
| Iconic Secret | 12 |
| Nova Rare | 162 |
| Rare | 131 |
| Secret | 12 |
| Uncommon | 141 |

## Quality and gaps

- Missing collector numbers, printing UUIDs, set codes and languages: 0. Languages: English 589, French 271. Missing finish: 860. No missing rarity.
- Duplicate gameplay UUIDs, external IDs, display names and printing UUIDs: 0. Duplicate set/collector/language tuples: 0. No evidence of duplicate gameplay identities requiring merging; shared short names such as V do not establish identity.
- Source IDs are useful source-record identifiers, not independent proof of every physical variant. Collector strings are preserved verbatim, including leading zeroes, β and suffixes. Rarity distinguishes Iconic categories; no treatment is inferred from rarity.
- Retail/Beta starters, prereleases, box toppers, demo decks, Judge, PRM01 and organized-play sets are represented separately. Their completeness, release availability, stamps, alternate treatments and all possible language variants are unverified. WTNC-stamped Legends cannot be independently established from finish (all null); no extra stamped variants are invented.
- No full rules, flavor, images, image URLs, prices, credentials or holdings are extracted. Completely missing cards and printings remain manually recordable.
- Stable keys: nca-card-{source gameplay UUID}, nca-print-{source printing UUID}. Names and collector numbers never generate IDs. Display name retains name/subname; the stripped snapshot preserves those separately and external_id. Unique localized/short names become aliases; ambiguous aliases are omitted under the existing global alias uniqueness contract.
- Source provenance and uncertain evidence are retained by the versioned release and full backup history. Future corrections require a new version; existing associations and conflicting custom records use Settings review.

Phase 4B supersedes the blanket metadata blocker: see catalog-distribution-review.md. Physical treatment uncertainty remains; code authority and clean-public-history decisions are separate release gates.
