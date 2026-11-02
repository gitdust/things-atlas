# Contributing to Things Atlas

Thank you for helping map everyday objects.

## License

- **Code** (everything outside `data/`): MIT
- **Item data** (`data/items/*.json` and derived indexes): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

By opening a PR you agree to license your code under MIT and your item JSON under CC BY 4.0.

## Add an item

This workflow is intended for both human contributors and AI agents. Maintainers review the resulting PR; contributors remain responsible for checking facts and licenses.

1. Fork the repository on GitHub, clone your fork, and create a topic branch such as `git switch -c add/your-slug`. Install the existing dependencies with `npm ci` (Node.js 20, matching CI). Do not add dependencies just to create an entry.
2. Check `data/items/` for duplicate names, aliases, or equivalent objects. The subject should still be in daily circulation, widely known, and in a category listed by `data/schema/item.schema.json`. Foods and beverages are welcome, including specific branded products with broad cultural reach. Define whether the entry covers a general object, food type, or specific product. A brand's launch is not the invention of the entire food type. Document a product launch in the milestone matching the evidence (production or popularization), explaining its meaning in the bilingual text; do not invent an invention date.
3. Research sources online before writing. Prefer museums, historical institutions, original patents, and other primary records. At least one source must be non-brand. Open each cited page and confirm that it supports the recorded claim; do not fabricate dates, locations, citations, or access dates. Distinguish invention, improvements, patents, commercial production, and popularization. Leave unsupported milestones `null` and use approximate precision or dispute notes where appropriate.
4. Scaffold with `npm run new-item -- your-slug`, then fill `data/items/your-slug.json` using the schema and existing entries as references. Complete Chinese and English names, summaries, milestone explanations (`ref_zh` / `ref`), and location labels. Set `updated` and source `accessed` dates accurately. Supply `years` (at least one mark), `locations` (≥1), and `sources` (≥1 and **not brand-only**). The map's `primary_year` defaults to `invention`, falling back to `patent → mass_production → popularization`; optional `primary` can select another non-null mark. Coordinates and location confidence must reflect the evidence; do not substitute a company's headquarters for an unknown invention site. Use `year_override` for locations associated with a different year.
5. If `disputed: true`, write Chinese `notes` ≥ 40 characters covering the uncertainty or competing accounts, and matching `notes_en`. Essential scope qualifications also belong in the summaries, because the drawer only displays notes for disputed entries.
6. Add an appropriate openly licensed or public-domain photo under `public/images/your-slug.jpg`. Inspect the image and verify the original file page's author and license. Record `image.src`, bilingual alt text, `credit`, `license`, and `source_url` in the JSON, and follow `public/images/CREDITS.md`. Do not assume an image found through search is reusable. If a suitable image or supporting source cannot be obtained, report the gap instead of inventing it.
7. Run `npm run images` to create AVIF/WebP variants, update `data/images.json`, and rebuild indexes. Run `npm run fonts` to update the Chinese font subsets after adding text. Include the required image variants, image manifest, font assets, charset, and font CSS in the PR; generated indexes under `src/generated/` and `public/generated/` are ignored and should not be force-added.
8. Run `npm run validate`, `npm run lint`, and a production build. For data-only contributions, use `npm run build:data && npx --no-install vite build && node --import tsx scripts/prerender.ts`; this checks bundling and prerendering without an unrelated project-wide TypeScript check. Run Prettier checks only on changed text files, not a repository-wide format rewrite. Start `npm run dev` to verify search, timeline visibility at the selected milestone, map pins, images, and details in both languages; stop the server you started afterward. Report any check you could not perform.
9. Review the diff: include only the new entry and necessary generated assets, preserve unrelated files, and confirm no credentials or temporary research files are staged. Commit and push the topic branch to your fork, then open a PR against the upstream default branch using the PR template. Include a summary, date rationale, disputes, image attribution, and validation results. AI agents should prepare the changes and PR description for contributor review, and only publish when the contributor authorizes it.

## Examples

See `data/examples/` (also mirrored under `data/items/`):

- **zipper** — multiple locations / patent narrative
- **sticky-note** — invention vs popularization split
- **ballpoint-pen** — `disputed: true` multi-place narrative
- **paperclip** — `disputed: true`, `patent: null` (Gem was never patented)

## Hard CI rules

- `id` matches filename; unique
- ≥1 non-null year mark; coordinates in range
- sources not brand-only
- `primary`, if set, must point to a non-null year mark
- `disputed: true` requires Chinese `notes` ≥ 40 characters **and** a non-empty `notes_en`

Do not invent a single “invention year” UI field — keep the four year marks.
