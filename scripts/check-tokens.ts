/**
 * Design-token guard (runs in `npm run lint`).
 *
 * 1. src/lib/tokens.ts (used by MapLibre paint expressions and JS logic) must
 *    mirror the matching custom properties in src/styles/tokens.css.
 * 2. Raw colour literals belong in tokens.css only: other stylesheets and
 *    components must reference tokens.
 * 3. Media queries may only use the breakpoint tokens (custom properties
 *    can't be used inside @media, so the values are checked here).
 * 4. index.html theme-color and the web manifest use the theme colour token.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { breakpoint, cssVarMirror, themeColor } from '../src/lib/tokens';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (p: string) => path.relative(root, p);
const errors: string[] = [];

const norm = (v: string) => v.trim().replace(/\s+/g, ' ').replace(/,\s*/g, ', ').toLowerCase();

// 1. JS mirror ↔ CSS
const tokensCss = fs.readFileSync(path.join(root, 'src/styles/tokens.css'), 'utf8');
const cssVars = new Map<string, string>();
for (const m of tokensCss.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) cssVars.set(m[1], m[2]);
for (const [name, value] of Object.entries(cssVarMirror())) {
  const css = cssVars.get(name);
  if (css === undefined)
    errors.push(`tokens.css is missing ${name} (defined in src/lib/tokens.ts)`);
  else if (norm(css) !== norm(value))
    errors.push(`${name}: tokens.css has "${css.trim()}" but src/lib/tokens.ts has "${value}"`);
}

// 2. + 3. scan stylesheets and components
const files: string[] = [];
const walk = (dir: string) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'generated') walk(p);
    } else if (/\.(css|tsx)$/.test(e.name)) files.push(p);
  }
};
walk(path.join(root, 'src'));

const allowedBp = new Set(Object.values(breakpoint).map((v) => `${v}px`));
for (const file of files) {
  if (file.endsWith(path.join('styles', 'tokens.css')) || file.endsWith('fonts.css')) continue;
  const src = fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  src.split('\n').forEach((line, i) => {
    const at = `${rel(file)}:${i + 1}`;
    const lit = line.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/);
    if (lit && !/^\s*\/\//.test(line)) errors.push(`${at}: raw colour "${lit[0]}…" — use a token`);
    for (const m of line.matchAll(/@media[^{]*?(\d+)px/g)) {
      if (!allowedBp.has(`${m[1]}px`))
        errors.push(`${at}: media query uses ${m[1]}px — use a --bp-* value`);
    }
  });
}

// 4. theme colour outside src/
for (const file of ['index.html', 'public/manifest.webmanifest']) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  for (const m of text.matchAll(
    /(?:theme-color" content="|"(?:theme|background)_color":\s*")(#[0-9a-fA-F]+)/g,
  )) {
    if (m[1].toLowerCase() !== themeColor)
      errors.push(`${file}: ${m[1]} should be the theme colour ${themeColor}`);
  }
}

if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join('\n'));
  process.exit(1);
}
console.log(`✓ tokens: JS mirror matches tokens.css; ${files.length} files use tokens only`);
