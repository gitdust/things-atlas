import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import type { AtlasItem } from '../src/lib/types';
import {
  buildPairs,
  eligibleQuizItems,
  validateExcludedPairs,
  type ExcludedPair,
} from '../src/lib/quiz';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const index: { items: AtlasItem[] } = JSON.parse(
  fs.readFileSync(path.join(root, 'src/generated/items-index.json'), 'utf8'),
);
const exclusions: ExcludedPair[] = JSON.parse(
  fs.readFileSync(path.join(root, 'data/quiz-excluded-pairs.json'), 'utf8'),
);
validateExcludedPairs(exclusions, new Set(index.items.map((item) => item.id)));
const items = eligibleQuizItems(index.items);
const pairs = buildPairs(items, exclusions);
if (!pairs.length)
  throw new Error('Quiz requires at least one legal pair with reviewed earliest_use evidence');
const datasetVersion = createHash('sha256')
  .update(JSON.stringify({ items, pairs }))
  .digest('hex')
  .slice(0, 16);
fs.writeFileSync(
  path.join(root, 'src/generated/quiz.json'),
  JSON.stringify({ datasetVersion, items, pairs }) + '\n',
);
console.log(
  `Built quiz: ${items.length} reviewed items, ${pairs.length} legal pairs (${datasetVersion})`,
);
