import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const itemsDir = path.join(root, 'data', 'items');
const outDir = path.join(root, 'public', 'generated');

type YearMark = { year: number; precision: string; ref?: string } | null;
type Location = {
  lat: number;
  lng: number;
  place_label_zh: string;
  place_label_en: string;
  kind: string;
  confidence: string;
  year_override?: number;
};
type Item = {
  id: string;
  name_zh: string;
  name_en: string;
  category: string;
  years: {
    invention: YearMark;
    patent: YearMark;
    mass_production: YearMark;
    popularization: YearMark;
  };
  locations: Location[];
  confidence: string;
  sources: unknown[];
  disputed: boolean;
  notes?: string;
  summary_zh: string;
  summary_en: string;
  tags?: string[];
  updated: string;
};

/** Spec primary_year priority: patent → mass_production → invention → popularization */
function derivePrimaryYear(years: Item['years']): number | null {
  const order = ['patent', 'mass_production', 'invention', 'popularization'] as const;
  for (const key of order) {
    const mark = years[key];
    if (mark && typeof mark.year === 'number') return mark.year;
  }
  return null;
}

fs.mkdirSync(outDir, { recursive: true });

const files = fs
  .readdirSync(itemsDir)
  .filter((f) => f.endsWith('.json'))
  .sort();

const items: Array<Item & { primary_year: number }> = [];
const features: GeoJSON.Feature[] = [];

for (const file of files) {
  const data = JSON.parse(
    fs.readFileSync(path.join(itemsDir, file), 'utf8'),
  ) as Item;
  const primary = derivePrimaryYear(data.years);
  if (primary == null) {
    throw new Error(`${file}: cannot derive primary_year`);
  }
  const indexed = { ...data, primary_year: primary };
  items.push(indexed);

  data.locations.forEach((loc, index) => {
    features.push({
      type: 'Feature',
      id: `${data.id}#${index}`,
      geometry: {
        type: 'Point',
        coordinates: [loc.lng, loc.lat],
      },
      properties: {
        id: data.id,
        location_index: index,
        name_zh: data.name_zh,
        name_en: data.name_en,
        category: data.category,
        primary_year: primary,
        disputed: data.disputed,
        kind: loc.kind,
        place_label_zh: loc.place_label_zh,
        place_label_en: loc.place_label_en,
        year_override: loc.year_override ?? null,
      },
    });
  });
}

items.sort((a, b) => a.primary_year - b.primary_year || a.id.localeCompare(b.id));

const years = items.map((i) => i.primary_year);
const minYear = Math.min(...years);
const maxYear = Math.max(...years);

const index = {
  generated_at: new Date().toISOString(),
  count: items.length,
  year_range: {
    min: minYear - 5,
    max: maxYear + 5,
    data_min: minYear,
    data_max: maxYear,
  },
  primary_year_priority: [
    'patent',
    'mass_production',
    'invention',
    'popularization',
  ],
  items,
};

const geojson: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features,
};

fs.writeFileSync(
  path.join(outDir, 'items-index.json'),
  JSON.stringify(index, null, 2) + '\n',
);
fs.writeFileSync(
  path.join(outDir, 'items.geojson'),
  JSON.stringify(geojson, null, 2) + '\n',
);

// Also mirror into src for typed import during MVP (<200 items)
const srcGen = path.join(root, 'src', 'generated');
fs.mkdirSync(srcGen, { recursive: true });
fs.writeFileSync(
  path.join(srcGen, 'items-index.json'),
  JSON.stringify(index, null, 2) + '\n',
);
fs.writeFileSync(
  path.join(srcGen, 'items.geojson'),
  JSON.stringify(geojson, null, 2) + '\n',
);

console.log(
  `Built index: ${items.length} items, ${features.length} features → public/generated/ & src/generated/`,
);
