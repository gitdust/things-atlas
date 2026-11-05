import type { AtlasItem } from './types';

export function itemMatchesYear(item: AtlasItem, selectedYear: number): boolean {
  return item.primary_year <= selectedYear;
}

export function filterItems(
  items: AtlasItem[],
  opts: {
    selectedYear: number;
    showDisputed: boolean;
  },
): AtlasItem[] {
  return items.filter((item) => {
    if (!opts.showDisputed && item.disputed) return false;
    return itemMatchesYear(item, opts.selectedYear);
  });
}
