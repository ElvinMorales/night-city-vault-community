import type { CatalogRelease } from './catalog';
import localCatalog from '../../local-catalog/catalog.json';
// Factual field/provenance review: docs/catalog-distribution-review.md. No upstream license implied.
export const packagedCatalog: CatalogRelease | null = localCatalog as CatalogRelease;
export const catalogBlocker = 'No built-in catalog selected. Manual and unknown printing entry remain available.';
