import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isNewerVersion,
  parseReleaseManifest,
  pendingReleaseForVersion,
} from '../src/lib/versionUpdate';

test('release comparison supports numeric upgrades without announcing equality or rollbacks', () => {
  assert.equal(isNewerVersion('0.10.0', '0.9.9'), true);
  assert.equal(isNewerVersion('1.0.0', '0.99.99'), true);
  assert.equal(isNewerVersion('0.1.0', '0.1.0'), false);
  assert.equal(isNewerVersion('0.1.0', '0.2.0'), false);
  for (const invalid of ['v1.0.0', '1.0', '01.0.0', '1.0.0-beta', '1.0.0\n']) {
    assert.equal(isNewerVersion(invalid, '0.1.0'), false, invalid);
  }
});

test('malformed release responses do not produce an update prompt', () => {
  assert.equal(parseReleaseManifest('<!doctype html>'), null);
  assert.equal(parseReleaseManifest({ version: '0.2.0' }), null);
  assert.equal(
    parseReleaseManifest({ version: '0.2.0', changes: [{ id: 'a', zh: '更新', en: '' }] }),
    null,
  );
  const change = { id: 'a', zh: '更新', en: 'Update' };
  assert.equal(parseReleaseManifest({ version: '0.2.0', changes: [change, change] }), null);
});

test('release notes appear only after the exact requested runtime version is installed', () => {
  const release = { version: '0.2.0', changes: [{ id: 'a', zh: '更新', en: 'Update' }] };
  const pending = JSON.stringify(release);
  assert.equal(pendingReleaseForVersion(null, '0.2.0'), null); // First visit or acknowledged release.
  assert.equal(pendingReleaseForVersion(pending, '0.1.0'), null); // Stale HTML after refresh.
  assert.equal(pendingReleaseForVersion(pending, '0.3.0'), null); // Never show an older release.
  assert.deepEqual(pendingReleaseForVersion(pending, '0.2.0'), release);
  assert.equal(pendingReleaseForVersion('{corrupt', '0.2.0'), null);
});
