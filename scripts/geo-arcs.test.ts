import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';
import { itemBounds, itemsToArcs } from '../src/lib/geo';
import type { AtlasItem } from '../src/lib/types';

const root = new URL('../data/items/', import.meta.url);
const toiletPaper: AtlasItem = JSON.parse(readFileSync(new URL('toilet-paper.json', root), 'utf8'));
const maxLatitude = 85.0511287798066;

function arc(a: [number, number], b: [number, number]) {
  const item = {
    ...toiletPaper,
    locations: [a, b].map(([lng, lat]) => ({
      ...toiletPaper.locations[0],
      kind: 'production' as const,
      lng,
      lat,
    })),
  };
  return itemsToArcs([item]).features[0].geometry.coordinates;
}

function assertProjectable(points: number[][]) {
  for (const [lng, lat] of points) {
    assert(Number.isFinite(lng) && Number.isFinite(lat));
    assert(Math.abs(lat) <= maxLatitude + 1e-10);
    assert(Number.isFinite(Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))));
  }
}

test('actual China–Albany toilet-paper association stays near its endpoints, not above 88°N', () => {
  const feature = itemsToArcs([toiletPaper]).features.find((f) => {
    const end = f.geometry.coordinates.at(-1)!;
    return Math.abs(end[1] - 42.653) < 0.001;
  });
  assert(feature);
  const points = feature.geometry.coordinates;
  assertProjectable(points);
  assert(Math.max(...points.map(([, lat]) => lat)) < 60);
  assert.deepEqual(points[0], [108.94, 34.341]);
  assert.equal(points.at(-1)![1], 42.653);
});

test('associations cross the date line continuously in either direction via the short span', () => {
  for (const [a, b, expectedEnd] of [
    [[179, 20], [-179, 30], 181],
    [[-179, 30], [179, 20], -181],
  ] as const) {
    const points = arc([...a], [...b]);
    assert.deepEqual(points[0], [...a]);
    assert.deepEqual(points.at(-1), [expectedEnd, b[1]]);
    assert.equal(Math.abs(points.at(-1)![0] - points[0][0]), 2);
    for (let i = 1; i < points.length; i++) assert(Math.abs(points[i][0] - points[i - 1][0]) < 1);
  }
});

test('coincident, antipodal and nearly antipodal endpoints do not create invalid geometry', () => {
  for (const [a, b] of [
    [
      [10, 20],
      [10, 20],
    ],
    [
      [0, 0],
      [180, 0],
    ],
    [
      [0, 45],
      [179.999999999, -45],
    ],
    [
      [0, 90],
      [180, -90],
    ],
  ] as [number, number][][]) {
    assertProjectable(arc(a, b));
  }
  assert.deepEqual(arc([10, 20], [10, 20]), [
    [10, 20],
    [10, 20],
  ]);
});

test('all real entry associations preserve endpoints and finite Mercator projection', () => {
  const items: AtlasItem[] = readdirSync(root)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(readFileSync(new URL(name, root), 'utf8')));
  for (const item of items) {
    const anchor = item.locations.find((loc) => loc.kind === 'invention') ?? item.locations[0];
    const targets = item.locations.filter((loc) => loc !== anchor);
    const features = itemsToArcs([item]).features;
    assert.equal(features.length, targets.length);
    features.forEach((feature, i) => {
      const points = feature.geometry.coordinates;
      assertProjectable(points);
      assert.deepEqual(points[0], [anchor.lng, anchor.lat]);
      const end = points.at(-1)!;
      assert.equal(end[1], targets[i].lat);
      assert(Math.abs((end[0] - targets[i].lng) % 360) < 1e-8);
      assert(Math.abs(end[0] - points[0][0]) <= 180);
    });
  }
});

test('selected toilet-paper bounds use the Pacific world and include the entire shallow arcs', () => {
  const [[west, south], [east, north]] = itemBounds(toiletPaper);
  assert.equal(west, 108.94);
  assert.equal(east, 286.244);
  assert(east - west < 180);
  assert(north > 42.653); // Include the shallow curve, not just its endpoint.
  for (const feature of itemsToArcs([toiletPaper]).features) {
    for (const [lng, lat] of feature.geometry.coordinates) {
      assert(lng >= west && lng <= east && lat >= south && lat <= north);
    }
  }
});

test('single-location bounds stay at the marker without inventing an arc', () => {
  const single = { ...toiletPaper, locations: [toiletPaper.locations[0]] };
  const { lng, lat } = single.locations[0];
  assert.deepEqual(itemBounds(single), [
    [lng, lat],
    [lng, lat],
  ]);
});

test('arc direction follows milestone years while preserving anchor geometry', () => {
  const item: AtlasItem = {
    ...toiletPaper,
    primary_year: 1900,
    years: {
      invention: { year: 1900, precision: 'year' },
      patent: { year: 1890, precision: 'year' },
      mass_production: { year: 1910, precision: 'year' },
      popularization: { year: 1920, precision: 'year' },
    },
    locations: ['invention', 'patent', 'production', 'popularization', 'contested'].map(
      (kind, index) => ({
        ...toiletPaper.locations[0],
        kind: kind as AtlasItem['locations'][number]['kind'],
        lng: 10 + index,
      }),
    ),
  };
  const features = itemsToArcs([item]).features;
  assert.deepEqual(
    features.map((feature) => feature.properties.direction),
    [-1, 1, 1, 0],
  );
  assert.deepEqual(
    features.map((feature) => feature.properties.start_year),
    [1900, 1900, 1900, 1900],
  );
  assert.deepEqual(
    features.map((feature) => feature.properties.end_year),
    [1890, 1910, 1920, 1900],
  );
  features.forEach((feature, index) => {
    assert.equal(feature.geometry.coordinates[0][0], 10);
    assert.equal(feature.geometry.coordinates.at(-1)![0], 11 + index);
  });
});

test('explicit overrides determine direction, including BCE, year zero, and dated disputes', () => {
  const item: AtlasItem = {
    ...toiletPaper,
    primary_year: 100,
    locations: [-100, 0, -200, -100].map((year_override, index) => ({
      ...toiletPaper.locations[0],
      kind: index === 0 ? 'invention' : 'contested',
      year_override,
    })),
  };
  const features = itemsToArcs([item]).features;
  assert.deepEqual(
    features.map((feature) => feature.properties.direction),
    [1, -1, 0],
  );
  assert.deepEqual(
    features.map((feature) => feature.properties.start_year),
    [-100, -100, -100],
  );
  assert.deepEqual(
    features.map((feature) => feature.properties.end_year),
    [0, -200, -100],
  );
});

test('missing milestone dates preserve primary-year metadata without inventing direction', () => {
  const item: AtlasItem = {
    ...toiletPaper,
    primary_year: 1900,
    years: {
      invention: { year: 1900, precision: 'year' },
      patent: null,
      mass_production: null,
      popularization: null,
    },
    locations: ['invention', 'patent', 'contested'].map((kind) => ({
      ...toiletPaper.locations[0],
      kind: kind as AtlasItem['locations'][number]['kind'],
    })),
  };
  const features = itemsToArcs([item]).features;
  assert.deepEqual(
    features.map((feature) => feature.properties.direction),
    [0, 0],
  );
  assert.deepEqual(
    features.map((feature) => feature.properties.end_year),
    [1900, 1900],
  );
});
