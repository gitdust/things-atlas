/**
 * primary_year derivation (shared by build scripts and the app).
 *
 * Rule: if the item sets `primary` and that years.* mark is non-null, use it;
 * otherwise take the first non-null of invention → patent → mass_production → popularization.
 */
export const YEAR_KEYS = ['invention', 'patent', 'mass_production', 'popularization'] as const;

export type YearKey = (typeof YEAR_KEYS)[number];

/** Default fallback order when `primary` is unset (or points to a null mark). */
export const PRIMARY_YEAR_PRIORITY: readonly YearKey[] = YEAR_KEYS;

type MarkLike = { year: number } | null | undefined;

export function derivePrimaryYear(
  years: Partial<Record<YearKey, MarkLike>>,
  primary?: YearKey | null,
): number | null {
  if (primary) {
    const chosen = years[primary];
    if (chosen && typeof chosen.year === 'number') return chosen.year;
  }
  for (const key of PRIMARY_YEAR_PRIORITY) {
    const mark = years[key];
    if (mark && typeof mark.year === 'number') return mark.year;
  }
  return null;
}
