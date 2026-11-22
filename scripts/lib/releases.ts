// Load, validate, normalize and save _data/releases.yml.

import * as fs from "fs";
import { fileURLToPath } from "url";
import yaml from "js-yaml";

export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const RELEASES_FILE = `${ROOT}_data/releases.yml`;

export const KEYS = [
  "title",
  "date",
  "studio",
  "platform",
  "notes",
  "link",
] as const;

export type Release = {
  title: string;
  date: string; // YYYY-MM-DD
  studio?: string;
  platform?: string;
  notes?: string;
  link?: string;
};

// Platforms that are games, not movies/series (TMDB doesn't cover them).
export const GAME_PLATFORMS = ["Switch", "Switch 2"];

/** Reads YAML with dates kept as plain strings (not JS Dates). */
export function readYaml<T>(file: string): T {
  return yaml.load(fs.readFileSync(file, "utf8"), {
    schema: yaml.CORE_SCHEMA,
  }) as T;
}

export function writeYamlList(file: string, items: object[]) {
  fs.writeFileSync(
    file,
    items
      .map((item) =>
        yaml.dump([item], {
          schema: yaml.CORE_SCHEMA,
          quotingType: '"',
          lineWidth: -1,
        })
      )
      .join("\n")
  );
}

/** Loads and normalizes releases. Throws listing every problem found. */
export function loadReleases(): Release[] {
  const raw = readYaml<Record<string, unknown>[]>(RELEASES_FILE) ?? [];
  const errors: string[] = [];

  const items = raw.map((entry) => {
    const item: Partial<Release> = {};
    for (const key of KEYS) {
      const value = entry[key];
      if (value === null || value === undefined || String(value).trim() === "")
        continue;
      item[key] = String(value).trim();
    }

    const date = item.date?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (!item.title) errors.push(`Missing title: ${JSON.stringify(entry)}`);
    if (!date || isNaN(Date.parse(date)))
      errors.push(`Invalid date for "${item.title}": ${item.date}`);
    else item.date = date;

    const unknown = Object.keys(entry).filter(
      (k) => k !== "release" && !(KEYS as readonly string[]).includes(k)
    );
    if (unknown.length)
      errors.push(`Unknown field(s) on "${item.title}": ${unknown.join(", ")}`);

    return item as Release;
  });

  if (errors.length) throw new Error(errors.join("\n"));
  return items;
}

/** Sorts by date then title, and writes the file in canonical form. */
export function saveReleases(items: Release[]) {
  const sorted = [...items].sort(
    (a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)
  );
  // Rebuild each item so keys are always written in KEYS order.
  writeYamlList(
    RELEASES_FILE,
    sorted.map((item) =>
      Object.fromEntries(
        KEYS.filter((k) => item[k] !== undefined && item[k] !== "").map(
          (k) => [k, item[k]]
        )
      )
    )
  );
}

/** Today's date in local time, as YYYY-MM-DD. */
export function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function imdbId(link?: string): string | undefined {
  return link?.match(/imdb\.com\/title\/(tt\d+)/)?.[1];
}

export function tmdbRef(
  link?: string
): { kind: "movie" | "tv"; id: number } | undefined {
  const m = link?.match(/themoviedb\.org\/(movie|tv)\/(\d+)/);
  return m ? { kind: m[1] as "movie" | "tv", id: Number(m[2]) } : undefined;
}

/** Splits "Show: Season 3" / "Show Season 3" into its base title and season. */
export function splitSeason(title: string): { base: string; season?: number } {
  const m = title.match(/^(.*?):?\s+Season\s+(\d+)$/i);
  return m ? { base: m[1], season: Number(m[2]) } : { base: title };
}

/** Lowercase alphanumerics only, for loose title comparison. */
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
