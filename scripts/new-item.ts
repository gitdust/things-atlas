import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const slug = process.argv[2];

if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
  console.error('Usage: npm run new-item -- <slug>');
  console.error('Slug must match ^[a-z0-9]+(?:-[a-z0-9]+)*$');
  process.exit(1);
}

const out = path.join(root, 'data', 'items', `${slug}.json`);
if (fs.existsSync(out)) {
  console.error(`Already exists: ${out}`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const template = {
  id: slug,
  name_zh: '',
  name_en: '',
  name_es: '',
  name_ja: '',
  category: 'stationery',
  years: {
    invention: null,
    patent: null,
    mass_production: null,
    popularization: null,
  },
  locations: [
    {
      lat: 0,
      lng: 0,
      place_label_zh: '',
      place_label_en: '',
      place_label_es: '',
      place_label_ja: '',
      kind: 'invention',
      confidence: 'approximate',
    },
  ],
  confidence: 'year',
  sources: [
    {
      title: '',
      url: 'https://example.com',
      type: 'wiki',
      accessed: today,
    },
  ],
  disputed: false,
  notes: '',
  notes_en: '',
  notes_es: '',
  notes_ja: '',
  summary_zh: '',
  summary_en: '',
  summary_es: '',
  summary_ja: '',
  tags: ['office'],
  updated: today,
};

fs.writeFileSync(out, JSON.stringify(template, null, 2) + '\n');
console.log(`Created ${out}`);
console.log('Fill years (≥1), locations, sources (≥1 non-brand), then npm run validate');
