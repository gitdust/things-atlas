import assert from 'node:assert/strict';
import test from 'node:test';
import { createQuizLifecycle } from '../src/lib/quizLifecycle';
import type { QuizDataset } from '../src/lib/quiz';

const question = { id: 'a:b', leftId: 'a', rightId: 'b', earlierId: 'a' };
const dataset: QuizDataset = { datasetVersion: 'test', items: [], pairs: [] };
const load = async () => ({ question, dataset });

test('subscription and remount never open a game automatically', () => {
  const lifecycle = createQuizLifecycle();
  const unsubscribe = lifecycle.subscribe(() => {});
  unsubscribe();
  lifecycle.subscribe(() => {});
  assert.equal(lifecycle.getSnapshot().phase, 'idle');
});

test('explicit open loads once while pending and accepts only the first valid answer', async () => {
  const lifecycle = createQuizLifecycle();
  let resolve: ((value: Awaited<ReturnType<typeof load>>) => void) | undefined;
  let loads = 0;
  const pending = lifecycle.open(() => {
    loads++;
    return new Promise((done) => {
      resolve = done;
    });
  });
  await lifecycle.open(async () => {
    loads++;
    return load();
  });
  assert.equal(loads, 1);
  assert.equal(lifecycle.getSnapshot().phase, 'loading');
  resolve?.({ question, dataset });
  await pending;
  lifecycle.answer('wrong-question', 'a');
  lifecycle.answer(question.id, 'unknown');
  assert.equal(lifecycle.getSnapshot().phase, 'question');
  lifecycle.answer(question.id, 'b');
  lifecycle.answer(question.id, 'a');
  const revealed = lifecycle.getSnapshot();
  assert.equal(revealed.phase, 'revealed');
  if (revealed.phase === 'revealed') assert.equal(revealed.selectedId, 'b');
});

test('dismissal preserves closure until another explicit click starts a fresh question', async () => {
  const lifecycle = createQuizLifecycle();
  await lifecycle.open(load);
  lifecycle.answer(question.id, 'a');
  lifecycle.dismiss();
  lifecycle.subscribe(() => {});
  assert.equal(lifecycle.getSnapshot().phase, 'dismissed');
  await lifecycle.open(async () => ({ question: { ...question, id: 'new' }, dataset }));
  const next = lifecycle.getSnapshot();
  assert.equal(next.phase, 'question');
  if (next.phase === 'question') assert.equal(next.question.id, 'new');
});

test('failures close quietly and can retry only through an explicit open', async () => {
  const lifecycle = createQuizLifecycle();
  await lifecycle.open(async () => {
    throw new Error('offline');
  });
  assert.equal(lifecycle.getSnapshot().phase, 'dismissed');
  await lifecycle.open(load);
  assert.equal(lifecycle.getSnapshot().phase, 'question');
});

test('dismissal during loading prevents stale completion from reopening', async () => {
  const lifecycle = createQuizLifecycle();
  let resolve: ((value: Awaited<ReturnType<typeof load>>) => void) | undefined;
  const pending = lifecycle.open(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  lifecycle.dismiss();
  resolve?.({ question, dataset });
  await pending;
  assert.equal(lifecycle.getSnapshot().phase, 'dismissed');
});
