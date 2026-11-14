# Contributing to Things Atlas

Thank you for helping map everyday objects.

## License

- **Code** (everything outside `data/`): MIT
- **Item data** (`data/items/*.json` and derived indexes): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

By opening a PR you agree to license your code under MIT and your item JSON under CC BY 4.0.

## Add an item

This workflow is intended for both human contributors and AI agents. Maintainers review the resulting PR; contributors remain responsible for checking facts and licenses.

### Scope principle: reject pure subsidiary variants, embrace paradigm-shifting independent categories (拒绝纯附庸变体，拥抱范式革命型独立品类)

Things Atlas documents origins and spatial movements of objects that reshaped human everyday life. When proposing or reviewing items, adhere strictly to this boundary:

- **Do NOT add pure subsidiary variants (纯附庸变体不独立建档)**: Do not create separate entries for items that share the same core working principle and merely scale dimensions, alter packaging, or add minor mechanical accessories. Mention them as milestones or notes within the parent entry:
  - ❌ *Vehicular variants*: tricycles, unicycles, or folding bicycles derived from the bicycle.
  - ❌ *Stationery variants*: mechanical pencils derived from the pencil; correction tape derived from correction fluid; scrunchies derived from the rubber band.
  - ❌ *Packaging / brewing auxiliaries*: tea bags derived from tea; coffee filter paper derived from coffee; zippered storage bags (Ziploc) derived from plastic bags.
- **DO add paradigm-shifting independent categories (范式革命型独立品类积极建档)**: Even within the same broad domain, items whose working principles underwent a radical, foundational leap, possess independent patent and industrial histories, and fundamentally reshaped daily human behavior MUST be documented as distinct entries:
  - ✔️ **Ballpoint pen (`ballpoint-pen`)**: Replaced capillary liquid ink with precision ball bearings and high-viscosity paste ink.
  - ✔️ **Utility knife (`utility-knife`)**: Replaced fixed-blade regrinding with snap-off pre-scored segmented blades.
  - ✔️ **Safety razor (`safety-razor`)**: Replaced exposed straight razors with thin double-edge disposable blades in a protective guard.
  - ✔️ **Rolling suitcase (`rolling-suitcase`)**: Upright dual-wheel and telescoping handle architecture that fundamentally transformed global travel logistics.
  - ✔️ **Folding umbrella (`folding-umbrella`)**: Articulated kinematic linkage mechanism transforming rigid canopies into handheld compact gear.
  - ✔️ **Tablet (`tablet`)**: Direct multi-touch capacitive glass interaction replacing indirect mouse/keyboard manipulation, unlocking ubiquitous deskless computing.
  - ✔️ **Backpack (`backpack`)**: Independent framed burden-carrying lineage spanning from Ötzi's 3300 BCE alpine hazel frame to modern ergonomic nylon daypacks.

