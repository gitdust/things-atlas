import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { YEAR_KEYS, type YearKey } from '../src/lib/primaryYear';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const itemsDir = path.join(root, 'data', 'items');
const schemaPath = path.join(root, 'data', 'schema', 'item.schema.json');

const FOOD_TAG_BLACKLIST = new Set([
  'food',
  'cuisine',
  'recipe',
  'beverage',
  'drink',
  'meal',
]);

type YearMark = { year: number; precision: string; ref?: string } | null;
type Item = {
  id: string;
  years: Record<string, YearMark>;
  primary?: YearKey;
  sources: { type: string }[];
  disputed: boolean;
  notes?: string;
  tags?: string[];
};

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

const files = fs
  .readdirSync(itemsDir)
  .filter((f) => f.endsWith('.json'))
  .sort();

if (files.length === 0) {
  console.error('No items found in data/items/');
  process.exit(1);
}

const ids = new Set<string>();
let failed = false;

for (const file of files) {
  const full = path.join(itemsDir, file);
  const raw = fs.readFileSync(full, 'utf8');
  const failedBefore = failed;
  failed = false;
  let data: Item;
  try {
    data = JSON.parse(raw) as Item;
  } catch (e) {
    console.error(`✗ ${file}: invalid JSON (${e})`);
    failed = true;
    continue;
  }

  const ok = validate(data);
  if (!ok) {
    console.error(`✗ ${file}: schema errors`);
    for (const err of validate.errors ?? []) {
      console.error(`  - ${err.instancePath || '/'} ${err.message}`);
    }
    failed = true;
  }

  const expectedId = file.replace(/\.json$/, '');
  if (data.id !== expectedId) {
    console.error(`✗ ${file}: id "${data.id}" must match filename "${expectedId}"`);
    failed = true;
  }
  if (ids.has(data.id)) {
    console.error(`✗ ${file}: duplicate id "${data.id}"`);
    failed = true;
  }
  ids.add(data.id);

  const yearValues = Object.values(data.years ?? {});
  if (!yearValues.some((y) => y != null)) {
    console.error(`✗ ${file}: years must have at least one non-null mark`);
    failed = true;
  }

  if (
    data.primary != null &&
    (YEAR_KEYS as readonly string[]).includes(data.primary) &&
    data.years?.[data.primary] == null
  ) {
    console.error(
      `✗ ${file}: primary="${data.primary}" points to a null years.${data.primary}`,
    );
    failed = true;
  }

  const nonBrand = (data.sources ?? []).some((s) => s.type !== 'brand');
  if (!nonBrand) {
    console.error(`✗ ${file}: sources cannot be brand-only`);
    failed = true;
  }

  if (data.disputed === true && (!data.notes || data.notes.length < 40)) {
    console.error(`✗ ${file}: disputed=true requires notes ≥ 40 chars`);
    failed = true;
  }

  for (const tag of data.tags ?? []) {
    if (FOOD_TAG_BLACKLIST.has(tag.toLowerCase())) {
      console.error(`✗ ${file}: forbidden food-related tag "${tag}"`);
      failed = true;
    }
  }

  if (!failed) {
    console.log(`✓ ${file}`);
  }
  failed = failed || failedBefore;
}

if (failed) {
  console.error('\nValidation failed.');
  process.exit(1);
}

console.log(`\nValidated ${files.length} item(s).`);
