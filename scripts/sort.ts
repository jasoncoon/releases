// Normalizes and sorts _data/releases.yml. Run with `npm run sort`.
//
// - Sorts by date, then title.
// - Normalizes `date` to YYYY-MM-DD (accepts any value starting with one).
// - Drops empty/null fields and the legacy `release` field.
// - Writes keys in a consistent order, with a blank line between entries.

import { loadReleases, saveReleases } from "./lib/releases.ts";

try {
  const items = loadReleases();
  saveReleases(items);
  console.log(`Sorted ${items.length} releases.`);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
