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
npm run validate   # AJV + hard rules + CJK font coverage check
npm run build:data # writes public/generated + src/generated
npm run build      # validate → build:data → typecheck → vite build → prerender
npm run lint       # ESLint + design-token guard (scripts/check-tokens.ts)
npm run typecheck  # tsc for the app and for scripts/
npm run format     # Prettier
npm run images     # regenerate AVIF/WebP photo variants (after adding a photo)
npm run fonts      # regenerate the CJK font subsets (when validate warns)
npm run new-item -- my-object
```

**Before deploying:** set the real site origin in `src/config/site.ts` (`SITE_URL`, currently a placeholder) or pass it at build time: `SITE_URL=https://things-atlas.com npm run build`. It is used for canonical URLs, Open Graph, JSON-LD, `sitemap.xml` and `robots.txt`.

## Stack (MVP)

| Layer | Choice |
| --- | --- |
| App | Vite 6 + React 18 + TypeScript |
| Map | MapLibre GL JS + OpenFreeMap Positron vector tiles (`https://tiles.openfreemap.org/styles/positron`), re-inked at runtime in `src/lib/theme.ts` |
| Data | `data/items/*.json` in git |
| CI | GitHub Actions `validate.yml` |

Basemap is **OpenFreeMap** (free, no API key; © OpenMapTiles / OpenStreetMap — keep the attribution). `tuneBasemap()` recolors it to the warm atlas-paper palette and `localizeBasemap()` switches place labels between 中文 and English. Fonts: Source Serif 4 + Noto Serif SC (display), Inter + Noto Sans SC (UI), all self-hosted — Latin faces from `@fontsource-variable/*`, CJK faces as subsets built by `npm run fonts` (only the characters the site uses, split into a small first-view file and an entry-text file).

## Design tokens

All colours, type sizes, spacing, radii, shadows, z-index layers, durations and breakpoints live in `src/styles/tokens.css` as CSS custom properties; components only use `var(--…)`. Values needed in TypeScript (MapLibre paint colours, category colours, media queries) come from `src/lib/tokens.ts`, which mirrors the CSS. `npm run lint` fails if the two drift apart or if a raw colour literal appears outside `tokens.css`.

## Performance & SEO

- `npm run build` prerenders `/` and every entry at `/item/<id>/` (`scripts/prerender.ts`): real HTML for the first paint, per-page title/description/canonical/hreflang/Open Graph/Twitter card, JSON-LD (WebSite, DefinedTermSet + ItemList; DefinedTerm + BreadcrumbList on entries), a `<noscript>` catalogue, `sitemap.xml` and `robots.txt`.
- MapLibre (~800 kB) is a lazy chunk; the page shell paints before it loads.
- Photos are served as responsive AVIF/WebP (`public/images/opt/`, built by `npm run images`) with intrinsic sizes.
- `public/_headers` sets long-lived caching for hashed `/assets/*` (Cloudflare Pages / Netlify format).
- `?lang=en` selects English; the selected entry lives in the path (`/item/zipper/`), the year and categories in the query (`?y=&cat=`). Old `?id=` links still work.

## Data model (locked)

One file per item: `data/items/{id}.json`. Field names follow the Spec:

- `id`, `name_zh`, `name_en`, `category`
- `years.{invention,patent,mass_production,popularization}` → `YearMark | null`
- `locations[]` (≥1) with bilingual place labels, `kind`, `confidence`, optional `year_override`
- `confidence`, `sources[]`, `disputed`, `summary_zh` / `summary_en`, `updated`
- optional `primary` (`invention|patent|mass_production|popularization`), `image`, `notes`, `tags`

**`primary_year` is not stored.** Build derives it (`src/lib/primaryYear.ts`): if the item sets `primary` and that mark is non-null, use it; otherwise the first non-null of `invention → patent → mass_production → popularization`. Item-level `confidence` is one of `exact|year|decade|century|disputed`.

Optional `image` (local path under `public/images/` preferred) is shown in the item drawer; credits live in `public/images/CREDITS.md`. Year-mark `ref` / `ref_zh` and `notes` / `notes_en` keep the drawer fully bilingual.

Schema: `data/schema/item.schema.json`. Teaching copies: `data/examples/`.

## UI shell

- Full-viewport MapLibre map with GeoJSON pins (one feature per location)
- Timeline scrubber filtered by derived `primary_year` — always **cumulative** (`≤ year`)
- Category chips + disputed visibility
- Item drawer with four year rows, places, sources
- URL sync: `/item/<id>/?y=&cat=&lang=`

## Scripts

| Script | Role |
| --- | --- |
| `scripts/validate-items.ts` | AJV 2020-12 + id/filename, sources, disputed notes, food-tag blacklist |
| `scripts/build-index.ts` | `src/generated/items-index.json` (app) + `public/generated/` (open-data JSON/GeoJSON export) |
| `scripts/build-images.ts` | AVIF/WebP variants + `data/images.json` (sizes) |
| `scripts/build-fonts.ts` | CJK font subsets + `src/styles/fonts.css`; `--check` reports missing characters |
| `scripts/prerender.ts` | static HTML, SEO tags, sitemap, robots (runs after `vite build`) |
| `scripts/check-tokens.ts` | design-token guard (part of `npm run lint`) |
| `scripts/new-item.ts` | empty item scaffold |

## MVP slice

Pocket & desk (~80–150 items later). Sample set shipped: zipper (multi-location), sticky-note (year split), ballpoint-pen (`disputed=true`), paperclip.

## Disclaimer

The basemap shows **modern political borders**; coordinates are approximate historical/narrative places, not surveyed monuments.
