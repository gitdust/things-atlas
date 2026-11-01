# Things Atlas · 日常之物图志

Open-source static site: a **world map + year scrubber** for everyday objects (no food). Pins mark invention / patent / mass production / popularization places. Planned domain: [things-atlas.com](https://things-atlas.com).

- **English name:** Things Atlas  
- **Chinese subtitle:** 日常之物图志  
- **License:** code MIT · item data CC BY 4.0 (see `LICENSE`, `CONTRIBUTING.md`)

## Quick start

```bash
cd ~/codespace/things-atlas
npm install
npm run dev
```

Then open the printed local URL (Vite default `http://localhost:5173`).

```bash
npm run validate   # AJV + hard rules
npm run build:data # writes public/generated + src/generated
npm run build      # validate → build:data → typecheck → vite build
npm run new-item -- my-object
```

## Stack (MVP)

| Layer | Choice |
| --- | --- |
| App | Vite 6 + React 18 + TypeScript |
| Map | MapLibre GL JS + OpenFreeMap Positron vector tiles (`https://tiles.openfreemap.org/styles/positron`), re-inked at runtime in `src/lib/theme.ts` |
| Data | `data/items/*.json` in git |
| CI | GitHub Actions `validate.yml` |

Basemap is **OpenFreeMap** (free, no API key; © OpenMapTiles / OpenStreetMap — keep the attribution). `tuneBasemap()` recolors it to the warm atlas-paper palette and `localizeBasemap()` switches place labels between 中文 and English. Fonts: Source Serif 4 + Noto Serif SC (display), Inter + Noto Sans SC (UI), via Google Fonts.

## Data model (locked)

One file per item: `data/items/{id}.json`. Field names follow the Spec:

- `id`, `name_zh`, `name_en`, `category`
- `years.{invention,patent,mass_production,popularization}` → `YearMark | null`
- `locations[]` (≥1) with bilingual place labels, `kind`, `confidence`, optional `year_override`
- `confidence`, `sources[]`, `disputed`, `summary_zh` / `summary_en`, `updated`
- optional `primary` (`invention|patent|mass_production|popularization`), `notes`, `tags`

**`primary_year` is not stored.** Build derives it (`src/lib/primaryYear.ts`): if the item sets `primary` and that mark is non-null, use it; otherwise the first non-null of `invention → patent → mass_production → popularization`. Item-level `confidence` is one of `exact|year|decade|century|disputed`.

Schema: `data/schema/item.schema.json`. Teaching copies: `data/examples/`.

## UI shell

- Full-viewport MapLibre map with GeoJSON pins (one feature per location)
- Timeline scrubber filtered by derived `primary_year`
- Toggle: **cumulative** (`≤ year`) vs **snapshot** (`=== year`)
- Category chips + disputed visibility
- Item drawer with four year rows, places, sources
- URL sync: `?y=&mode=&cat=&id=`

## Scripts

| Script | Role |
| --- | --- |
| `scripts/validate-items.ts` | AJV 2020-12 + id/filename, sources, disputed notes, food-tag blacklist |
| `scripts/build-index.ts` | `items-index.json` + `items.geojson` |
| `scripts/new-item.ts` | empty item scaffold |

## MVP slice

Pocket & desk (~80–150 items later). Sample set shipped: zipper (multi-location), sticky-note (year split), ballpoint-pen (`disputed=true`), paperclip.

## Disclaimer

The basemap shows **modern political borders**; coordinates are approximate historical/narrative places, not surveyed monuments.
