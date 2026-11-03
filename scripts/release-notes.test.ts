import assert from 'node:assert/strict';
import test from 'node:test';
import { compareVersions, createReleaseManifest, findPreviousVersion } from './release-notes.ts';

const change = (id: string, afterVersion: string) => ({
  id,
  afterVersion,
  zh: `更新 ${id}`,
  en: `Change ${id}`,
});

test('versions compare numerically, including multi-digit components', () => {
  assert.equal(compareVersions('0.10.0', '0.9.99'), 1);
  assert.equal(compareVersions('1.0.0', '0.99.99'), 1);
  assert.equal(compareVersions('1.0.10', '1.0.2'), 1);
  assert.equal(compareVersions('0.1.0', '0.1.0'), 0);
});

test('initial version and same-version drafts expose no release changes', () => {
  assert.deepEqual(createReleaseManifest('0.1.0', [change('draft', '0.1.0')], null), {
    version: '0.1.0',
    changes: [],
  });
  assert.deepEqual(createReleaseManifest('0.1.0', [], null).changes, []);
});

test('advancing package version publishes all changes from the preceding development group', () => {
  const records = [change('ui', '0.1.0'), change('items', '0.1.0')];
  assert.deepEqual(
    createReleaseManifest('0.2.0', records, '0.1.0').changes.map((entry) => entry.id),
    ['ui', 'items'],
  );
});

test('new drafts stay unpublished while current release notes remain available', () => {
  const records = [change('old', '0.1.0'), change('draft', '0.2.0')];
  assert.deepEqual(
    createReleaseManifest('0.2.0', records, '0.1.0').changes.map((entry) => entry.id),
    ['old'],
  );
});

test('skipping releases displays only the latest release group and leaves history intact', () => {
  const records = [
    change('old', '0.1.0'),
    change('latest-ui', '0.2.0'),
    change('latest-items', '0.2.0'),
    change('draft', '0.3.0'),
  ];
  const original = structuredClone(records);
  assert.deepEqual(
    createReleaseManifest('0.3.0', records, '0.2.0').changes.map((entry) => entry.id),
    ['latest-ui', 'latest-items'],
  );
  assert.deepEqual(records, original);
});

test('release selection is independent of file order and numeric version width', () => {
  const records = [change('latest', '0.10.0'), change('old', '0.9.0')];
  assert.equal(createReleaseManifest('0.11.0', records, '0.10.0').changes[0].id, 'latest');
});

test('invalid versions and malformed or duplicate records fail the build', () => {
  for (const version of ['1.2', '1.2.3-beta', '01.2.3', '1.2.3 ', '1.2.99999999999999999']) {
    assert.throws(() => createReleaseManifest(version, [], null), /version|component/i);
  }
  assert.throws(() => createReleaseManifest('0.1.0', {}, null), /array/);
  assert.throws(() => createReleaseManifest('0.1.0', [null], null), /object/);
  assert.throws(
    () => createReleaseManifest('0.1.0', [{ ...change('a', '0.1.0'), en: ' ' }], null),
    /en/,
  );
  assert.throws(
    () => createReleaseManifest('0.1.0', [change('a', '0.1.0'), change('a', '0.1.0')], null),
    /Duplicate/,
  );
  assert.throws(() => createReleaseManifest('0.1.0', [change('a', '0.2.0')], null), /future/);
});

test('a release without new records never replays an older release group', () => {
  assert.deepEqual(createReleaseManifest('0.3.0', [change('old', '0.1.0')], '0.2.0').changes, []);
});

test('previous package version ignores current-version commits and supports uncommitted bumps', () => {
  assert.equal(findPreviousVersion('0.3.0', ['0.3.0', '0.3.0', '0.2.0', '0.1.0']), '0.2.0');
  assert.equal(findPreviousVersion('0.3.0', ['0.2.0', '0.1.0']), '0.2.0');
  assert.equal(findPreviousVersion('0.1.0', ['0.1.0', '0.1.0']), null);
  assert.equal(findPreviousVersion('0.11.0', ['0.10.0', '0.9.0']), '0.10.0');
});

test('previous release boundaries must precede current version', () => {
  assert.throws(() => createReleaseManifest('0.2.0', [], '0.2.0'), /lower/);
  assert.throws(() => createReleaseManifest('0.2.0', [], '0.3.0'), /lower/);
});
