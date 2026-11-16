# Physical iPhone test record

Status: **PENDING — not executed on physical hardware**.

Use a disposable collection in a separate browser profile at the approved website origin. Never restore over an existing collection. Record date, iPhone model, iOS/Safari version, origin, build commit, free storage, Safari versus Home Screen mode and pass/fail/evidence for each item. Repeat core flows in both modes; note that storage may differ.

- [ ] Launch online, wait for offline readiness, locate a real Cyberpunk card by name; verify catalog context and search.
- [ ] Add several copies from different printings. Record each quantity, total, unknown count, sealed/protected/trade counts. Printing metadata must not imply verified physical treatment.
- [ ] Add an unknown-printing copy; it stays unresolved without inventing a printing.
- [ ] Create a custom exact printing with evidence and add a copy; incomplete identity stays provisional. Confirm totals change only when copies are added.
- [ ] Navigate Binder, Pack Desk, Playsets and Extras. Check large catalog search, Show 100 more, portrait/landscape, notch/home indicator and touch targets.
- [ ] Mark a copy for trade through collection tools; verify reserved quantities and available extras. Check undo and a second open window's conflict behavior.
- [ ] Attach a photo from the library and, if offered, the camera. Check orientation, preview, acknowledgment and saved image. HEIC-only input is unsupported: use JPG/PNG/WebP; a failure must preserve inventory and prior artwork.
- [ ] Open/close modals, switch printing selectors, focus quantity and text fields, show/dismiss the touch keyboard. Ensure focused controls, Save and Close stay reachable, no sideways scrolling, and focus returns on closing.
- [ ] Close all Safari/PWA windows, reopen; confirm totals and images. Repeat after device restart. No new collection or missing copies should appear.
- [ ] After caching, turn on Airplane Mode and turn off Wi-Fi; reopen from Home Screen, search catalog, add copies and view images. Close/reopen offline and verify edits. An uncached disposable installation offline should fail at browser navigation; reconnect for first launch.
- [ ] Reconnect, download a full artwork-inclusive `.ncv` backup. In Files, confirm a nonempty completed file, timestamp and size; copy it outside browser storage. Metadata/trade exports are insufficient.
- [ ] Use a separate empty test installation/origin (or verified separate profile), not the original collection. Open Files picker, select backup, inspect preview, confirm replacement only when current copies and images are zero. Test cancel first; inventory must remain unchanged. Restore complete backup.
- [ ] Compare every recorded quantity, aggregate total, printings/unknowns, reservations, history and images. Reopen restored app offline and check again. Download latest recovery backup; preserve the original external backup.
- [ ] With two test windows open, stage a new build. Update notice must ask to finish operations and close every window; no involuntary reload. Close/reopen all windows and verify inventory/artwork survive. Catalog changes needing review must remain explicit.
- [ ] Record failed image formats, storage/persistence denial, interrupted downloads, background suspension and any hangs. Do not force low storage on a phone holding valuable data. Quota failures must report failure without claiming a successful save/restore.

Acceptance requires the owner to enter actual results and verify the full backup restore. Desktop WebKit is supporting evidence only.


## Phase 3C player-first UX — physical acceptance PENDING

- [ ] On a fresh disposable installation, read and dismiss the brief welcome. Recognize Cyberpunk TCG, search a card and record one copy without help. Note taps and any confusing words.
- [ ] Verify the first cards are visible on launch; inspect two-column 5:7 cards and compact list. Scroll to the last action: the fixed navigation must not cover it.
- [ ] Use Binder, Pack Desk, Playsets, Extras and Settings in portrait and landscape, with Safari browser bars expanded/collapsed and the Home Screen home indicator/notch.
- [ ] Search with the actual touch keyboard open; find a many-version card such as V: Streetkid, search its versions, choose Retail English or Not sure which version, and Add. Unknown copies must still need identification; unconfirmed finishes must stay unconfirmed.
- [ ] Open My card photos separately, verify Close and Add stay reachable, then find My Backups, My Card Photos, Storage and Privacy, and Advanced Information in Settings.
- [ ] With VoiceOver and larger text enabled, check named + buttons, selected filters, current navigation, version choice, modal focus, announcements and focus return.

Record failures and screenshots before accepting Phase 3C. Desktop automation does not certify iPhone safe areas, virtual keyboard behavior, VoiceOver or browser toolbar interaction.

## Phase 3D — pending physical iPhone review

- Binder → card → Add Photo → choose camera/library image → preview → acknowledgment → save → Back to card. Review exact-version evidence separately; photo selection must never confirm a physical finish.
- Settings: no catalog-wide photo list; empty state opens Binder. Find a saved photo, replace it, remove it and confirm counts/fallbacks after reopening offline.
- Add a copy and use immediate Undo with VoiceOver and touch. Check notice above bottom navigation, safe areas and Safari/Home Screen toolbars. Scroll without hiding essential actions. In dialogs check independently scrolling content and the stationary notification footer.
- Open Activity from each destination; inspect descriptions and Advanced details. After another change/tab/photo save, confirm the earlier Undo offer is gone and the explanation is understandable.
- Test short and long card names, landscape, the real touch keyboard, larger text, VoiceOver announcements/focus return, Reduce Motion and Increase Contrast. Keyboard-space emulation and desktop WebKit do not establish physical acceptance.
- Back up and preview restore. Confirm whole-collection/history/photo replacement and missing-photo warnings remain explicit. Cancel before commit; test recovery download after a completed restore.

Record device/iOS/browser mode and findings separately. Phase 3D physical acceptance remains pending.
