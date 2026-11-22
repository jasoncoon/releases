// Minimal TMDB API client. Reads TMDB_TOKEN (API Read Access Token) or
// TMDB_API_KEY from the environment or from a .env file in the repo root.

import { ROOT } from "./releases.ts";

try {
  process.loadEnvFile(`${ROOT}.env`);
} catch {
  // No .env file; rely on the environment.
}

const BASE = process.env.TMDB_BASE_URL ?? "https://api.themoviedb.org/3";
const TOKEN = process.env.TMDB_TOKEN;
const API_KEY = process.env.TMDB_API_KEY;

if (!TOKEN && !API_KEY) {
  console.error(
    "Missing TMDB credentials. Add TMDB_TOKEN=<API Read Access Token> to .env\n" +
      "(see https://www.themoviedb.org/settings/api)."
  );
  process.exit(1);
}

export const REGION = "US";

const cache = new Map<string, Promise<unknown>>();

export function tmdb<T>(
  path: string,
  params: Record<string, string | number> = {}
): Promise<T> {
  const url = new URL(BASE + path);
  for (const [k, v] of Object.entries(params))
    url.searchParams.set(k, String(v));
  if (!TOKEN) url.searchParams.set("api_key", API_KEY!);

  const key = url.toString();
  if (!cache.has(key)) cache.set(key, fetchJson(url));
  return cache.get(key) as Promise<T>;
}

async function fetchJson(url: URL, attempt = 1): Promise<unknown> {
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
  if (res.status === 429 && attempt <= 3) {
    const wait = Number(res.headers.get("retry-after") ?? 1) * 1000;
    await new Promise((r) => setTimeout(r, wait));
    return fetchJson(url, attempt + 1);
  }
  if (!res.ok) {
    url.searchParams.delete("api_key");
    throw new Error(`TMDB ${res.status} ${res.statusText}: ${url.pathname}`);
  }
  return res.json();
}

/** Fetches every page of a paged endpoint (capped to avoid runaway queries). */
export async function allPages<T>(
  path: string,
  params: Record<string, string | number>,
  maxPages = 20
): Promise<T[]> {
  const results: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const data = await tmdb<{ results: T[]; total_pages: number }>(path, {
      ...params,
      page,
    });
    results.push(...data.results);
    if (page >= data.total_pages) break;
  }
  return results;
}

// ---------------------------------------------------------------- Movies

export type Company = { id: number; name: string };

export type Movie = {
  id: number;
  title: string;
  release_date: string;
  imdb_id: string | null;
  production_companies: Company[];
  release_dates: {
    results: {
      iso_3166_1: string;
      release_dates: { type: number; release_date: string }[];
    }[];
  };
  credits: { crew: { id: number; job: string; name: string }[] };
};

export const getMovie = (id: number) =>
  tmdb<Movie>(`/movie/${id}`, { append_to_response: "release_dates,credits" });

// TMDB release types: 1 Premiere, 2 Limited, 3 Theatrical, 4 Digital, 5 Physical, 6 TV.
const THEATRICAL = 3;
const LIMITED = 2;
const DIGITAL = 4;

/**
 * The US release date: wide theatrical, then limited, then digital, falling
 * back to TMDB's primary release date when there are no US dates.
 */
export function usRelease(movie: Movie): {
  date?: string;
  theatrical: boolean;
} {
  const us =
    movie.release_dates?.results.find((r) => r.iso_3166_1 === REGION)
      ?.release_dates ?? [];
  const earliest = (type: number) =>
    us
      .filter((d) => d.type === type)
      .map((d) => d.release_date.slice(0, 10))
      .sort()[0];

  const theatrical = earliest(THEATRICAL) ?? earliest(LIMITED);
  if (theatrical) return { date: theatrical, theatrical: true };
  const digital = earliest(DIGITAL);
  if (digital) return { date: digital, theatrical: false };
  return { date: movie.release_date || undefined, theatrical: false };
}

export const movieDirectors = (movie: Movie) =>
  movie.credits?.crew.filter((c) => c.job === "Director") ?? [];

// ---------------------------------------------------------------- TV

export type Show = {
  id: number;
  name: string;
  first_air_date: string;
  networks: Company[];
  production_companies: Company[];
  seasons: { season_number: number; air_date: string | null; name: string }[];
  external_ids: { imdb_id: string | null };
};

export const getShow = (id: number) =>
  tmdb<Show>(`/tv/${id}`, { append_to_response: "external_ids" });

// Map TMDB network names to the platform names used in releases.yml.
const NETWORKS: Record<string, string> = {
  "Disney+": "Disney+",
  Netflix: "Netflix",
  HBO: "HBO Max",
  "HBO Max": "HBO Max",
  Max: "HBO Max",
  "Prime Video": "Amazon",
  "Amazon Prime Video": "Amazon",
  "Apple TV+": "Apple",
  "Apple TV": "Apple",
  YouTube: "YouTube",
  Hulu: "Hulu",
  Peacock: "Peacock",
  "Paramount+": "Paramount+",
};

export function platformFor(show: Show): string | undefined {
  const network = show.networks[0]?.name;
  return network ? (NETWORKS[network] ?? network) : undefined;
}

// ---------------------------------------------------------------- Lookup

export async function findByImdb(imdb: string) {
  const r = await tmdb<{
    movie_results: { id: number }[];
    tv_results: { id: number }[];
  }>(`/find/${imdb}`, { external_source: "imdb_id" });
  if (r.movie_results[0]) return { kind: "movie" as const, id: r.movie_results[0].id };
  if (r.tv_results[0]) return { kind: "tv" as const, id: r.tv_results[0].id };
  return undefined;
}

export const tmdbUrl = (kind: "movie" | "tv", id: number) =>
  `https://www.themoviedb.org/${kind}/${id}`;
