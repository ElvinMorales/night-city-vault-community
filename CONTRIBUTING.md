# Contributing

Owner-controlled software uses MIT; see LICENSE for scope. Submit only code you have authority to contribute under MIT. Third-party code must retain its compatible license and attribution.

Use fictional collections and synthetic personal-photo fixtures. Do not commit backups, private records, unpublished artwork, credentials or machine configuration. Keep storage changes backward compatible and retain migration, backup, PWA and mobile regressions.

Run `npm ci`, install the Playwright browsers, then `npm run check` and `npm run audit:release`. The release audit must pass in the independent public snapshot; retained private development ancestry intentionally fails its history gate. Factual metadata does not fail merely for lacking a separate license. Review source, dependency and dist changes before updating the SHA-256 inventory; never refresh it merely to silence a failure.

For a release, update CHANGELOG.md with player-visible changes, compatibility notes, backup advice and verification results. Follow docs/release-checklist.md. License authority and contributor terms must be agreed before accepting contributions for public distribution.
