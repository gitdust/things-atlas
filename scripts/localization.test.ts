import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { itemsToGeoJSON } from '../src/lib/geo';
import { LANGS, pick } from '../src/lib/i18n';
import { eligibleQuizItems, validateEarliestUse } from '../src/lib/quiz';
import { shareContent, SHARE_LANGUAGES } from '../src/lib/share';
import { itemMeta } from '../src/lib/seo';
import type { AtlasItem } from '../src/lib/types';

function entry(id: string): AtlasItem {
  return JSON.parse(readFileSync(new URL(`../data/items/${id}.json`, import.meta.url), 'utf8'));
}

const ajv = new Ajv2020({ strict: false });
addFormats(ajv);
const validate = ajv.compile(
  JSON.parse(readFileSync(new URL('../data/schema/item.schema.json', import.meta.url), 'utf8')),
);

test('schema rejects missing or blank translations at every content level', () => {
  const original = entry('microwave-oven');
  assert.ok(validate(original), JSON.stringify(validate.errors));
  for (const lang of ['es', 'ja'] as const) {
    for (const remove of [
      (item: AtlasItem) => Reflect.deleteProperty(item, `name_${lang}`),
      (item: AtlasItem) => Reflect.deleteProperty(item, `summary_${lang}`),
      (item: AtlasItem) => Reflect.deleteProperty(item.locations[0], `place_label_${lang}`),
      (item: AtlasItem) => {
        const mark = Object.values(item.years).find((value) => value !== null);
        assert.ok(mark);
        Reflect.deleteProperty(mark, `ref_${lang}`);
      },
      (item: AtlasItem) => {
        assert.ok(item.image);
        Reflect.deleteProperty(item.image, `alt_${lang}`);
      },
      (item: AtlasItem) => {
        assert.ok(item.earliest_use);
        Reflect.deleteProperty(item.earliest_use, `explanation_${lang}`);
      },
    ]) {
      const item = structuredClone(original);
      remove(item);
      assert.equal(validate(item), false, `Missing ${lang} translation was accepted`);
    }
    assert.equal(validate({ ...original, [`name_${lang}`]: '   ' }), false);
    const disputed = entry('ballpoint-pen');
    Reflect.deleteProperty(disputed, `notes_${lang}`);
    assert.equal(validate(disputed), false);
  }
});

test('Spanish names reach map features, SEO, quiz choices, and sharing', () => {
  const item = entry('microwave-oven');
  const feature = itemsToGeoJSON([item]).features[0];
  assert.equal(feature.properties.name_es, item.name_es);
  assert.equal(feature.properties.place_label_es, item.locations[0].place_label_es);
  assert.ok(itemMeta('es', item).title.startsWith(item.name_es));
  assert.equal(eligibleQuizItems([item])[0].name_es, item.name_es);
  assert.deepEqual(SHARE_LANGUAGES, LANGS);
  for (const lang of ['es', 'ja'] as const) {
    const content = shareContent(item, lang);
    assert.equal(content.name, item[`name_${lang}`]);
    assert.equal(content.summary, item[`summary_${lang}`]);
    assert.notEqual(content.summary, item.summary_en);
    for (const milestone of content.milestones) {
      const mark = Object.values(item.years).find((value) => value?.year === milestone.year);
      assert.equal(milestone.text, mark?.[`ref_${lang}`]);
    }
    assert.equal(
      pick(lang, item.name_zh, item.name_en, { es: item.name_es, ja: item.name_ja }),
      item[`name_${lang}`],
    );
    assert.throws(() => shareContent({ ...item, [`summary_${lang}`]: '' }, lang), /missing/);
  }
});

test('direct quiz generation rejects incomplete Spanish and Japanese evidence', () => {
  for (const lang of ['es', 'ja'] as const) {
    const item = entry('microwave-oven');
    assert.ok(item.earliest_use);
    Reflect.deleteProperty(item.earliest_use, `explanation_${lang}`);
    assert.ok(validateEarliestUse(item).some((error) => error.includes('ES/JA')));
    assert.throws(() => eligibleQuizItems([item]), /ES\/JA/);
  }
});
