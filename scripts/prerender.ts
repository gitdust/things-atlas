/**
 * Build-time prerender + SEO artefacts. Runs after `vite build`:
 *
 *  - renders the app shell to static HTML (react-dom/server) for `/` and for
 *    every entry at `/item/<id>/`, so the first paint needs no JS and crawlers
 *    get real content; main.tsx hydrates it
 *  - per-page <title>, description, canonical, hreflang, Open Graph, Twitter
 *    card and JSON-LD (WebSite + ItemList of DefinedTerms / DefinedTerm)
 *  - a <noscript> catalogue of every entry (zh + en names and years)
 *  - preloads for the critical Latin font subsets
 *  - sitemap.xml and robots.txt
 *
 * SITE_URL comes from src/config/site.ts (placeholder) or the SITE_URL env var.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { StrictMode, createElement } from 'react';
import { renderToString } from 'react-dom/server';
import App from '../src/App';
import { loadCategories, loadItemsIndex } from '../src/lib/loadItems';
import { IMAGE_SIZES, variantSrcSet } from '../src/lib/images';
import {
  OG_LOCALE,
  absoluteUrl,
  homeMeta,
  itemMeta,
  itemPath,
  type PageMeta,
} from '../src/lib/seo';
import {
  OG_IMAGE,
  SITE_NAME,
  SITE_NAME_ZH,
  SITE_URL as CONFIG_SITE_URL,
  TWITTER_SITE,
} from '../src/config/site';
import { formatYear } from '../src/lib/i18n';
import type { AtlasItem } from '../src/lib/types';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const ORIGIN = (process.env.SITE_URL || CONFIG_SITE_URL).replace(/\/+$/, '');

const index = loadItemsIndex();
const categories = loadCategories();
const catName = new Map(categories.map((c) => [c.id, c]));
const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const jsonLd = (data: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
const url = (p: string, lang: 'zh' | 'en' = 'zh') => absoluteUrl(p, lang, ORIGIN);

/* ---------------------------------------------------------------- fonts */
const assets = fs.readdirSync(path.join(dist, 'assets'));
const CRITICAL_FONTS = [
  /^inter-latin-wght-normal-.*\.woff2$/,
  /^source-serif-4-latin-opsz-normal-.*\.woff2$/,
];
const fontPreloads = CRITICAL_FONTS.map((re) => assets.find((f) => re.test(f)))
  .filter((f): f is string => Boolean(f))
  .map((f) => `<link rel="preload" href="/assets/${f}" as="font" type="font/woff2" crossorigin />`)
  .join('\n    ');
if (!fontPreloads) console.warn('prerender: no critical font files found to preload');

/* ------------------------------------------------------------ structured */
function imageFor(item: AtlasItem | null) {
  if (item?.image?.src) {
    return {
      url: ORIGIN + item.image.src,
      width: item.image.width,
      height: item.image.height,
      alt: item.image.alt_en,
    };
  }
  return {
    url: ORIGIN + OG_IMAGE.path,
    width: OG_IMAGE.width,
    height: OG_IMAGE.height,
    alt: `${SITE_NAME} · ${SITE_NAME_ZH}`,
  };
}

const TERM_SET_ID = `${ORIGIN}/#entries`;

function definedTerm(item: AtlasItem) {
  return {
    '@type': 'DefinedTerm',
    '@id': `${url(itemPath(item.id))}#term`,
    name: item.name_zh,
    alternateName: item.name_en,
    termCode: item.id,
    description: `${formatYear('en', item.primary_year)} — ${item.summary_en}`,
    url: url(itemPath(item.id)),
    ...(item.image?.src ? { image: ORIGIN + item.image.src } : {}),
    inDefinedTermSet: TERM_SET_ID,
  };
}

function homeLd() {
  const zh = homeMeta('zh', index.count);
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${ORIGIN}/#website`,
      name: SITE_NAME,
      alternateName: SITE_NAME_ZH,
      url: url('/'),
      description: zh.description,
      inLanguage: ['zh-Hans', 'en'],
      image: ORIGIN + OG_IMAGE.path,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'DefinedTermSet',
      '@id': TERM_SET_ID,
      name: `${SITE_NAME_ZH} · ${SITE_NAME}`,
      url: url('/'),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: `${SITE_NAME} — ${index.count} everyday objects`,
      numberOfItems: index.count,
      itemListOrder: 'https://schema.org/ItemListOrderAscending',
      itemListElement: index.items.map((item, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: url(itemPath(item.id)),
        item: definedTerm(item),
      })),
    },
  ];
}

function itemLd(item: AtlasItem) {
  return [
    { '@context': 'https://schema.org', ...definedTerm(item), inLanguage: ['zh-Hans', 'en'] },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE_NAME, item: url('/') },
        { '@type': 'ListItem', position: 2, name: item.name_zh, item: url(itemPath(item.id)) },
      ],
    },
  ];
}

/* ------------------------------------------------------------------ head */
/** Entry pages open with the drawer photo on screen: fetch it in parallel with the JS. */
function imagePreload(item: AtlasItem | null) {
  const widths = item?.image?.widths;
  if (!item?.image?.src || !widths?.length) return '';
  return `<link rel="preload" as="image" type="image/avif" imagesrcset="${esc(
    variantSrcSet(item.image.src, widths, 'avif'),
  )}" imagesizes="${esc(IMAGE_SIZES)}" fetchpriority="high" />`;
}