1. Fork the repository on GitHub, clone your fork, and create a topic branch such as `git switch -c add/your-slug`. Install the existing dependencies with `npm ci` (Node.js 20, matching CI). Do not add dependencies just to create an entry.
2. Check `data/items/` for duplicate names, aliases, or equivalent objects. The subject should still be in daily circulation, widely known, and in a category listed by `data/schema/item.schema.json`. Foods and beverages are welcome, including specific branded products with broad cultural reach. Define whether the entry covers a general object, food type, or specific product. A brand's launch is not the invention of the entire food type. Document a product launch in the milestone matching the evidence (production or popularization), explaining its meaning in the bilingual text; do not invent an invention date.
3. Research sources online before writing. Prefer museums, historical institutions, original patents, and other primary records. At least one source must be non-brand. Open each cited page and confirm that it supports the recorded claim; do not fabricate dates, locations, citations, or access dates. Distinguish invention, improvements, patents, commercial production, and popularization. Leave unsupported milestones `null` and use approximate precision or dispute notes where appropriate.
4. Scaffold with `npm run new-item -- your-slug`, then fill `data/items/your-slug.json` using the schema and existing entries as references. Complete Chinese and English names, summaries, milestone explanations (`ref_zh` / `ref`), and location labels. Set `updated` and source `accessed` dates accurately. Supply `years` (at least one mark), `locations` (≥1), `tags` (≥1 unique tag defined in `data/tags.json`), and `sources` (≥1 and **not brand-only**). The map's `primary_year` defaults to `invention`, falling back to `patent → mass_production → popularization`; optional `primary` can select another non-null mark. Coordinates and location confidence must reflect the evidence; do not substitute a company's headquarters for an unknown invention site. Use `year_override` for locations associated with a different year.
5. If `disputed: true`, write Chinese `notes` ≥ 40 characters covering the uncertainty or competing accounts, and matching `notes_en`. Essential scope qualifications also belong in the summaries, because the drawer only displays notes for disputed entries.
6. Add an appropriate openly licensed or public-domain photo under `public/images/your-slug.jpg`. Inspect the image and verify the original file page's author and license. Record `image.src`, bilingual alt text, `credit`, `license`, and `source_url` in the JSON, and follow `public/images/CREDITS.md`. Do not assume an image found through search is reusable. If a suitable image or supporting source cannot be obtained, report the gap instead of inventing it.
7. Run `npm run images` to create AVIF/WebP variants, update `data/images.json`, and rebuild indexes. Run `npm run fonts` to update the Chinese font subsets after adding text. Include the required image variants, image manifest, font assets, charset, and font CSS in the PR; generated indexes under `src/generated/` and `public/generated/` are ignored and should not be force-added.
8. Run `npm run validate`, `npm run lint`, and a production build. Install the matching browser once with `npx playwright-core install --only-shell chromium`. For data-only contributions, use `npm run build:data && npm run build:share && npx --no-install vite build && node --import tsx scripts/prerender.ts && npm run test:share:assets`; this checks bundling and prerendering without an unrelated project-wide TypeScript check. Run Prettier checks only on changed text files, not a repository-wide format rewrite. Start `npm run dev` to verify search, timeline visibility at the selected milestone, map pins, images, and details in both languages; stop the server you started afterward. Report any check you could not perform.
9. Review the diff: include only the new entry and necessary generated assets, preserve unrelated files, and confirm no credentials or temporary research files are staged. Commit and push the topic branch to your fork, then open a PR against the upstream default branch using the PR template. Include a summary, date rationale, disputes, image attribution, and validation results. AI agents should prepare the changes and PR description for contributor review, and only publish when the contributor authorizes it.

## Examples

See existing entries in `data/items/`:

- **zipper** (`data/items/zipper.json`) — multiple locations / patent narrative
- **sticky-note** (`data/items/sticky-note.json`) — invention vs popularization split
- **ballpoint-pen** (`data/items/ballpoint-pen.json`) — `disputed: true` multi-place narrative
- **paperclip** (`data/items/paperclip.json`) — `disputed: true`, `patent: null` (Gem was never patented)

## Hard CI rules

- `id` matches filename; unique
- ≥1 non-null year mark; coordinates in range
- sources not brand-only
- `tags` is required, non-empty, unique, and every tag must exist in `data/tags.json`
- `primary`, if set, must point to a non-null year mark
- `disputed: true` requires Chinese `notes` ≥ 40 characters **and** a non-empty `notes_en`

Do not invent a single “invention year” UI field — keep the four year marks.

## Change records and releases

Do not add release notes for each development commit. Before a release or push, review all commits since the last release and the final diff, then write a concise bilingual summary in `data/changes.json`. Combine repeated work on the same feature and omit superseded implementations. Cover user-visible features, UI, interactions, performance, fixes, and entry additions or corrections; exclude build configuration, CI, tests, documentation, and internal refactoring as standalone release notes.

Each summary point has a unique `id`, the previous published version as `afterVersion`, and Chinese `zh` / English `en` text. Unpublished drafts may be consolidated; published historical records must remain intact. See [AGENTS.md](AGENTS.md) for identifying the release boundary and handling an initial release.

A maintainer supplies the next numeric `major.minor.patch` version. Commit the summary under the old version before the version-only release commit; do not create a Git tag. The build uses full Git history to group summaries by their released versions and bundles the history for the version badge’s tabbed release-notes dialog. Run `npm run test:updates` before release. Before pushing, present the version, commit range, final notes, and validation results for the user's explicit confirmation, even if the initial request was to push.
