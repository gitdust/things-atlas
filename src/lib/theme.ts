import type { CategoryId } from './types';

export const CATEGORY_COLORS: Record<CategoryId, string> = {
  stationery: '#3b82f6',
  apparel_accessory: '#ec4899',
  hand_tool: '#f59e0b',
  home: '#10b981',
  personal_care: '#8b5cf6',
  digital: '#06b6d4',
  kitchen: '#64748b',
};

/** MapLibre demotiles — free demo style, no token */
export const MAP_STYLE = 'https://demotiles.maplibre.org/style.json';