function headTags(meta: PageMeta, item: AtlasItem | null, ld: unknown) {
  const canonical = url(meta.path);
  const img = imageFor(item);
  const tags = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<link rel="canonical" href="${esc(canonical)}" />`,
    `<link rel="alternate" hreflang="zh-Hans" href="${esc(canonical)}" />`,
    `<link rel="alternate" hreflang="en" href="${esc(url(meta.path, 'en'))}" />`,
    `<link rel="alternate" hreflang="x-default" href="${esc(canonical)}" />`,
    `<meta property="og:type" content="${item ? 'article' : 'website'}" />`,
    `<meta property="og:site_name" content="${esc(`${SITE_NAME} · ${SITE_NAME_ZH}`)}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta property="og:locale" content="${OG_LOCALE.zh}" />`,
    `<meta property="og:locale:alternate" content="${OG_LOCALE.en}" />`,
    `<meta property="og:image" content="${esc(img.url)}" />`,
    img.width ? `<meta property="og:image:width" content="${img.width}" />` : '',
    img.height ? `<meta property="og:image:height" content="${img.height}" />` : '',
    `<meta property="og:image:alt" content="${esc(img.alt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    TWITTER_SITE ? `<meta name="twitter:site" content="${esc(TWITTER_SITE)}" />` : '',
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${esc(img.url)}" />`,
    jsonLd(ld),
    imagePreload(item),
  ];
  return tags.filter(Boolean).join('\n    ');
}

/* -------------------------------------------------------------- noscript */
const catalogue = (() => {
  const rows = index.items
    .map((item) => {
      const c = catName.get(item.category);
      const yZh = formatYear('zh', item.primary_year);
      const yEn = formatYear('en', item.primary_year);
      const year = yZh === yEn ? yZh : `${yZh} / ${yEn}`;
      const cat = c ? ` · ${esc(c.name_zh)} / ${esc(c.name_en)}` : '';
      return `<li><a href="${itemPath(item.id)}">${esc(item.name_zh)} · ${esc(item.name_en)}</a> — ${esc(year)}${cat}</li>`;
    })
    .join('');
  const zh = homeMeta('zh', index.count);
  const en = homeMeta('en', index.count);
  return `<noscript><div class="noscript-catalog"><h1><a href="/">${SITE_NAME} · ${SITE_NAME_ZH}</a></h1><p>${esc(
    zh.description,
  )}</p><p lang="en">${esc(en.description)}</p><p>需要启用 JavaScript 才能使用交互地图。 · Enable JavaScript for the interactive map.</p><ol>${rows}</ol></div></noscript>`;
})();

/* ---------------------------------------------------------------- render */
function renderPage(item: AtlasItem | null) {
  const meta = item ? itemMeta('zh', item) : homeMeta('zh', index.count);
  const pathname = itemPath(item?.id ?? null);
  const appHtml = renderToString(
    createElement(StrictMode, null, createElement(App, { url: { pathname, search: '' } })),
  );
  const ld = item ? itemLd(item) : homeLd();
  const html = template
    .replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, headTags(meta, item, ld))
    .replace('<!--preload:fonts-->', fontPreloads)
    .replace('__DATA_MAX__', String(index.year_range.data_max))
    .replace('<!--app-html-->', appHtml)
    .replace('<!--noscript-->', catalogue);
  for (const marker of ['<!--seo:start-->', '<!--app-html-->', '<!--noscript-->', '__DATA_MAX__']) {
    if (html.includes(marker)) throw new Error(`prerender: unreplaced marker ${marker}`);
  }
  const out = item ? path.join(dist, 'item', item.id, 'index.html') : path.join(dist, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
}

if (!template.includes('<!--app-html-->')) {
  throw new Error(
    'prerender: dist/index.html has already been prerendered — run `vite build` first',
  );
}
renderPage(null);
for (const item of index.items) renderPage(item);

/* --------------------------------------------------- sitemap + robots */
const lastmod = (d: string) => d.slice(0, 10);
const newest =
  index.items
    .map((i) => i.updated)
    .sort()
    .at(-1) ?? new Date().toISOString();
const entry = (p: string, mod: string, priority: string) => `  <url>
    <loc>${esc(url(p))}</loc>
    <lastmod>${lastmod(mod)}</lastmod>
    <priority>${priority}</priority>
    <xhtml:link rel="alternate" hreflang="zh-Hans" href="${esc(url(p))}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${esc(url(p, 'en'))}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(url(p))}"/>
  </url>`;
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${[entry('/', newest, '1.0'), ...index.items.map((i) => entry(itemPath(i.id), i.updated, '0.7'))].join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(dist, 'sitemap.xml'), sitemap);
fs.writeFileSync(
  path.join(dist, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${ORIGIN}/sitemap.xml\n`,
);

console.log(
  `prerender: / + ${index.items.length} entry pages, sitemap.xml, robots.txt (SITE_URL=${ORIGIN}${
    ORIGIN === CONFIG_SITE_URL && /example\.com/.test(ORIGIN) ? ' — placeholder!' : ''
  })`,
);
