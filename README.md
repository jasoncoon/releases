# Upcoming Releases

To add releases, add them to the `releases.yml` file: https://github.com/jasoncoon/releases/blob/main/_data/releases.yml

```yaml
- title: Dynamic Duo
  date: 2028-06-30
  studio: DC
  platform: Theaters
  notes: Animated # optional
  link: https://www.imdb.com/title/tt33549695 # optional
```

Entries can go anywhere in the file; the site sorts them by date. Run `npm run sort` to tidy and sort the file (it also validates dates).

## TMDB scripts

Put your TMDB API Read Access Token in `.env` (git-ignored) as `TMDB_TOKEN=...`.

- `npm run check` compares upcoming release dates with TMDB. Add `-- --all` to include released items, `-- --write` to apply changes.
- `npm run discover` suggests upcoming movies/series from the studios in [scripts/tmdb.yml](scripts/tmdb.yml), plus movies directed (not just produced) by the directors listed there, and asks before adding each. Declined items are remembered in `scripts/tmdb-ignore.yml`. Add `-- --list` to just list them.

Releases move from Upcoming to Released automatically in the browser based on the viewer's date, so no rebuild is needed when a release date passes.
