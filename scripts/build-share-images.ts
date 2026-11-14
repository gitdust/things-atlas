import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser, type Page } from 'playwright-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import sharp from 'sharp';
import { loadItemsIndex } from '../src/lib/loadItems';
import {
  SHARE_FORMATS,
  SHARE_LANGUAGES,
  shareContent,
  shareUrl,
  type ShareFormat,
  type ShareManifest,
} from '../src/lib/share';
import { ShareCard } from './share/template';
import { posterMap } from './share/map';
import qrcodegen from './share/vendor/qrcodegen.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const publicDir = path.join(root, 'public');
const output = path.join(publicDir, 'share');
const manifestPath = path.join(root, 'src/generated/share-manifest.json');
const origin = 'http://127.0.0.1';
const started = Date.now();
const samples = new Set(process.argv.slice(2));
const sampleMode = samples.size > 0;
const index = loadItemsIndex();
for (const id of samples) {
  if (!index.items.some((item) => item.id === id)) throw new Error(`Unknown share sample: ${id}`);
}
const manifest: ShareManifest = {};
const charset = new Set(await fs.readFile(path.join(root, 'src/assets/fonts/charset.txt'), 'utf8'));
const formats = Object.keys(SHARE_FORMATS) as ShareFormat[];

const fontStyles = [
  'src/styles/fonts.css',
  'node_modules/@fontsource-variable/inter/wght.css',
  'node_modules/@fontsource-variable/source-serif-4/opsz.css',
];
const staticAssets = new Map<string, { body: Buffer; contentType: string }>();
let css = await fs.readFile(path.join(root, 'scripts/share/style.css'), 'utf8');
for (const stylesheet of fontStyles) {
  let faceCss = await fs.readFile(path.join(root, stylesheet), 'utf8');
  for (const match of [...faceCss.matchAll(/url\((['"]?)([^)'"]+\.woff2)\1\)/g)]) {
    const file = path.posix.normalize(path.posix.join(path.posix.dirname(stylesheet), match[2]));
    staticAssets.set(`/${file}`, {
      body: await fs.readFile(path.join(root, file)),
      contentType: 'font/woff2',
    });
    faceCss = faceCss.replaceAll(match[0], `url("/${file}")`);
  }
  css += faceCss;
}

const sharedHash = createHash('sha256').update(css).update(process.platform).update(process.arch);
for (const [file, asset] of staticAssets) sharedHash.update(file).update(asset.body);
for (const file of [
  'scripts/build-share-images.ts',
  'scripts/share/template.tsx',
  'scripts/share/vendor/qrcodegen.js',
  'src/lib/share.ts',
  'package-lock.json',
]) {
  sharedHash.update(await fs.readFile(path.join(root, file)));
}
if (process.env.SHARE_CHROMIUM_PATH) {
  sharedHash.update(await fs.readFile(process.env.SHARE_CHROMIUM_PATH));
}
sharedHash.update(process.env.SHARE_CHROMIUM_SINGLE_PROCESS ?? '');
const templateHash = sharedHash.digest('hex');

function qrCode(value: string) {
  const code = qrcodegen.QrCode.encodeText(value, qrcodegen.QrCode.Ecc.MEDIUM);
  const quietZone = 4;
  const cells: string[] = [];
  for (let y = 0; y < code.size; y++) {
    for (let x = 0; x < code.size; x++) {
      if (code.getModule(x, y)) cells.push(`M${x + quietZone} ${y + quietZone}h1v1h-1z`);
    }
  }
  return { size: code.size + quietZone * 2, path: cells.join('') };
}

async function render(
  page: Page,
  markup: string,
  format: ShareFormat,
  lang: string,
  automaticMilestones: boolean,
) {
  const { width, height } = SHARE_FORMATS[format];
  await page.setViewportSize({ width, height });
  await page.setContent(
    `<!doctype html><html lang="${lang}"><head><base href="${origin}/"><meta charset="utf-8"><style>${css}</style></head><body>${markup}</body></html>`,
  );
  const errors = await page.evaluate(
    async ({ automaticMilestones }) => {
      await document.fonts.ready;
      if (
        [...document.fonts].some((font) => font.status === 'error') ||
        ![...document.fonts].some((font) => font.status === 'loaded')
      ) {
        throw new Error('Share fonts did not load');
      }
      await Promise.all([...document.images].map((img) => img.decode()));
      const overflow = {
        check(el: HTMLElement) {
          return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
        },
      };
      const fields = [...document.querySelectorAll<HTMLElement>('[data-fit]')];
      const failures = [];
      for (const field of fields) {
        const size = parseFloat(getComputedStyle(field).fontSize);
        for (const scale of [0.92, 0.84, 0.76]) {
          if (!overflow.check(field)) break;
          field.style.fontSize = `${size * scale}px`;
        }
        if (!overflow.check(field)) continue;
        if (automaticMilestones && field.dataset.fit === 'milestone') field.remove();
        else
          failures.push(
            `${field.dataset.fit} (${field.clientWidth}x${field.clientHeight}, content ${field.scrollWidth}x${field.scrollHeight})`,
          );
      }
      const list = document.querySelector('ol');
      if (list && !list.children.length) list.remove();
      if (overflow.check(document.getElementById('card')!)) failures.push('card');
      return failures;
    },
    { automaticMilestones },
  );
  if (errors.length) throw new Error(`layout overflow in ${errors.join(', ')}`);
  return page.locator('#card').screenshot({ animations: 'disabled' });
}

async function atomicWrite(file: string, bytes: Buffer | string) {
  const temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, bytes, { flag: 'wx' });
  await fs.rename(temporary, file);
}

let browser: Browser | undefined;
let page: Page | undefined;
let currentPhoto: { path: string; body: Buffer } | undefined;
let total = 0;
let generated = 0;
const expected = new Set<string>();

try {
  for (const item of index.items) {
    if (sampleMode && !samples.has(item.id)) continue;
    const photo = item.image;
    const image =
      photo?.credit?.trim() &&
      photo.source_url?.startsWith('https://') &&
      /^(CC0(?: 1\.0)?|Public domain)$/i.test(photo.license ?? '')
        ? {
            src: `/photo/${item.id}`,
            credit: photo.credit,
            license: photo.license!,
            source: photo.source_url.replace(/^https:\/\//, ''),
          }
        : undefined;
    if (photo && !image)
      console.warn(`share: ${item.id}: text layout (photo licence or attribution)`);
    const original =
      image && photo ? await fs.readFile(path.join(publicDir, photo.src)) : undefined;
    currentPhoto = undefined;

    const map = posterMap(item);
    const languages = {} as ShareManifest[string];
    manifest[item.id] = languages;
    await fs.mkdir(path.join(output, item.id), { recursive: true });
    for (const lang of SHARE_LANGUAGES) {
      const content = shareContent(item, lang);
      const url = shareUrl(item.id, lang);
      const variants = {} as NonNullable<ShareManifest[string][typeof lang]>;
      languages[lang] = variants;
      for (const format of formats) {
        try {
          const { width, height, mime, ext } = SHARE_FORMATS[format];
          const props = {
            format,
            content,
            image,
            lang,
            map: format === 'poster' ? map : undefined,
            qr: format === 'poster' ? qrCode(url) : undefined,
          };
          const markup = renderToStaticMarkup(createElement(ShareCard, props));
          for (const char of markup) {
            if (char.codePointAt(0)! > 126 && !/\s/u.test(char) && !charset.has(char)) {
              throw new Error(`missing font glyph "${char}" (run npm run fonts)`);
            }
          }
          const fingerprint = createHash('sha256').update(templateHash).update(url).update(markup);
          if (original) fingerprint.update(original);
          const hash = fingerprint.digest('hex').slice(0, 16);
          const relative = `/share/${item.id}/${lang}-${format}.${hash}.${ext}`;
          const file = path.join(publicDir, relative);
          expected.add(file);
          variants[format] = {
            path: relative,
            width,
            height,
            mime,
            alt: `${content.name} · ${
              format === 'poster'
                ? lang === 'zh'
                  ? '知识海报'
                  : 'History poster'
                : lang === 'zh'
                  ? '分享预览'
                  : 'Share preview'
            }`,
          };
          const cached = await fs.stat(file).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') throw error;
          });
          if (cached?.size) {
            total += cached.size;
            continue;
          }
          if (original && !currentPhoto) {
            currentPhoto = {
              path: image!.src,
              body: await sharp(original)
                .autoOrient()
                .resize({
                  width: 960,
                  height: 600,
                  fit: 'inside',
                  withoutEnlargement: true,
                })
                .png()
                .toBuffer(),
            };
          }
          if (!page) {
            // Fulfill the renderer's loopback requests in-process. No listening
            // socket is needed and every other network request is rejected.
            browser = await chromium.launch({
              ...(process.env.SHARE_CHROMIUM_PATH
                ? { executablePath: process.env.SHARE_CHROMIUM_PATH }
                : {}),
              ...(process.env.SHARE_CHROMIUM_SINGLE_PROCESS === '1'
                ? { args: ['--single-process'] }
                : {}),
            });
            page = await browser.newPage({
              locale: 'en-US',
              timezoneId: 'UTC',
              deviceScaleFactor: 1,
              serviceWorkers: 'block',
            });
            await page.route('**/*', async (route) => {
              const request = new URL(route.request().url());
              if (request.origin !== origin) return route.abort();
              const asset =
                request.pathname === currentPhoto?.path
                  ? { body: currentPhoto.body, contentType: 'image/png' }
                  : staticAssets.get(request.pathname);
              if (asset)
                await route.fulfill({ ...asset, headers: { 'access-control-allow-origin': '*' } });
              else await route.abort();
            });
          }
          const screenshot = await render(
            page,
            markup,
            format,
            lang,
            !(lang === 'zh' || lang === 'en' ? item.share?.[lang].milestones : undefined),
          );
          const bytes = await (
            format === 'poster'
              ? sharp(screenshot).png({ compressionLevel: 9, palette: true, quality: 95 })
              : sharp(screenshot).jpeg({ quality: 84, mozjpeg: true })
          ).toBuffer();
          if (bytes.length > 3_000_000)
            throw new Error(`image exceeds 3 MB (${bytes.length} bytes)`);
          const target = format === 'poster' ? 1_500_000 : 300_000;
          if (bytes.length > target) console.warn(`share: ${relative}: exceeds ${target} bytes`);
          await atomicWrite(file, bytes);
          total += bytes.length;
          generated++;
        } catch (error) {
          throw new Error(`share: ${item.id}/${lang}/${format}: ${String(error)}`, {
            cause: error,
          });
        }
      }
    }
  }

  if (!sampleMode) {
    await atomicWrite(manifestPath, JSON.stringify(manifest) + '\n');
    for (const directory of await fs.readdir(output, { withFileTypes: true })) {
      if (!directory.isDirectory()) continue;
      const dir = path.join(output, directory.name);
      for (const file of await fs.readdir(dir)) {
        const full = path.join(dir, file);
        if (/^(zh|en)-(poster|og)\.[a-f0-9]{16}\.(png|jpg)$/.test(file) && !expected.has(full)) {
          await fs.rm(full);
        }
      }
      if (!(await fs.readdir(dir)).length) await fs.rmdir(dir);
    }
  }
  console.log(
    `share: ${expected.size} images, ${generated} rendered, ${(total / 1e6).toFixed(2)} MB, ${((Date.now() - started) / 1000).toFixed(1)} s`,
  );
} finally {
  await browser?.close();
}
