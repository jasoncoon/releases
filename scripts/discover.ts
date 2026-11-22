// Finds upcoming movies and TV seasons on TMDB from the companies and directors
// in scripts/tmdb.yml, skips anything already in releases.yml (or previously
// declined), and asks whether to add each one.
//
//   npm run discover              # interactive
//   npm run discover -- --list    # just list candidates, change nothing

import * as fs from "fs";
import {
  ROOT,
  loadReleases,
  readYaml,
  saveReleases,
  today,
  writeYamlList,
} from "./lib/releases.ts";
import { REGION, allPages, tmdb, type Company } from "./lib/tmdb.ts";
import {
  createPrompter,
  describe,
  existingMatcher,
  loadConfig,
  movieCandidate,
  showCandidates,
  studioMatcher,
  type Candidate,
  type CompanyMap,
} from "./lib/candidates.ts";

const LIST_ONLY = process.argv.includes("--list");
const IGNORE_FILE = `${ROOT}scripts/tmdb-ignore.yml`;

type Ignored = { key: string; title: string };

const config = loadConfig();
const ignored: Ignored[] = fs.existsSync(IGNORE_FILE)
  ? (readYaml<Ignored[]>(IGNORE_FILE) ?? [])
  : [];
const releases = loadReleases();
const now = today();

// ---------------------------------------------------------------- Resolve config

async function resolveCompanies() {
  const map: CompanyMap = new Map();
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
const isUpcoming = (c: Candidate) => !!c.date && c.date >= now;

async function safely(label: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e) {
    console.warn(`  ! ${label}: ${(e as Error).message}`);
  }
}

async function gather() {
  console.log("Resolving companies and directors...");
  const companies = await resolveCompanies();
  const directors = await resolveDirectors();
  const match = studioMatcher(config, companies);
  const companyIds = [...companies.keys()].join("|");

  const addMovie = async (id: number, director?: string) => {
    const existing = candidates.get(`movie:${id}`);
    if (existing) {
      if (director && !existing.notes) existing.notes = director;
      return;
    }
    const c = await movieCandidate(id, match, director);
    if (isUpcoming(c)) candidates.set(c.key, c);
  };

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
    for (const s of shows)
      await safely(`series ${s.id}`, async () => {
        for (const c of await showCandidates(s.id, match))
          if (isUpcoming(c)) candidates.set(c.key, c);
      });
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

// ---------------------------------------------------------------- Main

await gather();

const existing = existingMatcher(releases);
const fresh = [...candidates.values()]
  .filter((c) => !existing(c) && !ignored.some((i) => i.key === c.key))
  .sort((a, b) => a.date!.localeCompare(b.date!) || a.title.localeCompare(b.title));

console.log(
  `\nFound ${candidates.size} upcoming on TMDB; ${fresh.length} not yet in releases.yml or ignored.\n`
);

const label = (i: number) => `[${i + 1}/${fresh.length}] `;

if (LIST_ONLY || !fresh.length) {
  fresh.forEach((c, i) => console.log(describe(c, label(i)) + "\n"));
  process.exit(0);
}

const { prompt, editRelease, close } = createPrompter();

let added = 0;
for (const [i, c] of fresh.entries()) {
  console.log(describe(c, label(i)));
  const answer = await prompt(
    "  Add? [y]es / [n]o, don't ask again / [s]kip / [q]uit (s): "
  );
  const choice = (answer ?? "q").trim().toLowerCase();

  if (choice === "q") break;
  if (choice === "n") {
    ignored.push({ key: c.key, title: `${c.title} (${c.date})` });
    writeYamlList(IGNORE_FILE, ignored);
  } else if (choice === "y") {
    releases.push(await editRelease(c));
    saveReleases(releases);
    added++;
  }
  console.log();
}
close();

console.log(`Added ${added} release${added === 1 ? "" : "s"} to releases.yml.`);
