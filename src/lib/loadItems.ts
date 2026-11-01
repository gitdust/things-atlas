import index from '../generated/items-index.json';
import categoriesJson from '../../data/categories.json';
import type { AtlasItem, CategoryMeta, ItemsIndex } from './types';

export function loadItemsIndex(): ItemsIndex {
  return index as ItemsIndex;
}

export function loadCategories(): CategoryMeta[] {
  return categoriesJson.categories as CategoryMeta[];
}

export function findItem(
  items: AtlasItem[],
  id: string | null,
): AtlasItem | null {
  if (!id) return null;
  return items.find((i) => i.id === id) ?? null;
}
