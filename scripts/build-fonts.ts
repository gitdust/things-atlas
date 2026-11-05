/**
 * Self-hosted CJK font subsets.
 *
 *   npm run fonts          # (re)build src/assets/fonts/*.woff2
 *   tsx scripts/build-fonts.ts --check   # report characters missing from the subset
 *
 * Noto Sans SC / Noto Serif SC are ~20 MB variable fonts. We subset them to
 * the characters the app actually uses (UI strings + data/) and trim the
 * weight axis to the weights the CSS uses. Each family is split in two files
 * with `unicode-range`, so the first view only downloads the small "core" set
 * (UI strings, category and entry names); the "ext" file (summaries, notes,
 * sources) loads when an entry is opened. Writes src/styles/fonts.css.
 * Latin faces (Inter, Source Serif 4) come from @fontsource-variable packages.
 *
 * Source fonts are downloaded once from github.com/google/fonts (OFL) into
 * node_modules/.cache/. `--check` runs as part of `npm run validate`; when it
 * warns, run `npm run fonts` (missing glyphs would fall back to system fonts).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'src', 'assets', 'fonts');
const charsetPath = path.join(outDir, 'charset.txt');
const cacheDir = path.join(root, 'node_modules', '.cache', 'things-atlas-fonts');

const FAMILIES = [
  {
    family: 'Noto Sans SC Subset',
    out: 'noto-sans-sc',
    file: 'NotoSansSC[wght].ttf',
    url: 'https://github.com/google/fonts/raw/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf',
    // Same weights the site used from Google Fonts (400/500/600); 700 requests resolve to 600.
    wght: { min: 400, max: 600, default: 400 },
  },
  {
    family: 'Noto Serif SC Subset',
    out: 'noto-serif-sc',
    file: 'NotoSerifSC[wght].ttf',
    url: 'https://github.com/google/fonts/raw/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf',
    // 500–700 as before: text set at 400 (lede, notes) resolves to the 500 face.
    wght: { min: 500, max: 700, default: 500 },
  },
] as const;

const addChars = (set: Set<string>, text: string) => {
  for (const ch of text) if (ch.codePointAt(0)! > 0x7e && !/\s/.test(ch)) set.add(ch);
};

function walk(dir: string, re: RegExp, fn: (file: string) => void) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!['generated', 'assets', 'schema'].includes(e.name)) walk(p, re, fn);
    } else if (re.test(e.name)) fn(p);
  }
}

/** Every non-ASCII character used by the UI (src/) or the data (data/). */
function collectChars(): Set<string> {
  const chars = new Set<string>();
  const read = (p: string) => addChars(chars, fs.readFileSync(p, 'utf8'));
  walk(path.join(root, 'src'), /\.(tsx?|json)$/, read);
  walk(path.join(root, 'data'), /\.json$/, read);
  return chars;
}

/** Characters visible before any entry is opened: UI strings, categories, entry names. */
function collectCoreChars(): Set<string> {
  const chars = new Set<string>();
  walk(path.join(root, 'src'), /\.tsx?$/, (p) => addChars(chars, fs.readFileSync(p, 'utf8')));
  addChars(chars, fs.readFileSync(path.join(root, 'data', 'categories.json'), 'utf8'));
  addChars(chars, fs.readFileSync(path.join(root, 'data', 'tags.json'), 'utf8'));
  walk(path.join(root, 'data', 'items'), /\.json$/, (p) =>
    addChars(chars, (JSON.parse(fs.readFileSync(p, 'utf8')) as { name_zh: string }).name_zh),
  );
  return chars;
}

/** Compact CSS unicode-range for a set of characters. */
function unicodeRange(chars: Iterable<string>): string {
  const cps = [...new Set([...chars].map((c) => c.codePointAt(0)!))].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let i = 0; i < cps.length; i++) {
    let j = i;
    while (j + 1 < cps.length && cps[j + 1] === cps[j] + 1) j++;
    const hex = (n: number) => n.toString(16).toUpperCase();
    parts.push(i === j ? `U+${hex(cps[i])}` : `U+${hex(cps[i])}-${hex(cps[j])}`);
    i = j;
  }
  return parts.join(', ');
}

const ASCII = Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) => String.fromCharCode(0x20 + i)).join(
  '',
);

const used = collectChars();

if (process.argv.includes('--check')) {
  const have = new Set(fs.existsSync(charsetPath) ? [...fs.readFileSync(charsetPath, 'utf8')] : []);
  const missing = [...used].filter((c) => !have.has(c) && !/\s/.test(c));
  if (missing.length) {
    console.warn(
      `⚠ fonts: ${missing.length} character(s) not in the CJK font subset: ${missing.slice(0, 40).join('')}\n` +
        '  run `npm run fonts` to rebuild src/assets/fonts (they would render in a system fallback font).',
    );
  } else {
    console.log('✓ fonts: CJK subset covers all characters in src/ and data/');
  }
  process.exit(0);
}

const { default: subsetFont } = await import('subset-font');
fs.mkdirSync(cacheDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });
for (const f of fs.readdirSync(outDir)) if (f.endsWith('.woff2')) fs.rmSync(path.join(outDir, f));

const coreSet = new Set([...ASCII, ...collectCoreChars()]);
const extSet = new Set([...used].filter((c) => !coreSet.has(c)));
const parts = [
  { suffix: 'core', chars: coreSet },
  { suffix: 'ext', chars: extSet },
].filter((p) => p.chars.size > 0);
const css: string[] = [
  '/*',
  ' * GENERATED by `npm run fonts` (scripts/build-fonts.ts) — do not edit.',
  ' * Self-hosted CJK faces: subsets of Noto Sans SC / Noto Serif SC (OFL) split',
  ' * into a small "core" file for the first view and an "ext" file for entry',
  ' * text; browsers fetch each only when a character in its unicode-range is used.',
  ' * Latin faces (Inter, Source Serif 4) come from @fontsource-variable (main.tsx).',
  ' */',
];

for (const fam of FAMILIES) {
  const src = path.join(cacheDir, fam.file);
  if (!fs.existsSync(src)) {
    console.log(`downloading ${fam.file} …`);
    const res = await fetch(fam.url);
    if (!res.ok) throw new Error(`download failed: ${fam.url} (${res.status})`);
    fs.writeFileSync(src, Buffer.from(await res.arrayBuffer()));
  }
  const source = fs.readFileSync(src);
  for (const part of parts) {
    const file = `${fam.out}-${part.suffix}.woff2`;
    const out = await subsetFont(source, [...part.chars].join(''), {
      targetFormat: 'woff2',
      variationAxes: { wght: fam.wght },
      // Horizontal text only: skip vertical/alternate forms pulled in via GSUB.
      noLayoutClosure: true,
    });
    fs.writeFileSync(path.join(outDir, file), out);
    console.log(`${file}: ${part.chars.size} chars, ${(out.length / 1024).toFixed(0)} kB`);
    css.push(
      '',
      '@font-face {',
      `  font-family: '${fam.family}';`,
      '  font-style: normal;',
      `  font-weight: ${fam.wght.min} ${fam.wght.max};`,
      '  font-display: swap;',
      `  src: url('../assets/fonts/${file}') format('woff2');`,
      `  unicode-range: ${unicodeRange(part.chars)};`,
      '}',
    );
  }
}

fs.writeFileSync(path.join(root, 'src', 'styles', 'fonts.css'), css.join('\n') + '\n');
fs.writeFileSync(charsetPath, [...used].sort().join(''));
console.log(`fonts: ${used.size} non-ASCII characters → ${path.relative(root, outDir)}/`);
