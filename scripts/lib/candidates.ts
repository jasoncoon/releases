// Shared pieces for scripts that turn TMDB movies/shows into releases.yml
// entries: config, candidate building, duplicate detection and prompts.

import * as readline from "readline";
import {
  ROOT,
  imdbId,
  normalizeTitle,
  readYaml,
  splitSeason,
  tmdbRef,
  type Release,
} from "./releases.ts";
import {
  getMovie,
  getShow,
  movieDirectors,
  platformFor,
  tmdbUrl,
  usRelease,
  type Company,
} from "./tmdb.ts";

// ---------------------------------------------------------------- Config

export const CONFIG_FILE = `${ROOT}scripts/tmdb.yml`;

export type Config = {
  companies: { name: string; studio?: string; id?: number }[];
  directors: (string | { name: string; id?: number })[];
};

export const loadConfig = () => readYaml<Config>(CONFIG_FILE);

/** Maps a TMDB company id to the configured studio label. */
export type CompanyMap = Map<number, { name: string; studio?: string }>;

/**
 * Picks the Studio label for a production, using resolved company ids when
 * given, otherwise matching config entries by pinned id or exact name.
 */
export function studioMatcher(config: Config, resolved?: CompanyMap) {
  const lookup = (c: Company) =>
    resolved
      ? resolved.get(c.id)
      : config.companies?.find(
          (cc) => cc.id === c.id || cc.name.toLowerCase() === c.name.toLowerCase()
        );
  return (production: Company[]) => {
    const hits = production.filter((c) => lookup(c));
    return {
      studio: hits.length ? lookup(hits[0])!.studio : undefined,
      matched: hits.map((c) => c.name),
    };
  };
}
export type StudioMatcher = ReturnType<typeof studioMatcher>;

// ---------------------------------------------------------------- Candidates

export type Candidate = {
  key: string; // movie:123 or tv:456:s2
  title: string;
  date?: string; // YYYY-MM-DD, if TMDB has one
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

const imdbLink = (imdb: string) => `https://www.imdb.com/title/${imdb}`;

export async function movieCandidate(
  id: number,
  match: StudioMatcher,
  director?: string
): Promise<Candidate> {
  const movie = await getMovie(id);
  const { date, theatrical } = usRelease(movie);
  const dirs = movieDirectors(movie).map((d) => d.name);
  const { studio, matched } = match(movie.production_companies);
  const url = tmdbUrl("movie", id);
  return {
    key: `movie:${id}`,
    kind: "movie",
    title: movie.title,
    date,
    platform: theatrical ? "Theaters" : undefined,
    studio,
    notes: director,
    imdb: movie.imdb_id ?? undefined,
    link: movie.imdb_id ? imdbLink(movie.imdb_id) : url,
    url,
    season: 1,
    info: [
      date ? (theatrical ? "US theatrical" : "no US theatrical date") : "no date on TMDB",
      dirs.length ? `dir. ${dirs.join(", ")}` : "",
      matched.length ? `from ${matched.join(", ")}` : "",
    ].filter(Boolean),
  };
}

/** One candidate per (non-special) season of a show. */
export async function showCandidates(
  id: number,
  match: StudioMatcher
): Promise<Candidate[]> {
  const show = await getShow(id);
  const { studio, matched } = match(show.production_companies);
  const imdb = show.external_ids?.imdb_id ?? undefined;
  const url = tmdbUrl("tv", id);

  return show.seasons
    .filter((s) => s.season_number > 0)
    .map((s) => ({
      key: `tv:${id}:s${s.season_number}`,
      kind: "tv" as const,
      title:
        s.season_number === 1 ? show.name : `${show.name} Season ${s.season_number}`,
      date: s.air_date ?? undefined,
      platform: platformFor(show),
      studio,
      imdb,
      link: imdb ? imdbLink(imdb) : url,
      url: `${url}/season/${s.season_number}`,
      season: s.season_number,
      info: [
        show.networks[0] ? `on ${show.networks[0].name}` : "",
        matched.length ? `from ${matched.join(", ")}` : "",
      ].filter(Boolean),
    }));
}

export function describe(c: Candidate, label = "") {
  return [
    `${label}${c.date ?? "(no date)"}  ${c.title}  (${c.kind === "tv" ? "series" : "movie"})`,
    ...(c.info.length ? [`       ${c.info.join(" · ")}`] : []),
    `       ${c.url}`,
  ].join("\n");
}

// ---------------------------------------------------------------- Duplicates

/** Returns a function that finds the existing release matching a candidate. */
export function existingMatcher(releases: Release[]) {
  const keys = new Map<string, Release>();
  for (const r of releases) {
    const { season } = splitSeason(r.title);
    const imdb = imdbId(r.link);
    if (imdb) keys.set(`imdb:${imdb}#${season ?? 1}`, r);
    const ref = tmdbRef(r.link);
    if (ref)
      keys.set(
        ref.kind === "movie" ? `movie:${ref.id}` : `tv:${ref.id}:s${season ?? 1}`,
        r
      );
    keys.set(`title:${normalizeTitle(r.title)}`, r);
  }
  return (c: Candidate) =>
    keys.get(c.key) ??
    (c.imdb ? keys.get(`imdb:${c.imdb}#${c.season}`) : undefined) ??
    keys.get(`title:${normalizeTitle(c.title)}`);
}

// ---------------------------------------------------------------- Prompts

/**
 * Line-based prompts that queue input, so nothing is lost when input arrives
 * before a prompt (e.g. piped input). `prompt` resolves null once input ends.
 */
export function createPrompter() {
  const rl = readline.createInterface({ input: process.stdin });
  const pending: string[] = [];
  const waiting: ((line: string | null) => void)[] = [];
  let closed = false;
  rl.on("line", (line) => {
    const waiter = waiting.shift();
    if (waiter) waiter(line);
    else pending.push(line);
  });
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

  /** Asks for a field; Enter keeps `current`, "-" clears it. */
  async function ask(label: string, current?: string) {
    const answer = ((await prompt(`    ${label}${current ? ` [${current}]` : ""}: `)) ?? "").trim();
    return answer === "-" ? undefined : answer || current;
  }

  /** Lets the user review/edit each field of a candidate. */
  async function editRelease(c: Candidate): Promise<Release> {
    console.log("    (Enter keeps the value in brackets, - clears it)");
    const title = (await ask("Title", c.title)) ?? c.title;
    let date = await ask("Date", c.date);
    while (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(Date.parse(date))) {
      if (closed && !pending.length) throw new Error("A valid date is required.");
      console.log("    Please enter a date as YYYY-MM-DD.");
      date = await ask("Date", c.date);
    }
    return {
      title,
      date,
      studio: await ask("Studio", c.studio),
      platform: await ask("Platform", c.platform),
      notes: await ask("Notes", c.notes),
      link: c.link,
    };
  }

  return { prompt, ask, editRelease, close: () => rl.close() };
}
