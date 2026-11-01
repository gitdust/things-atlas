import type { AtlasItem } from './types';
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
};

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Great-circle interpolation between two [lng, lat] points. */
function greatCircle(a: [number, number], b: [number, number], steps = 48): [number, number][] {
  const [lng1, lat1] = [toRad(a[0]), toRad(a[1])];
  const [lng2, lat2] = [toRad(b[0]), toRad(b[1])];
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2 - lat1) / 2) ** 2 +
          Math.cos(lat1) * Math.cos(lat2) * Math.sin((lng2 - lng1) / 2) ** 2,
      ),
    );
  if (d === 0) return [a, b];
  const out: [number, number][] = [];
  let prevLng: number | null = null;
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lng1) + B * Math.cos(lat2) * Math.cos(lng2);
    const y = A * Math.cos(lat1) * Math.sin(lng1) + B * Math.cos(lat2) * Math.sin(lng2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    let lng = toDeg(Math.atan2(y, x));
    const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
    // keep the line continuous across the antimeridian
    if (prevLng != null) {
      while (lng - prevLng > 180) lng -= 360;
      while (lng - prevLng < -180) lng += 360;
    }
    prevLng = lng;
    out.push([lng, lat]);
  }
  return out;
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
    item.locations.forEach((loc, i) => {
      if (i === anchorIdx) return;
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: greatCircle([anchor.lng, anchor.lat], [loc.lng, loc.lat]),
        },
        properties: {
          id: item.id,
          category: item.category,
          contested: loc.kind === 'contested',
        },
      });
    });
  }
  return { type: 'FeatureCollection', features };
}

/** Bounds [[w,s],[e,n]] covering an item's places. */
export function itemBounds(item: AtlasItem): [[number, number], [number, number]] {
  const lngs = item.locations.map((l) => l.lng);
  const lats = item.locations.map((l) => l.lat);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}
