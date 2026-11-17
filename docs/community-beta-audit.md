# Community beta access and usability audit

**Audit date:** 2026-11-16  
**Live application:** https://elvinmorales.github.io/night-city-vault-community/  
**Repository:** https://github.com/ElvinMorales/night-city-vault-community

## Verified

- The GitHub repository is public, Issues is enabled, and source is on `main`.
- Approved GitHub Actions run `43950855084` deployed commit `770648f3f149a290d041646f8085e002357879ab` successfully. Verification (`npm run check`), release audit, Pages artifact upload and deployment step all passed.
- Source includes Binder, Pack Desk, Playsets, Extras, Settings, search, printing choice, local IndexedDB, guarded backup/restore and offline service-worker behavior.
- Public documentation now explains first use and private-data precautions. Issue forms invite bug reports, confusing-workflow examples and ideas.

## Not independently certified

- **Live HTTP/browser check:** the audit environment could inspect GitHub deployment records and source but could not fetch the Pages hostname because of DNS/network restrictions. A successful deploy does not prove the app opens in a player's browser.
- **Physical devices:** iPhone Safari/Home Screen, Android, VoiceOver, camera/HEIC and low-storage behavior remain unverified or incomplete. Desktop browser automation does not certify real-device usability.
- **First-time player comprehension:** no observed player walk-through was performed as part of this audit.
- **Catalog completeness:** 860 source printing records are not 860 verified foil/stamp treatments. A sourced printing can be incomplete or outdated.
- **Long-term storage:** local browser data is not synchronized; external full backups and disposable restores need hands-on confirmation.

## Manual player smoke-test

1. Open the live URL in Safari and Chrome; confirm the catalog searches and navigation works.
2. Add copies of a fictional test card, one exact printing and one with **Not sure which version**. Close/reopen and verify totals.
3. Mark an extra for trade and confirm only explicitly marked copies appear in exports.
4. Save a disposable personal test image and download a **full `.ncv` backup**. Confirm the file exists outside browser storage.
5. Restore **only into an empty disposable installation/profile**. Check history, copies, image and cancellation. Never overwrite a real collection to test.
6. After **Offline app ready**, test reopening offline and saving a fictional test copy. Reopen and verify it remains.
7. Test a mobile keyboard, printing picker, Close/Back, larger text and VoiceOver where available.
8. Open **New issue** on GitHub and confirm the bug, confusion and idea forms appear and work.

Record device/browser, observed behavior, fictional screenshots (if useful), and issue links. A reproducible data-loss or security defect warrants pausing broader promotion.

## Additional owner-facing cleanup

- Set the GitHub repository's **About → Website** to the live Pages URL if desired. This setting is outside the documentation PR.
- Keep [README](../README.md), [SECURITY.md](../SECURITY.md), [CHANGELOG.md](../CHANGELOG.md) and issue forms current.
- Avoid claims of external security certification, verified physical print treatments, guaranteed backups or universal device compatibility.
