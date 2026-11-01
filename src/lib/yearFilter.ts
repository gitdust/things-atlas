import type { AtlasItem, CategoryId } from './types';

export function itemMatchesYear(item: AtlasItem, selectedYear: number): boolean {
  return item.primary_year <= selectedYear;
}

export function filterItems(
  items: AtlasItem[],
  opts: {
    selectedYear: number;
    categories: CategoryId[];
    showDisputed: boolean;
  },
): AtlasItem[] {
  const catSet =
    opts.categories.length === 0 ? null : new Set(opts.categories);
  return items.filter((item) => {
    if (!opts.showDisputed && item.disputed) return false;
    if (catSet && !catSet.has(item.category)) return false;
    return itemMatchesYear(item, opts.selectedYear);
  });
}
