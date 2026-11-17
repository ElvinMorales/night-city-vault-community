# PR #4 independent review

**Verdict: APPROVE after remediation.** Reviewed the exact public PR head `03d00c04e30016cd0438a30380e9585e15d23c42` against `main` at `4c780120b64c1b45d3eb6cb7ad9e9d8917913fd1` in a separate worktree. Existing local worktrees were preserved.

Remediation commit: `24bfa77037859807e6a15cc4271719a7a307962d` (code, regression tests and reviewed inventory). The subsequent documentation commit adds this report and its exact inventory entry.

## Findings and disposition

| Severity | Finding | Files and resolution |
| --- | --- | --- |
| BLOCKER | Incorrect filter results: an explicit local Neutral color became Blue; a Gear card acquired a Unit's Vehicle tag; an unrecognized Custom type became Unit. | `src/ui/cardFacets.ts`: explicit unrecognized values remain Unknown; metadata conflicts and review flags block fallback. Compatible missing tags still receive read-only fallback. Regression tests added. |
| IMPORTANT | Spaced ASCII dashes in older imported names missed colon-based catalog names. | `src/ui/cardFacets.ts`: normalize spaced dashes, retain unspaced hyphens, reject ambiguous normalized names. Curly apostrophe and collision tests added. |
| IMPORTANT | Navigation reset search and ownership but retained the new facets, potentially leaving Pack Desk unexpectedly empty. | `src/ui/App.tsx`: navigation and Add cards clear the new facets. The explicitly named Clear color and advanced filters control retains search, edition and ownership. Browser regressions added. |
| IMPORTANT | Compact lists hid readable color labels; collapsed Filters referenced an absent element; expanded landscape filters lacked a full-width grid placement. | `src/ui/App.tsx`, `src/ui/style.css`: visible list color text, persistent hidden filter target, full-width landscape panel. Both engines verify keyboard access, expanded state, touch targets and overflow. |
| IMPORTANT | The Unknown explanation implied that recognized source metadata was confirmed, despite all catalog evidence being uncertain. | `src/ui/App.tsx`: disclose source-reported metadata and distinguish unavailable/unrecognized values from independent confirmation. Catalog evidence remains unchanged. |
| IMPORTANT | Lookup construction, per-card facet resolution and option extraction repeated on every render. | `src/ui/App.tsx`: memoize by catalog, card/printing arrays and edition before loading/error returns. Cold resolution measured about 3 ms for 1,000 cards and 36 ms for 10,000 over 100 iterations locally; unrelated renders now reuse those results. |

No unresolved BLOCKER or IMPORTANT findings remain. The release-check script change already in the PR only adds observed digest diagnostics; release gates were neither bypassed nor weakened.

## Actual catalog coverage

Both `local-catalog/archive-metadata.json` and the packaged `local-catalog/catalog.json` use full color names. All 151 generated colors match their corresponding raw source records.

| Color | Cards |
| --- | ---: |
| Red | 38 |
| Green | 38 |
| Blue | 38 |
| Yellow | 37 |

There are no multicolor, neutral, blank or unexpected color records in this pinned catalog. Those cases remain Unknown in synthetic/local records rather than being assigned a supported color.

Types: **Legend 27, Unit 73, Gear 17, Program 34**. All types are recognized; 39 distinct tags are preserved as the source's literal labels after the middle-dot type separator.

The 860 printings contain nine rarity labels: **Common 256, Uncommon 141, Rare 131, Epic 65, Nova Rare 162, Iconic Legend 54, Iconic Other 27, Secret 12, Iconic Secret 12**. None are blank. Rarity matches an eligible printing within the selected edition; an unrelated edition's rarity does not qualify a card.

Every card and printing evidence entry remains **uncertain**. These counts describe the bundled source, not independently verified physical cards or complete current game coverage.

## Verification

- `npm ci`: PASS; zero reported vulnerabilities.
- `npx playwright install --with-deps chromium webkit`: PASS.
- `npm run check`: PASS on the final remediation code: 84 unit tests, 43 Chromium storage integration tests, existing UI/data/photo/catalog suites, Pages artifact/content gates, Chromium/WebKit PWA tests, mobile tests and both engines' Phase 3D tests.
- `npm run audit:release`: PASS. Exact approved source/build inventory retained; only understood app JavaScript, CSS, HTML references and service-worker cache output hashes changed. Catalog, worker, icon, manifest, notice and dependency payloads are unchanged.
- Four additional unit tests plus an extended edition-rarity regression cover explicit conflicts, compatible legacy metadata, punctuation collisions, custom/missing/review-flagged cards, immutability and real catalog coverage. There are nine facet unit tests in total.
- New browser tests run in Chromium and WebKit: individual facets; combined color/type/tag/rarity with search, ownership states and five editions; grid/list; empty results; scoped clear; navigation reset; keyboard/ARIA semantics; visible list color text; collapsed/expanded layouts at 320, 390, 844 landscape and 1280 pixels; touch targets; and equality of all IndexedDB stores before/after browsing.
- Existing positive ownership, exact/unresolved intake, protected/trade/allocation, migration, backup/restore, rollback, offline, photo and network-isolation assertions remain intact. Existing browser scale tests passed through 5,000 identities; a 1,000-card owned fixture measured 51 ms search locally. Timings are environment-specific, not a device guarantee.
- Screenshots were inspected outside the repository. Added label/control contrast pairs exceed 4.5:1. Physical iPhone and VoiceOver testing remains pending; browser accessibility trees do not replace assistive-technology testing.

The first full-check attempt received SIGTERM before completion. A later run was intentionally stopped to refine compatible missing-tag handling; the final complete run exited successfully. Interrupted runs were not counted as passes.

## Boundaries and follow-up

Name fallback is a conservative display heuristic, never a persistent identity join. It does not change IDs, printings, quantities, protected/trade quantities, allocations, locations, history, migrations or interchange formats. Browser equality checks confirm that browsing writes no database records. No new runtime networking, tracking, external images, protected artwork or third-party UI assets were introduced.

Final PR: [PR #4](https://github.com/ElvinMorales/night-city-vault-community/pull/4). The head-specific GitHub verification status is available in its Checks tab; the final review response records the status observed after pushing these commits.

No merge, force-push, production deployment, private collection modification, private source import or private Vault change occurred. Physical-device accessibility review and independently validated future metadata are follow-ups; Cost, Power, RAM and Eddies filters remain outside this PR.
