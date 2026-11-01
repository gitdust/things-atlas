import type { AtlasItem } from './types';
import type { Feature, FeatureCollection, Point } from 'geojson';

export type ItemFeatureProps = {
  id: string;
  location_index: number;
  name_zh: string;
  name_en: string;
  category: string;
  primary_year: number;
  disputed: boolean;
  kind: string;
  place_label_zh: string;
  place_label_en: string;
  year_override: number | null;
};

export function itemsToGeoJSON(items: AtlasItem[]): FeatureCollection<Point, ItemFeatureProps> {
  const features: Feature<Point, ItemFeatureProps>[] = [];
  for (const item of items) {
    item.locations.forEach((loc, location_index) => {
      features.push({
        type: 'Feature',
        id: `${item.id}#${location_index}`,
        geometry: {
          type: 'Point',
          coordinates: [loc.lng, loc.lat],
        },
        properties: {
          id: item.id,
          location_index,
          name_zh: item.name_zh,
          name_en: item.name_en,
          category: item.category,
          primary_year: item.primary_year,
          disputed: item.disputed,
          kind: loc.kind,
          place_label_zh: loc.place_label_zh,
          place_label_en: loc.place_label_en,
          year_override: loc.year_override ?? null,
        },
      });
    });
  }
  return { type: 'FeatureCollection', features };
}
