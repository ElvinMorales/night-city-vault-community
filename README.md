# Night City Vault — Community Edition

**A free, unofficial Cyberpunk TCG collection tracker for your phone and browser.**

**[Open Night City Vault](https://elvinmorales.github.io/night-city-vault-community/)** · [Report a problem or idea](https://github.com/ElvinMorales/night-city-vault-community/issues/new/choose)

This is an **early public beta**. You can try it without an account, but please keep a backup if you start tracking real cards. Built by a fan, not affiliated with or endorsed by WeirdCo, CD PROJEKT RED, or the creators of Cyberpunk.

## Getting started (no installation needed)

1. Open the app link on your phone or computer. The card catalog is already included.
2. In **Binder** or **Pack Desk**, search for a card and tap its **+** button.
3. Choose the printing/version if you recognize it. Otherwise select **Not sure which version** — you can identify it later.
4. Add your owned copies. Use **Playsets** to check progress and **Extras** for copies you might trade. Extras are **not** automatically marked for trade.
5. Go to **Settings → Back up my collection → Download full backup**. Save the `.ncv` file somewhere outside your browser.

You can also add personal card photos, record special or custom versions, and view Recent Activity or undo the most recent eligible change.

The included catalog has **151 gameplay card identities** and **860 source printing references**. These are not 860 verified physical treatments: foil, stamped, promo and completeness details may be uncertain. Please report errors rather than guessing a version.

## Important: your collection stays on this device

- **No login, cloud sync or automatic backups.** Copies, notes and personal photos are saved in this browser's local storage, not in your GitHub account or another phone.
- **Make regular full `.ncv` backups.** Browser data can be cleared or evicted. A full backup includes personal photos; a trade list or metadata export does **not**.
- **Restoring replaces the collection; it does not merge.** Preview the restore first and test it in an empty/disposable browser profile before trusting it.
- **Offline use starts only after a connected visit and the “Offline app ready” message.** Add to Home Screen is optional. Safari and Home Screen storage can differ, so test and back up before switching.
- **Card images aren't bundled.** You can add photos from your own device; don't upload copyrighted artwork or private collection files to public bug reports.

Read the [privacy and storage details](docs/privacy.md) and [security guidance](SECURITY.md) for more.

## Help make the beta better

If something breaks, a version looks wrong, or a screen is confusing, **[open a GitHub issue](https://github.com/ElvinMorales/night-city-vault-community/issues/new/choose)**. Choose **Bug report**, **Something confusing**, or **Feature idea**. Opening a GitHub issue requires a free GitHub account; if you don't have one, you can reply where you found the app shared.

Please use fictional or redacted examples. **Never post a full `.ncv` backup, personal card photo, credentials or private collection history.** Include your device/browser when you know it. There are no guaranteed support or fix times — this is a free hobby project.

**Known beta limits:** physical iPhone/Home Screen and VoiceOver acceptance are incomplete; browser storage is not guaranteed; catalog printing details can be uncertain. See the [community beta audit](docs/community-beta-audit.md).

## For contributors

The application is React, TypeScript and Vite, hosted on GitHub Pages with local-first IndexedDB storage and an offline service worker. Node 22.18+ and npm are required for local development.

Run `npm ci`, `npx playwright install --with-deps chromium webkit`, and `npm run check` for verification. Publication additionally requires `npm run audit:release` and protected GitHub Actions deployment. See [CONTRIBUTING.md](CONTRIBUTING.md) before changing data formats or reviewed assets.

Owner-controlled application code and original icons are MIT licensed within the scope of [LICENSE](LICENSE). Catalog metadata, names, franchise rights and third-party material are outside that license; [notices](THIRD_PARTY_NOTICES.md), [provenance](docs/catalog-distribution-review.md), and [licensing review](docs/code-licensing-review.md) provide details. No card artwork is bundled.
