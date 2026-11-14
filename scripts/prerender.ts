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
import { loadItemsIndex } from '../src/lib/loadItems';
import { IMAGE_SIZES, variantSrcSet } from '../src/lib/images';
import {
  HTML_LANG,
  OG_LOCALE,
  absoluteUrl,
  homeMeta,
  itemMeta,
  itemPath,
  socialImage,
  type PageMeta,
} from '../src/lib/seo';
import {
  OG_IMAGE,
  SITE_NAME,
  SITE_NAME_ZH,
  SITE_URL as CONFIG_SITE_URL,
  TWITTER_SITE,
} from '../src/config/site';
import { formatYear, pick, type Lang } from '../src/lib/i18n';
import type { AtlasItem } from '../src/lib/types';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const ORIGIN = (process.env.SITE_URL || CONFIG_SITE_URL).replace(/\/+$/, '');

const index = loadItemsIndex();
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
const TERM_SET_ID = `${ORIGIN}/#entries`;

function definedTerm(item: AtlasItem, lang: Lang) {
  return {
    '@type': 'DefinedTerm',
    '@id': `${url(itemPath(item.id), lang)}#term`,
    name: pick(lang, item.name_zh, item.name_en),
    alternateName: pick(lang === 'zh' ? 'en' : 'zh', item.name_zh, item.name_en),
    termCode: item.id,
    description: `${formatYear(lang, item.primary_year)} — ${pick(lang, item.summary_zh, item.summary_en)}`,
    url: url(itemPath(item.id), lang),
    ...(item.image?.src ? { image: ORIGIN + item.image.src } : {}),
    inDefinedTermSet: TERM_SET_ID,
  };
}

function homeLd(lang: Lang) {
  const meta = homeMeta(lang, index.count);
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${ORIGIN}/#website`,
      name: SITE_NAME,
      alternateName: SITE_NAME_ZH,
      url: url('/', lang),
      description: meta.description,
      inLanguage: HTML_LANG[lang],
      image: ORIGIN + OG_IMAGE.path,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'DefinedTermSet',
      '@id': TERM_SET_ID,
      name: `${SITE_NAME_ZH} · ${SITE_NAME}`,
      url: url('/', lang),
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
        url: url(itemPath(item.id), lang),
        item: definedTerm(item, lang),
      })),
    },
  ];
}

