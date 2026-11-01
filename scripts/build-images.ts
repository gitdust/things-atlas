/**
 * Responsive image variants for public/images/*.jpg.
 *
 *   npm run images
 *
 * Writes AVIF + WebP at 480w / 960w (never upscaled) to public/images/opt/
 * and the intrinsic sizes to data/images.json, which build-index.ts merges
 * into each item's `image` so the drawer can emit <picture> + srcset with
 * width/height. Re-run after adding or replacing a photo; existing, newer
 * variants are skipped.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = path.join(root, 'public', 'images');
const outDir = path.join(srcDir, 'opt');
const manifestPath = path.join(root, 'data', 'images.json');

export const TARGET_WIDTHS = [480, 960] as const;
const FORMATS = {
  avif: { quality: 52, effort: 4 },
  webp: { quality: 78, effort: 6 },
} as const;

type Entry = { width: number; height: number; widths: number[] };

fs.mkdirSync(outDir, { recursive: true });
const files = fs
  .readdirSync(srcDir)
  .filter((f) => /\.(jpe?g|png)$/i.test(f))
  .sort();

const manifest: Record<string, Entry> = {};
let written = 0;
for (const file of files) {
  const input = path.join(srcDir, file);
  const base = file.replace(/\.[^.]+$/, '');
  const meta = await sharp(input).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const widths = [...new Set(TARGET_WIDTHS.map((w) => Math.min(w, width)))];
  const srcTime = fs.statSync(input).mtimeMs;
  for (const w of widths) {
    for (const [fmt, opts] of Object.entries(FORMATS)) {
      const out = path.join(outDir, `${base}-${w}.${fmt}`);
      if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= srcTime) continue;
      const img = sharp(input).rotate().resize({ width: w, withoutEnlargement: true });
      await (fmt === 'avif' ? img.avif(opts) : img.webp(opts)).toFile(out);
      written++;
    }
  }
  manifest[file] = { width, height, widths };
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`images: ${files.length} sources, ${written} variants written → public/images/opt/`);
