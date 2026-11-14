import { itemBounds, itemsToArcs, mercatorY } from '../../src/lib/geo';
import type { AtlasItem } from '../../src/lib/types';
import { readFileSync } from 'node:fs';

export const MAP_WIDTH = 960;
export const MAP_HEIGHT = 365;

type Position = number[];
type Polygon = Position[][];
type Land = {
  features: { geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: Polygon | Polygon[] } }[];
};

const land = JSON.parse(readFileSync(new URL('./land.geojson', import.meta.url), 'utf8')) as Land;
const polygons = land.features
  .flatMap(({ geometry }) =>
    geometry.type === 'Polygon'
      ? [geometry.coordinates as Polygon]
      : (geometry.coordinates as Polygon[]),
  )
  .map((rings) => {
    const points = rings[0];
    return {
      rings,
      west: Math.min(...points.map(([lng]) => lng)),
      east: Math.max(...points.map(([lng]) => lng)),
      north: mercatorY(Math.max(...points.map(([, lat]) => lat))),
      south: mercatorY(Math.min(...points.map(([, lat]) => lat))),
    };
  });

export function posterMap(item: AtlasItem) {
  const [[west, south], [east, north]] = itemBounds(item);
  const centerLng = (west + east) / 2;
  const centerY = (mercatorY(north) + mercatorY(south)) / 2;
  const scale = Math.min(
    (MAP_WIDTH - 180) / Math.max((east - west) / 360, 1 / 12),
    (MAP_HEIGHT - 100) / Math.max(mercatorY(south) - mercatorY(north), 1 / 16),
  );
  const project = ([lng, lat]: Position) =>
    [
      Math.round(MAP_WIDTH / 2 + ((lng - centerLng) / 360) * scale),
      Math.round(MAP_HEIGHT / 2 + (mercatorY(lat) - centerY) * scale),
    ] as const;
  const pathOf = (points: Position[]) =>
    points.map((point, i) => `${i ? 'L' : 'M'}${project(point).join(' ')}`).join('');
  const visibleWest = centerLng - (MAP_WIDTH / 2 / scale) * 360;
  const visibleEast = centerLng + (MAP_WIDTH / 2 / scale) * 360;
  const visibleNorth = centerY - MAP_HEIGHT / 2 / scale;
  const visibleSouth = centerY + MAP_HEIGHT / 2 / scale;
  const landPaths = [-360, 0, 360].flatMap((shift) =>
    polygons
      .filter(
        (p) =>
          p.east + shift >= visibleWest &&
          p.west + shift <= visibleEast &&
          p.south >= visibleNorth &&
          p.north <= visibleSouth,
      )
      .map(({ rings }) =>
        rings.map((ring) => pathOf(ring.map(([lng, lat]) => [lng + shift, lat])) + 'Z').join(''),
      ),
  );

  const arcs = itemsToArcs([item]).features.map(({ geometry, properties }) => ({
    path: pathOf(geometry.coordinates),
    contested: properties.contested,
  }));
  const occupied: { x: number; y: number }[] = [];
  const pins = item.locations.map((location) => {
    const lng = location.lng + 360 * Math.round((centerLng - location.lng) / 360);
    const [x, y] = project([lng, location.lat]);
    // Move number badges apart while keeping the historical coordinates fixed.
    const slots = [
      [0, -22],
      [26, 0],
      [0, 24],
      [-26, 0],
      [24, -24],
      [24, 24],
      [-24, 24],
      [-24, -24],
    ];
    const slot = slots.find(([dx, dy]) =>
      occupied.every((pin) => Math.hypot(x + dx - pin.x, y + dy - pin.y) >= 29),
    );
    const [dx, dy] = slot ?? [0, -46];
    const labelX = x + dx;
    const labelY = y + dy;
    occupied.push({ x: labelX, y: labelY });
    return { x, y, labelX, labelY, location };
  });
  return { landPaths, arcs, pins };
}
