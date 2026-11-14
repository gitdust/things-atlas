import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { validateEarliestUse } from '../src/lib/quiz';
import type { EarliestUse } from '../src/lib/types';
import { YEAR_KEYS, type YearKey } from '../src/lib/primaryYear';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const itemsDir = path.join(root, 'data', 'items');
const schemaPath = path.join(root, 'data', 'schema', 'item.schema.json');

type YearMark = { year: number; precision: string; ref?: string } | null;
type Item = {
  id: string;
  years: Record<string, YearMark>;
  primary?: YearKey;
  sources: { type: string; url: string }[];
  earliest_use?: EarliestUse;
  disputed: boolean;
  notes?: string;
  notes_en?: string;
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

const tagIds = new Set<string>(
  JSON.parse(fs.readFileSync(path.join(root, 'data', 'tags.json'), 'utf8')).tags.map(
    (tag: { id: string }) => tag.id,
  ),
);
const ids = new Set<string>();
let failed = false;

for (const file of files) {
  const full = path.join(itemsDir, file);
  const raw = fs.readFileSync(full, 'utf8');
  const failedBefore: boolean = failed;
  failed = false;
  let data: Item;
  try {
    data = JSON.parse(raw) as Item;
  } catch (e) {
    console.error(`✗ ${file}: invalid JSON (${e})`);
    failed = true;
    continue;
  }

  if (
    !data.tags?.length ||
    new Set(data.tags).size !== data.tags.length ||
    data.tags.some((tag) => !tagIds.has(tag))
  ) {
    console.error(`✗ ${file}: missing, duplicate or unknown tags`);
    failed = true;
  }
  const ok = validate(data);
  if (!ok) {
    console.error(`✗ ${file}: schema errors`);
    for (const err of validate.errors ?? []) {
      console.error(`  - ${err.instancePath || '/'} ${err.message}`);
    }
    failed = true;
  }

  for (const error of ok ? validateEarliestUse(data) : []) {
    console.error(`✗ ${file}: ${error}`);
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
    console.error(`✗ ${file}: primary="${data.primary}" points to a null years.${data.primary}`);
    failed = true;
  }

  const nonBrand = (data.sources ?? []).some((s) => s.type !== 'brand');
  if (!nonBrand) {
    console.error(`✗ ${file}: sources cannot be brand-only`);
    failed = true;
  }

  if (data.disputed === true) {
    if (!data.notes || data.notes.length < 40) {
      console.error(`✗ ${file}: disputed=true requires notes ≥ 40 chars`);
      failed = true;
    }
    if (!data.notes_en || !data.notes_en.trim()) {
      console.error(`✗ ${file}: disputed=true requires notes_en`);
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
