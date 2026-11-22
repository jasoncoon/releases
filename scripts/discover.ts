// Finds upcoming movies and TV seasons on TMDB from the companies and directors
// in scripts/tmdb.yml, skips anything already in releases.yml (or previously
// declined), and asks whether to add each one.
//
//   npm run discover              # interactive
//   npm run discover -- --list    # just list candidates, change nothing

import * as fs from "fs";
import * as readline from "readline";
import {
  ROOT,
  imdbId,
  loadReleases,
  normalizeTitle,
  readYaml,
  saveReleases,
  splitSeason,
  tmdbRef,
  today,
  writeYamlList,
  type Release,
} from "./lib/releases.ts";
import {
  REGION,
  allPages,
  movieDirectors,
  getMovie,
  getShow,
  platformFor,
  tmdb,
  tmdbUrl,
  usRelease,
  type Company,
} from "./lib/tmdb.ts";

const LIST_ONLY = process.argv.includes("--list");
const CONFIG_FILE = `${ROOT}scripts/tmdb.yml`;
const IGNORE_FILE = `${ROOT}scripts/tmdb-ignore.yml`;

type Config = {
  companies: { name: string; studio?: string; id?: number }[];
  directors: (string | { name: string; id?: number })[];
};
type Ignored = { key: string; title: string };

type Candidate = {
  key: string; // movie:123 or tv:456:s2
  title: string;
  date: string;
  kind: "movie" | "tv";
  platform?: string;
  studio?: string;
  notes?: string;
  link: string;
  url: string;
  imdb?: string;
  season: number; // 1 for movies
  info: string[];
};

const config = readYaml<Config>(CONFIG_FILE);
const ignored: Ignored[] = fs.existsSync(IGNORE_FILE)
  ? (readYaml<Ignored[]>(IGNORE_FILE) ?? [])
  : [];
const releases = loadReleases();
const now = today();

// ---------------------------------------------------------------- Resolve config

async function resolveCompanies() {
  const map = new Map<number, { name: string; studio?: string }>();
  for (const c of config.companies ?? []) {
    if (c.id) {
      map.set(c.id, c);
      continue;
    }
    const { results } = await tmdb<{ results: Company[] }>("/search/company", {
      query: c.name,
    });
    const exact = results.filter(
      (r) => r.name.toLowerCase() === c.name.toLowerCase()
    );
    if (!exact.length) {
      console.warn(
        `  ! No TMDB company named "${c.name}". Similar: ${
          results.slice(0, 5).map((r) => `${r.name} (${r.id})`).join(", ") || "none"
        }`
      );
    }
    for (const r of exact) map.set(r.id, { name: r.name, studio: c.studio });
  }
  return map;
}

async function resolveDirectors() {
  const directors: { id: number; name: string }[] = [];
  for (const p of config.directors ?? []) {
    const { name, id } = typeof p === "string" ? { name: p, id: undefined } : p;
    if (id) {
      directors.push({ id, name });
      continue;
    }
    const { results } = await tmdb<{
      results: { id: number; name: string; known_for_department: string }[];
    }>("/search/person", { query: name });
    const exact = results.filter(
      (r) => r.name.toLowerCase() === name.toLowerCase()
    );
    const best =
      exact.find((r) => r.known_for_department === "Directing") ?? exact[0];
    if (best) directors.push({ id: best.id, name: best.name });
    else console.warn(`  ! No TMDB person named "${name}".`);
  }
  return directors;
}

// ---------------------------------------------------------------- Gather

const candidates = new Map<string, Candidate>();
let companies: Awaited<ReturnType<typeof resolveCompanies>>;

function studioFor(production: Company[]) {
  const hit = production.find((c) => companies.has(c.id));
  return hit ? companies.get(hit.id)!.studio : undefined;
}

function matchedCompanies(production: Company[]) {
  return production.filter((c) => companies.has(c.id)).map((c) => c.name);
}

async function addMovie(id: number, director?: string) {
  const key = `movie:${id}`;
  const existing = candidates.get(key);
  if (existing) {
    if (director && !existing.notes) existing.notes = director;
    return;
  }

  const movie = await getMovie(id);
  const { date, theatrical } = usRelease(movie);
  if (!date || date < now) return;

  const dirs = movieDirectors(movie).map((d) => d.name);
  const matched = matchedCompanies(movie.production_companies);
  const url = tmdbUrl("movie", id);
  candidates.set(key, {
    key,
    kind: "movie",
    title: movie.title,
    date,
    platform: theatrical ? "Theaters" : undefined,
    studio: studioFor(movie.production_companies),
    notes: director,
    imdb: movie.imdb_id ?? undefined,
    link: movie.imdb_id ? `https://www.imdb.com/title/${movie.imdb_id}` : url,
    url,
    season: 1,
    info: [
      theatrical ? "US theatrical" : `no US theatrical date`,
      dirs.length ? `dir. ${dirs.join(", ")}` : "",
      matched.length ? `from ${matched.join(", ")}` : "",
    ].filter(Boolean),
  });
}

async function addShow(id: number) {
  const show = await getShow(id);
  const matched = matchedCompanies(show.production_companies);
  const imdb = show.external_ids?.imdb_id ?? undefined;
  const url = tmdbUrl("tv", id);

  for (const s of show.seasons) {
    if (s.season_number < 1 || !s.air_date || s.air_date < now) continue;
    const key = `tv:${id}:s${s.season_number}`;
    if (candidates.has(key)) continue;
    candidates.set(key, {
      key,
      kind: "tv",
      title:
        s.season_number === 1 ? show.name : `${show.name} Season ${s.season_number}`,
      date: s.air_date,
      platform: platformFor(show),
      studio: studioFor(show.production_companies),
      imdb,
      link: imdb ? `https://www.imdb.com/title/${imdb}` : url,
      url,
      season: s.season_number,
      info: [
        show.networks[0] ? `on ${show.networks[0].name}` : "",
        matched.length ? `from ${matched.join(", ")}` : "",
      ].filter(Boolean),
    });
  }
}

