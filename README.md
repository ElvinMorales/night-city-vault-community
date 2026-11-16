# Night City Vault — Community Edition

An unofficial, free Cyberpunk TCG collection manager built for your phone. Browse the built-in card catalog, add owned copies in Binder or Pack Desk, choose foil, promo, stamped or custom versions, and track Playsets, Extras and trades. Add your own card photos and undo recent edits.

**Local release candidate:** the real 151-card / 860-printing factual catalog is retained with disclosed risks. Owner-controlled software and original icons are MIT licensed; catalog and franchise rights are excluded. Nothing is deployed. See [code provenance](docs/code-licensing-review.md) and [beta checklist](docs/release-checklist.md).

The planned address is `https://elvinmorales.github.io/night-city-vault-community/`. Once an approved release is available, players will simply open the link and start collecting; no GitHub account or catalog import is needed.

## Your collection

Cards and personal photos are saved in this browser on this device. They do **not** synchronize across devices. The app has no account, upload service or analytics. Your own photos stay local unless you choose to export them. Hosting providers can still receive ordinary page and asset requests.

Download a **full .ncv backup** from Settings regularly, especially before updates, clearing browser data or switching phones. Keep that file outside browser storage. Full backups include photos; trade lists and metadata exports do not. Restore through Settings, review the preview, and confirm replacement. Browser storage can be cleared or evicted and private browsing may discard it.

After one successful online visit and the “Offline app ready” message, the installed app can work offline. Use your browser's install/Add to Home Screen option where supported. Close all Vault windows to let a waiting update activate. Physical iPhone installation and VoiceOver acceptance remain pending.

## Development

Use Node 22.18+ and npm. Run `npm ci`, then `npm run dev`. Run `npm run check` for unit, TypeScript, production-build, content, browser, PWA and mobile checks. Browser tests require Playwright Chromium/WebKit (`npx playwright install --with-deps chromium webkit`) and a Chromium executable for the CDP suite (`COMMUNITY_CHROMIUM`). Tests serve the production app under its Pages base path.

`npm run audit:release` is a separate mandatory publication gate. It checks reviewed content, code authority, notices and public-history suitability; current concrete findings are recorded in the release decision. Passing the local content audit is not permission to publish. The deployment workflow uploads only `dist/` after all gates pass. No external catalog service or ongoing data synchronization is required.

See [contributing](CONTRIBUTING.md), [security](SECURITY.md), [notices](THIRD_PARTY_NOTICES.md), and [catalog review](docs/catalog-distribution-review.md).

This is an unofficial fan project, not affiliated with or endorsed by WeirdCo, CD PROJEKT RED or the creators of Cyberpunk. Game names and card identities belong to their respective owners. No card artwork is bundled. Application code uses MIT; see [LICENSE](LICENSE).
