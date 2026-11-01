import type { AtlasItem, CategoryId, YearMode } from './types';

export function itemMatchesYear(
  item: AtlasItem,
  selectedYear: number,
  mode: YearMode,
): boolean {
  const y = item.primary_year;
  if (mode === 'cumulative') return y <= selectedYear;
  // snapshot: exact year; decade-precision marks widen ±5 via primary only for MVP
  return y === selectedYear;
}

export function filterItems(
  items: AtlasItem[],
  opts: {
    selectedYear: number;
    mode: YearMode;
    categories: CategoryId[];
    showDisputed: boolean;
  },
): AtlasItem[] {
  const catSet =
    opts.categories.length === 0 ? null : new Set(opts.categories);
  return items.filter((item) => {
    if (!opts.showDisputed && item.disputed) return false;
    if (catSet && !catSet.has(item.category)) return false;
    return itemMatchesYear(item, opts.selectedYear, opts.mode);
  });
}
