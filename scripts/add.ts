// Adds a release to _data/releases.yml from TMDB (or IMDb) and lets you
// review each field before saving.
//
//   npm run add -- https://www.themoviedb.org/movie/1061474-superman
//   npm run add -- https://www.themoviedb.org/tv/83867/season/2
//   npm run add -- movie/1061474        (or tv/83867, movie:1061474)
//   npm run add -- tt5950044            (IMDb id or URL)
//   npm run add -- 83867 --tv --season 2
//   npm run add -- <ref> --yes          (accept TMDB's values without prompts)
//
// For a series with no season given, the next upcoming season is used,
// otherwise the latest one.

import { loadReleases, saveReleases, today } from "./lib/releases.ts";
import { findByImdb } from "./lib/tmdb.ts";
import {
  createPrompter,
  describe,
  existingMatcher,
  loadConfig,
  movieCandidate,
  showCandidates,
  studioMatcher,
  type Candidate,
} from "./lib/candidates.ts";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const ref = args.find(
  (a, i) => !a.startsWith("--") && args[i - 1] !== "--season"
);

function usage(message?: string): never {
  if (message) console.error(message + "\n");
  console.error(
    "Usage: npm run add -- <TMDB URL | movie/ID | tv/ID | IMDb id/URL | ID [--tv]> [--season N] [--yes]"
  );
  process.exit(1);
}

type Ref = { kind: "movie" | "tv"; id: number; season?: number };

async function parseRef(input: string): Promise<Ref> {
  const tmdb = input.match(/\b(movie|tv)[/:](\d+)(?:[^/\s]*\/season\/(\d+))?/);
  if (tmdb)
    return {
      kind: tmdb[1] as Ref["kind"],
      id: Number(tmdb[2]),
      season: tmdb[3] ? Number(tmdb[3]) : undefined,
    };

  const imdb = input.match(/\btt\d+\b/)?.[0];
  if (imdb) {
    const found = await findByImdb(imdb);
    if (!found) usage(`Nothing on TMDB for IMDb id ${imdb}.`);
    return found;
  }

  if (/^\d+$/.test(input))
    return { kind: flag("--tv") ? "tv" : "movie", id: Number(input) };

  usage(`Don't know how to read "${input}".`);
}

function pickSeason(seasons: Candidate[], wanted?: number): Candidate {
  if (!seasons.length) usage("That series has no seasons on TMDB.");
  if (wanted !== undefined) {
    const s = seasons.find((s) => s.season === wanted);
    if (!s)
      usage(
        `No season ${wanted}; TMDB has seasons ${seasons.map((s) => s.season).join(", ")}.`
      );
    return s;
  }
  const now = today();
  return (
    seasons.find((s) => s.date && s.date >= now) ??
    [...seasons].reverse().find((s) => s.date) ??
    seasons[seasons.length - 1]
  );
}

// ---------------------------------------------------------------- Main

if (!ref) usage();

const parsed = await parseRef(ref);
const seasonOption = option("--season");
if (seasonOption !== undefined && !/^\d+$/.test(seasonOption))
  usage(`--season needs a number.`);
const wantedSeason = seasonOption ? Number(seasonOption) : parsed.season;
if (wantedSeason !== undefined && parsed.kind === "movie")
  usage("--season only applies to series.");

const match = studioMatcher(loadConfig());
let candidate: Candidate;
try {
  candidate =
    parsed.kind === "movie"
      ? await movieCandidate(parsed.id, match)
      : pickSeason(await showCandidates(parsed.id, match), wantedSeason);
} catch (e) {
  usage(`Couldn't load ${parsed.kind}/${parsed.id} from TMDB: ${(e as Error).message}`);
}

const releases = loadReleases();
console.log(describe(candidate) + "\n");

const { prompt, editRelease, close } = createPrompter();
try {
  const duplicate = existingMatcher(releases)(candidate);
  if (duplicate) {
    console.log(
      `Already in releases.yml: "${duplicate.title}" (${duplicate.date}).`
    );
    const answer = flag("--yes")
      ? "n"
      : ((await prompt("Add anyway? [y/N]: ")) ?? "").trim().toLowerCase();
    if (answer !== "y") process.exit(0);
  }

  let release;
  if (flag("--yes")) {
    if (!candidate.date) usage("TMDB has no date for this; run without --yes to enter one.");
    const { title, date, studio, platform, notes, link } = candidate;
    release = { title, date, studio, platform, notes, link };
  } else {
    release = await editRelease(candidate);
  }

  releases.push(release);
  saveReleases(releases);
  console.log(`\nAdded "${release.title}" (${release.date}) to releases.yml.`);
} catch (e) {
  console.error((e as Error).message);
  process.exitCode = 1;
} finally {
  close();
}
