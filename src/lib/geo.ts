import type { AtlasItem, ItemLocation } from './types';
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';

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

export type ArcProps = {
  id: string;
  category: string;
  contested: boolean;
  direction: -1 | 0 | 1;
  start_year: number;
  end_year: number;
};

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

// The map uses Web Mercator; geographic poles cannot be projected to finite y.
const MAX_MERCATOR_LAT = toDeg(Math.atan(Math.sinh(Math.PI)));
const clampLat = (lat: number) => Math.max(-MAX_MERCATOR_LAT, Math.min(MAX_MERCATOR_LAT, lat));
export const mercatorY = (lat: number) =>
  Math.max(
    0,
    Math.min(1, (1 - Math.log(Math.tan(Math.PI / 4 + toRad(clampLat(lat)) / 2)) / Math.PI) / 2),
  );
const latitudeAtY = (y: number) => toDeg(Math.atan(Math.sinh(Math.PI * (1 - 2 * y))));

/**
 * A shallow visual association, not a navigation route. Great-circle routes
 * between China and North America can pass above 88°N and leave the Mercator
 * map. Curve in projected space instead, keeping the shortest longitude span
 * and bounding the bow so it cannot create a polar detour.
 */
function provenanceArc(a: [number, number], b: [number, number], steps = 48): [number, number][] {
  let deltaLng = b[0] - a[0];
  while (deltaLng > 180) deltaLng -= 360;
  while (deltaLng < -180) deltaLng += 360;
  const start: [number, number] = [a[0], clampLat(a[1])];
  const end: [number, number] = [a[0] + deltaLng, clampLat(b[1])];
  if (deltaLng === 0 && start[1] === end[1]) return [start, end];

  const y1 = mercatorY(start[1]);
  const y2 = mercatorY(end[1]);
  const distance = Math.hypot(deltaLng / 360, y2 - y1);
  // The quadratic's midpoint rises by at most 0.03 of the projected world.
  const controlY = Math.max(0, (y1 + y2) / 2 - Math.min(distance * 0.18, 0.06));
  const out: [number, number][] = [start];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const y = (1 - t) ** 2 * y1 + 2 * (1 - t) * t * controlY + t ** 2 * y2;
    out.push([a[0] + deltaLng * t, latitudeAtY(y)]);
  }
  out.push(end);
  return out;
}

/** Only explicit location years or dated milestone kinds establish direction. */
function locationYear(item: AtlasItem, location: ItemLocation): number | null {
  if (location.year_override != null) return location.year_override;
  const key = {
    invention: 'invention',
    patent: 'patent',
    production: 'mass_production',
    popularization: 'popularization',
    contested: null,
  } as const;
  const yearKey = key[location.kind];
  return yearKey ? (item.years[yearKey]?.year ?? null) : null;
}

/**
 * Thin "provenance" arcs: from each item's anchor place (first invention
 * location, else the first location) to each of its other places.
 */
export function itemsToArcs(items: AtlasItem[]): FeatureCollection<LineString, ArcProps> {
  const features: Feature<LineString, ArcProps>[] = [];
  for (const item of items) {
    if (item.locations.length < 2) continue;
    const anchorIdx = Math.max(
      0,
      item.locations.findIndex((l) => l.kind === 'invention'),
    );
    const anchor = item.locations[anchorIdx];
    const anchorYear = locationYear(item, anchor);
    item.locations.forEach((loc, i) => {
      if (i === anchorIdx) return;
      const targetYear = locationYear(item, loc);
      const direction =
        anchorYear == null || targetYear == null
          ? 0
          : (Math.sign(targetYear - anchorYear) as -1 | 0 | 1);
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: provenanceArc([anchor.lng, anchor.lat], [loc.lng, loc.lat]),
        },
        properties: {
          id: item.id,
          category: item.category,
          contested: loc.kind === 'contested',
          direction,
          start_year: anchorYear ?? item.primary_year,
          end_year: targetYear ?? item.primary_year,
        },
      });
    });
  }
  return { type: 'FeatureCollection', features };
}

/** Bounds include the displayed arcs in their continuous longitude world. */
export function itemBounds(item: AtlasItem): [[number, number], [number, number]] {
  const arcs = itemsToArcs([item]).features.flatMap((feature) => feature.geometry.coordinates);
  const points = arcs.length ? arcs : item.locations.map((loc) => [loc.lng, clampLat(loc.lat)]);
  const lngs = points.map(([lng]) => lng);
  const lats = points.map(([, lat]) => lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}