async function safely(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    console.warn(`  ! ${label}: ${(e as Error).message}`);
  }
}

async function gather() {
  console.log("Resolving companies and directors...");
  companies = await resolveCompanies();
  const directors = await resolveDirectors();
  const companyIds = [...companies.keys()].join("|");

  if (companyIds) {
    console.log(`Searching movies from ${companies.size} companies...`);
    const movies = await allPages<{ id: number }>("/discover/movie", {
      with_companies: companyIds,
      region: REGION,
      "release_date.gte": now,
      with_release_type: "2|3|4",
      sort_by: "primary_release_date.asc",
    });
    for (const m of movies) await safely(`movie ${m.id}`, () => addMovie(m.id));

    console.log(`Searching series from ${companies.size} companies...`);
    const shows = await allPages<{ id: number }>("/discover/tv", {
      with_companies: companyIds,
      "air_date.gte": now,
      sort_by: "popularity.desc",
    });
    for (const s of shows) await safely(`series ${s.id}`, () => addShow(s.id));
  }

  console.log(`Searching movies directed by ${directors.length} directors...`);
  for (const director of directors) {
    const { crew } = await tmdb<{
      crew: { id: number; job: string; release_date?: string }[];
    }>(`/person/${director.id}/movie_credits`);
    for (const c of crew) {
      if (c.job !== "Director" || !c.release_date || c.release_date < now) continue;
      await safely(`movie ${c.id}`, () => addMovie(c.id, director.name));
    }
  }
}

// ---------------------------------------------------------------- Filter known

function knownKeys(list: Release[]) {
  const keys = new Set<string>();
  for (const r of list) {
    const { season } = splitSeason(r.title);
    const imdb = imdbId(r.link);
    if (imdb) keys.add(`imdb:${imdb}#${season ?? 1}`);
    const ref = tmdbRef(r.link);
    if (ref)
      keys.add(ref.kind === "movie" ? `movie:${ref.id}` : `tv:${ref.id}:s${season ?? 1}`);
    keys.add(`title:${normalizeTitle(r.title)}`);
  }
  return keys;
}

function isKnown(c: Candidate, keys: Set<string>) {
  return (
    keys.has(c.key) ||
    (c.imdb !== undefined && keys.has(`imdb:${c.imdb}#${c.season}`)) ||
    keys.has(`title:${normalizeTitle(c.title)}`) ||
    ignored.some((i) => i.key === c.key)
  );
}

// ---------------------------------------------------------------- Main

await gather();

const known = knownKeys(releases);
const fresh = [...candidates.values()]
  .filter((c) => !isKnown(c, known))
  .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

console.log(
  `\nFound ${candidates.size} upcoming on TMDB; ${fresh.length} not yet in releases.yml or ignored.\n`
);

const describe = (c: Candidate, i: number) =>
  [
    `[${i + 1}/${fresh.length}] ${c.date}  ${c.title}  (${c.kind === "tv" ? "series" : "movie"})`,
    `       ${c.info.join(" · ")}`,
    `       ${c.url}`,
  ].join("\n");

if (LIST_ONLY || !fresh.length) {
  fresh.forEach((c, i) => console.log(describe(c, i) + "\n"));
  process.exit(0);
}

// Queue input lines so nothing is lost when input arrives before a prompt
// (e.g. piped input). Resolves null once input is closed.
const rl = readline.createInterface({ input: process.stdin });
const pending: string[] = [];
const waiting: ((line: string | null) => void)[] = [];
let closed = false;
rl.on("line", (line) => (waiting.shift() ?? ((l: string) => pending.push(l)))(line));
rl.on("close", () => {
  closed = true;
  waiting.splice(0).forEach((w) => w(null));
});
function prompt(question: string): Promise<string | null> {
  process.stdout.write(question);
  if (pending.length) return Promise.resolve(pending.shift()!);
  if (closed) return Promise.resolve(null);
  return new Promise((resolve) => waiting.push(resolve));
}

const ask = async (label: string, current?: string) => {
  const answer = ((await prompt(`    ${label}${current ? ` [${current}]` : ""}: `)) ?? "").trim();
  return answer === "-" ? undefined : answer || current;
};

let added = 0;
for (const [i, c] of fresh.entries()) {
  console.log(describe(c, i));
  const answer = await prompt(
    "  Add? [y]es / [n]o, don't ask again / [s]kip / [q]uit (s): "
  );
  const choice = (answer ?? "q").trim().toLowerCase();

  if (choice === "q") break;
  if (choice === "n") {
    ignored.push({ key: c.key, title: `${c.title} (${c.date})` });
    writeYamlList(IGNORE_FILE, ignored);
  } else if (choice === "y") {
    console.log("    (Enter keeps the value in brackets, - clears it)");
    const release: Release = {
      title: (await ask("Title", c.title)) ?? c.title,
      date: c.date,
      studio: await ask("Studio", c.studio),
      platform: await ask("Platform", c.platform),
      notes: await ask("Notes", c.notes),
      link: c.link,
    };
    releases.push(release);
    saveReleases(releases);
    added++;
  }
  console.log();
}
rl.close();

console.log(`Added ${added} release${added === 1 ? "" : "s"} to releases.yml.`);
