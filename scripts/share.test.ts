import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { shareContent, shareUrl, shareYear } from '../src/lib/share';
import type { AtlasItem } from '../src/lib/types';
import { MAP_HEIGHT, MAP_WIDTH, posterMap } from './share/map';

function entry(id: string): AtlasItem {
  return JSON.parse(readFileSync(new URL(`../data/items/${id}.json`, import.meta.url), 'utf8'));
}

test('public share URLs include only the selected entry and language', () => {
  assert.equal(shareUrl('toilet-paper', 'zh'), 'https://things-atlas.com/item/toilet-paper/');
  assert.equal(
    shareUrl('toilet-paper', 'en'),
    'https://things-atlas.com/item/toilet-paper/?lang=en',
  );
});

test('approximate and BCE years retain their precision', () => {
  assert.equal(shareYear('en', { year: -6000, precision: 'century' }), 'c. 6000 BCE');
  assert.equal(shareYear('zh', { year: -6000, precision: 'century' }), '约 公元前 6000 年');
  assert.equal(shareYear('en', { year: 1560, precision: 'decade' }), 'c. 1560');
  assert.equal(shareYear('en', { year: 1857, precision: 'year' }), '1857');
});

test('written evidence retains its context and dates sort chronologically', () => {
  const item = entry('toilet-paper');
  const en = shareContent(item, 'en');
  assert.match(en.summary, /mentioned toilet paper around 589/);
  assert.match(en.milestones[0].text, /mentions using paper/);
  assert.equal(en.milestones[0].date, 'c. 589');
  assert.deepEqual(
    en.milestones.map(({ year }) => year),
    [589, 1393, 1883],
  );
});

test('content handles disputed origins, missing photos and missing translations', () => {
  const item = { ...entry('mirror'), image: undefined, disputed: true };
  assert.equal(shareContent(item, 'zh').dispute, '起源存在争议');
  assert.equal(shareContent(item, 'en').dispute, 'Origins disputed');
  assert.equal(shareContent(item, 'en').summary, item.summary_en);
  assert.throws(
    () => shareContent({ ...item, summary_en: '' }, 'en'),
    /mirror: missing en share summary/,
  );
});

test('editorial text replaces the defaults and cannot reference a missing year', () => {
  const item = entry('mirror');
  const editorial = { summary: 'Polished obsidian mirrors', ogSummary: 'Obsidian mirrors' };
  item.share = { zh: { summary: '磨光黑曜石镜', ogSummary: '黑曜石镜' }, en: editorial };
  assert.equal(shareContent(item, 'en').ogSummary, editorial.ogSummary);
  item.share.en.milestones = [{ yearKey: 'patent', label: 'Patent', text: 'Example' }];
  assert.throws(() => shareContent(item, 'en'), /years.patent/);
});

test('poster map keeps Pacific connections and their location badges in frame', () => {
  const { arcs, landPaths, pins } = posterMap(entry('toilet-paper'));
  assert.ok(landPaths.length > 0);
  assert.equal(pins.length, 4);
  assert.ok(pins[0].x < pins[3].x, 'China is west of the US in the Pacific view');
  for (const { x, y, labelX, labelY } of pins) {
    assert.ok(x > 0 && x < MAP_WIDTH && y > 0 && y < MAP_HEIGHT);
    assert.ok(labelX > 13 && labelX < MAP_WIDTH - 13);
    assert.ok(labelY > 13 && labelY < MAP_HEIGHT - 13);
  }
  for (const arc of arcs) {
    assert.ok(arc.path.startsWith(`M${pins[0].x} ${pins[0].y}`));
    assert.ok(pins.slice(1).some(({ x, y }) => arc.path.endsWith(`L${x} ${y}`)));
  }
});

test('poster map preserves contested associations and supports a single location', () => {
  const item = entry('ballpoint-pen');
  assert.ok(posterMap(item).arcs.some(({ contested }) => contested));
  const single = posterMap({ ...item, locations: item.locations.slice(0, 1) });
  assert.equal(single.pins.length, 1);
  assert.equal(single.arcs.length, 0);
  assert.ok(single.landPaths.length > 0);
});
