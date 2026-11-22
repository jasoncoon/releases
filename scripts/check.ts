// Compares release dates in _data/releases.yml with TMDB.
//
//   npm run check             # upcoming releases only
//   npm run check -- --all    # include already-released items
//   npm run check -- --write  # apply date changes to releases.yml
//
// Items are matched by their link (IMDb or TMDB), falling back to a title
// search. Games (Switch, Switch 2) are skipped since TMDB doesn't cover them.

import {
  GAME_PLATFORMS,
  imdbId,
  loadReleases,
  normalizeTitle,
  saveReleases,
  splitSeason,
  tmdbRef,
  today,
  type Release,
} from "./lib/releases.ts";
import {
  findByImdb,
  getMovie,
  getShow,
  tmdb,
  tmdbUrl,
  usRelease,
} from "./lib/tmdb.ts";

const args = process.argv.slice(2);
const ALL = args.includes("--all");
const WRITE = args.includes("--write");

type Match = { kind: "movie" | "tv"; id: number; searched?: boolean };

async function resolve(item: Release): Promise<Match | undefined> {
  const ref = tmdbRef(item.link);
  if (ref) return ref;

  const imdb = imdbId(item.link);
  if (imdb) {
    const found = await findByImdb(imdb);
    if (found) return found;
  }

  // Fall back to an exact (normalized) title match.
  const { base } = splitSeason(item.title);
  const { results } = await tmdb<{
    results: { media_type: string; id: number; title?: string; name?: string }[];
  }>("/search/multi", { query: base });
  const hit = results.find(
    (r) =>
      (r.media_type === "movie" || r.media_type === "tv") &&
      normalizeTitle(r.title ?? r.name ?? "") === normalizeTitle(base)
  );
  return hit
    ? { kind: hit.media_type as "movie" | "tv", id: hit.id, searched: true }
    : undefined;
}

type Result = {
  item: Release;
  url?: string;
  tmdbTitle?: string;
  tmdbDate?: string;
  note?: string;
  searched?: boolean;
};

async function check(item: Release): Promise<Result> {
  const match = await resolve(item);
  if (!match) return { item };

  const url = tmdbUrl(match.kind, match.id);
  const base = { item, url, searched: match.searched };

  if (match.kind === "movie") {
    const movie = await getMovie(match.id);
    const { date, theatrical } = usRelease(movie);
    const note =
      date && item.platform === "Theaters" && !theatrical
        ? "no US theatrical date on TMDB"
        : undefined;
    return { ...base, tmdbTitle: movie.title, tmdbDate: date, note };
  }

  const show = await getShow(match.id);
  const { season } = splitSeason(item.title);
  const seasons = show.seasons.filter((s) => s.season_number > 0);

  if (season !== undefined) {
    const s = seasons.find((s) => s.season_number === season);
    return {
      ...base,
      tmdbTitle: `${show.name} Season ${season}`,
      tmdbDate: s?.air_date ?? undefined,
      note: s ? undefined : `TMDB has no season ${season}`,
    };
  }

  // No season in the title: compare against the season closest to our date.
  const dated = seasons.filter((s) => s.air_date);
  const distance = (d: string) =>
    Math.abs(Date.parse(d) - Date.parse(item.date));
  const closest = dated.sort(
    (a, b) => distance(a.air_date!) - distance(b.air_date!)
  )[0];
  return {
    ...base,
    tmdbTitle: closest ? `${show.name} Season ${closest.season_number}` : show.name,
    tmdbDate: closest?.air_date ?? (show.first_air_date || undefined),
  };
}

// ---------------------------------------------------------------- Main

const releases = loadReleases();
const now = today();
const targets = releases.filter(
  (r) => (ALL || r.date >= now) && !GAME_PLATFORMS.includes(r.platform ?? "")
);
const games = releases.filter(
  (r) => (ALL || r.date >= now) && GAME_PLATFORMS.includes(r.platform ?? "")
);

console.log(
  `Checking ${targets.length} ${ALL ? "" : "upcoming "}releases against TMDB...\n`
);

const results: Result[] = [];
for (const item of targets) {
  try {
    results.push(await check(item));
  } catch (e) {
    results.push({ item, note: (e as Error).message });
  }
}

const changed = results.filter((r) => r.tmdbDate && r.tmdbDate !== r.item.date);
const missingDate = results.filter((r) => r.url && !r.tmdbDate);
const notFound = results.filter((r) => !r.url);
const unchanged = results.filter((r) => r.tmdbDate === r.item.date);

const width = Math.max(0, ...results.map((r) => r.item.title.length));
const line = (r: Result, middle: string) => {
  const extras = [
    r.searched && r.tmdbTitle ? `matched "${r.tmdbTitle}" by title search` : "",
    r.note ?? "",
  ].filter(Boolean);
  return `  ${r.item.title.padEnd(width)}  ${middle}${r.url ? `  ${r.url}` : ""}${
    extras.length ? `\n  ${"".padEnd(width)}  (${extras.join("; ")})` : ""
  }`;
};

if (changed.length) {
  console.log("Date changes:");
  for (const r of changed) console.log(line(r, `${r.item.date} → ${r.tmdbDate}`));
  console.log();
}
if (missingDate.length) {
  console.log("Found on TMDB, but no date there:");
  for (const r of missingDate) console.log(line(r, r.item.date));
  console.log();
}
if (notFound.length) {
  console.log("Not found on TMDB:");
  for (const r of notFound) console.log(line(r, r.item.date));
  console.log();
}

const notes = unchanged.filter((r) => r.note || r.searched);
if (notes.length) {
  console.log("Unchanged, but worth a look:");
  for (const r of notes) console.log(line(r, r.item.date));
  console.log();
}

console.log(
  `${unchanged.length} unchanged, ${changed.length} changed, ` +
    `${missingDate.length + notFound.length} unverified` +
    (games.length ? `, ${games.length} games skipped.` : ".")
);

if (changed.length) {
  if (WRITE) {
    for (const r of changed) r.item.date = r.tmdbDate!;
    saveReleases(releases);
    console.log(`Updated ${changed.length} dates in releases.yml.`);
  } else {
    console.log("Run with --write to apply these date changes.");
  }
}
