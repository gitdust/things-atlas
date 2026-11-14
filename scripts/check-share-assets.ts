import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { SITE_URL } from '../src/config/site';
import { loadItemsIndex } from '../src/lib/loadItems';
import { shareImages, socialImage } from '../src/lib/seo';
import {
  SHARE_FORMATS,
  SHARE_LANGUAGES,
  shareUrl,
  type ShareFormat,
  type ShareImage,
} from '../src/lib/share';

const origin = (process.env.SITE_URL || SITE_URL).replace(/\/+$/, '');
const root = path.resolve('dist');
const { items } = loadItemsIndex();
const decode = process.argv.includes('--qr');
const exec = promisify(execFile);
const formats = Object.keys(SHARE_FORMATS) as ShareFormat[];
const files = new Set<string>();
assert.equal(Object.keys(shareImages).length, items.length, 'Manifest item count');

for (const lang of SHARE_LANGUAGES) {
  const localeRoot = lang === 'en' ? path.join(root, 'en') : root;
  for (const item of [null, ...items]) {
    if (item) {
      for (const format of formats) {
        const variant: ShareImage | undefined = shareImages[item.id]?.[lang]?.[format];
        const expected = SHARE_FORMATS[format];
        assert.ok(variant, `Missing ${item.id}/${lang}/${format}`);
        assert.match(
          variant.path,
          new RegExp(`^/share/${item.id}/${lang}-${format}\\.[a-f0-9]{16}\\.${expected.ext}$`),
        );
        assert.ok(!files.has(variant.path), `Repeated asset ${variant.path}`);
        files.add(variant.path);
        const file = path.join(root, variant.path);
        const metadata = await sharp(file).metadata();
        assert.equal(metadata.width, expected.width, file);
        assert.equal(metadata.height, expected.height, file);
        assert.equal(metadata.format, format === 'poster' ? 'png' : 'jpeg', file);
        assert.equal(variant.width, expected.width, file);
        assert.equal(variant.height, expected.height, file);
        assert.equal(variant.mime, expected.mime, file);
        assert.ok(variant.alt.trim(), file);
        assert.ok((await fs.stat(file)).size <= 3_000_000, `Asset exceeds 3 MB: ${file}`);
        if (decode && format === 'poster') {
          const { stdout } = await exec('zbarimg', ['--quiet', '--raw', file]);
          assert.equal(stdout.trim(), shareUrl(item.id, lang), `QR in ${file}`);
        }
      }
    }
    const file = item
      ? path.join(localeRoot, 'item', item.id, 'index.html')
      : path.join(localeRoot, 'index.html');
    const html = await fs.readFile(file, 'utf8');
    const image = socialImage(lang, item, origin);
    const escape = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    for (const [attribute, name, value] of [
      ['property', 'og:image', image.url],
      ['property', 'og:image:width', String(image.width)],
      ['property', 'og:image:height', String(image.height)],
      ['property', 'og:image:type', image.mime],
      ['property', 'og:image:alt', image.alt],
      ['name', 'twitter:image', image.url],
      ['name', 'twitter:image:alt', image.alt],
    ]) {
      assert.ok(
        html.includes(`<meta ${attribute}="${name}" content="${escape(value)}"`),
        `${file}: ${name}`,
      );
    }
    assert.ok(html.includes(`<html lang="${lang === 'zh' ? 'zh-Hans' : 'en'}"`), file);
    if (item)
      assert.ok(
        html.includes(
          `<link rel="canonical" href="${origin}/item/${item.id}/${lang === 'en' ? '?lang=en' : ''}"`,
        ),
        file,
      );
  }
}
const onDisk = (await fs.readdir(path.join(root, 'share'), { recursive: true })).filter((name) =>
  /\.(jpg|png)$/.test(name),
);
assert.equal(onDisk.length, files.size, 'Stale or missing share assets');
console.log(
  `share: verified ${files.size} images and ${(items.length + 1) * SHARE_LANGUAGES.length} pages${decode ? ', including every poster QR' : ''}`,
);