function itemLd(item: AtlasItem, lang: Lang) {
  return [
    { '@context': 'https://schema.org', ...definedTerm(item, lang), inLanguage: HTML_LANG[lang] },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: SITE_NAME, item: url('/', lang) },
        {
          '@type': 'ListItem',
          position: 2,
          name: pick(lang, item.name_zh, item.name_en),
          item: url(itemPath(item.id), lang),
        },
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

function headTags(meta: PageMeta, item: AtlasItem | null, ld: unknown, lang: Lang) {
  const canonical = url(meta.path, lang);
  const img = socialImage(lang, item, ORIGIN);
  const tags = [
    `<title>${esc(meta.title)}</title>`,
    `<meta name="description" content="${esc(meta.description)}" />`,
    `<link rel="canonical" href="${esc(canonical)}" />`,
    `<link rel="alternate" hreflang="zh-Hans" href="${esc(url(meta.path))}" />`,
    `<link rel="alternate" hreflang="en" href="${esc(url(meta.path, 'en'))}" />`,
    `<link rel="alternate" hreflang="x-default" href="${esc(url(meta.path))}" />`,
    `<meta property="og:type" content="${item ? 'article' : 'website'}" />`,
    `<meta property="og:site_name" content="${esc(`${SITE_NAME} · ${SITE_NAME_ZH}`)}" />`,
    `<meta property="og:title" content="${esc(meta.title)}" />`,
    `<meta property="og:description" content="${esc(meta.description)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    `<meta property="og:locale" content="${OG_LOCALE[lang]}" />`,
    `<meta property="og:locale:alternate" content="${OG_LOCALE[lang === 'zh' ? 'en' : 'zh']}" />`,
    `<meta property="og:image" content="${esc(img.url)}" />`,
    img.width ? `<meta property="og:image:width" content="${img.width}" />` : '',
    img.height ? `<meta property="og:image:height" content="${img.height}" />` : '',
    `<meta property="og:image:type" content="${img.mime}" />`,
    `<meta property="og:image:alt" content="${esc(img.alt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    TWITTER_SITE ? `<meta name="twitter:site" content="${esc(TWITTER_SITE)}" />` : '',
    `<meta name="twitter:title" content="${esc(meta.title)}" />`,
    `<meta name="twitter:description" content="${esc(meta.description)}" />`,
    `<meta name="twitter:image" content="${esc(img.url)}" />`,
    `<meta name="twitter:image:alt" content="${esc(img.alt)}" />`,
    jsonLd(ld),
    imagePreload(item),
  ];
  return tags.filter(Boolean).join('\n    ');
}

/* -------------------------------------------------------------- noscript */
function catalogue(lang: Lang) {
  const rows = index.items
    .map((item) => {
      const href = `${itemPath(item.id)}${lang === 'en' ? '?lang=en' : ''}`;
      return `<li><a href="${href}">${esc(pick(lang, item.name_zh, item.name_en))}</a> — ${esc(formatYear(lang, item.primary_year))}</li>`;
    })
    .join('');
  return `<noscript><nav class="noscript-catalog" aria-label="${lang === 'zh' ? '条目目录' : 'Entry catalogue'}"><p>${lang === 'zh' ? '需要启用 JavaScript 才能使用交互地图。' : 'Enable JavaScript for the interactive map.'}</p><ol>${rows}</ol></nav></noscript>`;
}

/* ---------------------------------------------------------------- render */
function renderPage(item: AtlasItem | null, lang: Lang) {
  const meta = item ? itemMeta(lang, item) : homeMeta(lang, index.count);
  const pathname = itemPath(item?.id ?? null);
  const appHtml = renderToString(
    createElement(
      StrictMode,
      null,
      createElement(App, { url: { pathname, search: lang === 'en' ? '?lang=en' : '' } }),
    ),
  );
  const ld = item ? itemLd(item, lang) : homeLd(lang);
  const html = template
    .replace(/<!--seo:start-->[\s\S]*?<!--seo:end-->/, headTags(meta, item, ld, lang))
    .replace('<!--preload:fonts-->', fontPreloads)
    .replace('<html lang="zh-Hans">', `<html lang="${HTML_LANG[lang]}">`)
    .replace('__SSR_LANG__', lang)
    .replace('__DATA_MAX__', String(index.year_range.data_max))
    .replace('<!--app-html-->', appHtml)
    .replace('<!--noscript-->', item ? '' : catalogue(lang));
  for (const marker of ['<!--seo:start-->', '<!--app-html-->', '<!--noscript-->', '__DATA_MAX__']) {
    if (html.includes(marker)) throw new Error(`prerender: unreplaced marker ${marker}`);
  }
  const languageRoot = lang === 'en' ? path.join(dist, 'en') : dist;
  const out = item
    ? path.join(languageRoot, 'item', item.id, 'index.html')
    : path.join(languageRoot, 'index.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html);
}

if (!template.includes('<!--app-html-->')) {
  throw new Error(
    'prerender: dist/index.html has already been prerendered — run `vite build` first',
  );
}
for (const lang of ['zh', 'en'] as const) {
  renderPage(null, lang);
  for (const item of index.items) renderPage(item, lang);
}

/* -------------------------------------------------------------- 404 page */
const suggestions = index.items.map((item) => ({
  path: itemPath(item.id),
  name: item.name_zh,
  year: formatYear('zh', item.primary_year),
  summary: item.summary_zh || item.summary_en,
}));
const fallback = suggestions[0];
const fallbackCard = fallback
  ? `<a class="card" id="suggested-item" href="${esc(fallback.path)}">
      <span class="year" id="item-year">${esc(fallback.year)}</span>
      <h2 id="item-name">${esc(fallback.name)}</h2>
      <p id="item-summary">${esc(fallback.summary)}</p>
      <span class="explore">在地图上探索 →</span>
    </a>`
  : '<p>返回主页，开启新的探索。</p>';
const notFoundHtml = fs
  .readFileSync(path.join(root, 'scripts/404.html'), 'utf8')
  .replace('/*tokens*/', () => fs.readFileSync(path.join(root, 'src/styles/tokens.css'), 'utf8'))
  .replace('<!--card-->', () => fallbackCard)
  .replace('/*items*/', () => JSON.stringify(suggestions).replace(/</g, '\\u003c'));
fs.writeFileSync(path.join(dist, '404.html'), notFoundHtml);

/* --------------------------------------------------- sitemap + robots */
const lastmod = (d: string) => d.slice(0, 10);
const newest =
  index.items
    .map((i) => i.updated)
    .sort()
    .at(-1) ?? new Date().toISOString();
const entry = (p: string, mod: string, priority: string, lang: Lang) => `  <url>
    <loc>${esc(url(p, lang))}</loc>
    <lastmod>${lastmod(mod)}</lastmod>
    <priority>${priority}</priority>
    <xhtml:link rel="alternate" hreflang="zh-Hans" href="${esc(url(p))}"/>
    <xhtml:link rel="alternate" hreflang="en" href="${esc(url(p, 'en'))}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(url(p))}"/>
  </url>`;
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${(['zh', 'en'] as const).flatMap((lang) => [entry('/', newest, '1.0', lang), ...index.items.map((i) => entry(itemPath(i.id), i.updated, '0.7', lang))]).join('\n')}
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
