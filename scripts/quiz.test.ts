import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPairs,
  drawQuestion,
  eligibleQuizItems,
  quizReducer,
  validateEarliestUse,
  validateExcludedPairs,
  type QuizItem,
  type QuizState,
} from '../src/lib/quiz';
import type { AtlasItem } from '../src/lib/types';

function item(id: string, start: number, end = start): QuizItem {
  return {
    id,
    name_zh: id,
    name_en: id,
    sources: [
      { title: 'Evidence', url: 'https://example.com', type: 'museum', accessed: '2026-11-14' },
    ],
    earliest_use: {
      year: start,
      precision: start === end ? 'year' : 'century',
      range: { start, end },
      evidence: 'documented_use',
      explanation_zh: '使用记录',
      explanation_en: 'Recorded use',
      source_urls: ['https://example.com'],
    },
  };
}

test('strict non-overlap comparisons include BCE and exclude touching, equal and overlapping ranges', () => {
  assert.deepEqual(buildPairs([item('a', -3000, -2900), item('b', -1000), item('c', 10)]), [
    ['a', 'b'],
    ['a', 'c'],
    ['b', 'c'],
  ]);
  assert.deepEqual(buildPairs([item('a', 100, 200), item('b', 200, 250), item('c', 150, 200)]), []);
  assert.deepEqual(buildPairs([item('a', 10), item('b', 10)]), []);
  assert.deepEqual(
    buildPairs(
      [item('a', 1), item('b', 2)],
      [{ ids: ['b', 'a'], reason: 'Different category scope' }],
    ),
    [],
  );
});

test('evidence validation rejects unsafe, zero, out-of-range and mismatched exact years', () => {
  for (const value of [0, Number.MAX_SAFE_INTEGER + 1, 1.5]) {
    assert.ok(validateEarliestUse(item('a', value)).length);
  }
  const a = item('a', 100, 200);
  assert.equal(validateEarliestUse(a).length, 0);
  a.earliest_use.year = 99;
  assert.ok(validateEarliestUse(a).length);
  a.earliest_use.year = 100;
  a.earliest_use.precision = 'year';
  assert.ok(validateEarliestUse(a).length);
});

test('evidence requires bilingual explanations and unique sources from original entry', () => {
  const a = item('a', 10);
  a.earliest_use.explanation_en = ' ';
  assert.ok(validateEarliestUse(a).length);
  a.earliest_use.explanation_en = 'Recorded use';
  a.earliest_use.source_urls = ['https://invalid.example'];
  assert.ok(validateEarliestUse(a).length);
  a.earliest_use.source_urls = ['https://example.com', 'https://example.com'];
  assert.ok(validateEarliestUse(a).length);
  a.earliest_use.source_urls = [];
  assert.ok(validateEarliestUse(a).length);
});

test('entries without evidence and disputed entries never enter the pool', () => {
  const full = (id: string): AtlasItem => ({
    ...item(id, 10),
    category: 'home',
    years: {
      invention: { year: 1, precision: 'year' },
      patent: null,
      mass_production: null,
      popularization: null,
    },
    locations: [],
    confidence: 'year',
    disputed: false,
    summary_zh: '',
    summary_en: '',
    updated: '2026-11-14',
    primary_year: 1,
  });
  const a = full('a');
  const b = full('b');
  delete b.earliest_use;
  const c = full('c');
  c.disputed = true;
  const d = full('d');
  d.confidence = 'disputed';
  assert.deepEqual(
    eligibleQuizItems([d, c, b, a]).map(({ id }) => id),
    ['a'],
  );
});

test('excluded pair validation checks existing distinct IDs, duplicates and explanation', () => {
  const ids = new Set(['a', 'b']);
  validateExcludedPairs([{ ids: ['a', 'b'], reason: 'Scope' }], ids);
  assert.throws(() => validateExcludedPairs([{ ids: ['a', 'a'], reason: 'Scope' }], ids));
  assert.throws(() => validateExcludedPairs([{ ids: ['a', 'missing'], reason: 'Scope' }], ids));
  assert.throws(() => validateExcludedPairs([{ ids: ['a', 'b'], reason: '' }], ids));
  assert.throws(() =>
    validateExcludedPairs(
      [
        { ids: ['a', 'b'], reason: 'Scope' },
        { ids: ['b', 'a'], reason: 'Scope' },
      ],
      ids,
    ),
  );
});

test('fixed RNG selects uniformly indexed pairs then swaps sides independently', () => {
  const items = [item('a', -100), item('b', 10), item('c', 100)];
  const dataset = { datasetVersion: 'v1', items, pairs: buildPairs(items) };
  const values = [0.99, 0.75];
  let calls = 0;
  assert.deepEqual(
    drawQuestion(dataset, () => values[calls++]),
    { id: 'v1:b:c', leftId: 'c', rightId: 'b', earlierId: 'b' },
  );
  assert.equal(calls, 2);
  assert.equal(drawQuestion(dataset, () => 0).leftId, 'a');
  assert.throws(() => drawQuestion({ ...dataset, pairs: [] }, () => 0));
});

test('answers lock after the first valid choice and dismissal is terminal', () => {
  const question = { id: 'q', leftId: 'a', rightId: 'b', earlierId: 'a' };
  const state: QuizState = { phase: 'question', question };
  assert.equal(quizReducer(state, { type: 'ANSWER', questionId: 'wrong', selectedId: 'a' }), state);
  assert.equal(quizReducer(state, { type: 'ANSWER', questionId: 'q', selectedId: 'c' }), state);
  const revealed = quizReducer(state, { type: 'ANSWER', questionId: 'q', selectedId: 'b' });
  assert.equal(
    quizReducer(revealed, { type: 'ANSWER', questionId: 'q', selectedId: 'a' }),
    revealed,
  );
  const dismissed = quizReducer(revealed, { type: 'DISMISS' });
  assert.equal(quizReducer(dismissed, { type: 'READY', question }), dismissed);
});
