# Contributing to Things Atlas

Thank you for helping map everyday objects.

## License

- **Code** (everything outside `data/`): MIT
- **Item data** (`data/items/*.json` and derived indexes): [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)

By opening a PR you agree to license your code under MIT and your item JSON under CC BY 4.0.

## Add an item

1. Check the rubric: still in daily circulation, widely known, category in the enum, **not food**.
2. Scaffold: `npm run new-item -- your-slug`
3. Fill `years` (at least one mark; the map's `primary_year` defaults to `invention`, falling back to `patent → mass_production → popularization` — set optional `primary` to pick another mark), `locations` (≥1), `sources` (≥1 and **not brand-only**).
4. If `disputed: true`, write Chinese `notes` ≥ 40 characters covering both sides of the dispute, and a matching `notes_en` (the drawer shows these as 「争议说明 / Disputed note」 only for disputed entries).
5. If you add a photo under `public/images/`, run `npm run images` (AVIF/WebP variants + sizes) and credit it in `public/images/CREDITS.md`.
6. Run `npm run validate` and `npm run dev` to eyeball pins + drawer. If validate warns about characters missing from the CJK font subset, run `npm run fonts` and commit the result.
7. Open a PR with a one-line summary, year-rationale, and whether it is disputed.

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
- no food-related tags (`food`, `cuisine`, `recipe`, …)

Do not invent a single “invention year” UI field — keep the four year marks.
