/**
 * Page metadata shared by the build-time prerenderer (scripts/prerender.ts)
 * and the runtime (App → applyDocumentMeta), so crawlers that don't run JS
 * and those that do see the same titles/descriptions.
 */
import { SITE_NAME, SITE_NAME_ZH, SITE_URL } from '@/config/site';
import { formatYear, type Lang } from './i18n';
import type { AtlasItem } from './types';

export const HTML_LANG: Record<Lang, string> = { zh: 'zh-Hans', en: 'en' };
export const OG_LOCALE: Record<Lang, string> = { zh: 'zh_CN', en: 'en_US' };

export type PageMeta = { title: string; description: string; path: string };

/** `/` for the atlas, `/item/<id>/` for an entry (prerendered at build time). */
export function itemPath(id: string | null): string {
  return id ? `/item/${encodeURIComponent(id)}/` : '/';
}

/** Absolute URL of a page in a language (`zh` is the default, so no param). */
export function absoluteUrl(path: string, lang: Lang = 'zh', origin = SITE_URL): string {
  return `${origin}${path}${lang === 'en' ? '?lang=en' : ''}`;
}

function clip(s: string, max = 160): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

export function homeMeta(lang: Lang, count: number): PageMeta {
  if (lang === 'zh') {
    return {
      title: `${SITE_NAME} · ${SITE_NAME_ZH} — 日常之物的发明与普及世界地图`,
      description: `在世界地图与时间轴上探索 ${count} 件日常之物——铅笔、牙刷、拉链、灯泡……它们何时何地被发明、取得专利、量产与普及。每一条都附可查证的来源。`,
      path: '/',
    };
  }
  return {
    title: `${SITE_NAME} — A world map of when and where everyday objects began`,
    description: `Explore when and where ${count} everyday objects — the pencil, toothbrush, zipper, light bulb and more — were invented, patented, mass-produced and popularised, on an interactive world map and timeline. Every entry is sourced.`,
    path: '/',
  };
}

export function itemMeta(lang: Lang, item: AtlasItem): PageMeta {
  const year = formatYear(lang, item.primary_year);
  if (lang === 'zh') {
    return {
      title: `${item.name_zh}（${item.name_en}）· ${year} · ${SITE_NAME_ZH}`,
      description: clip(item.summary_zh || item.summary_en, 120),
      path: itemPath(item.id),
    };
  }
  return {
    title: `${item.name_en} (${year}) · ${SITE_NAME}`,
    description: clip(item.summary_en || item.summary_zh),
    path: itemPath(item.id),
  };
}

function pageMeta(lang: Lang, item: AtlasItem | null, count: number): PageMeta {
  return item ? itemMeta(lang, item) : homeMeta(lang, count);
}

/* ------------------------------------------------------------- runtime */

function upsert(selector: string, create: () => HTMLElement, attr: string, value: string) {
  let el = document.head.querySelector<HTMLElement>(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

const metaEl = (key: 'name' | 'property', name: string) => () => {
  const m = document.createElement('meta');
  m.setAttribute(key, name);
  return m;
};

/** Keep <html lang>, title, description, canonical and social tags in sync with UI state. */
export function applyDocumentMeta(lang: Lang, item: AtlasItem | null, count: number) {
  const meta = pageMeta(lang, item, count);
  const url = absoluteUrl(meta.path, lang);
  document.documentElement.lang = HTML_LANG[lang];
  document.title = meta.title;
  upsert('meta[name="description"]', metaEl('name', 'description'), 'content', meta.description);
  upsert(
    'link[rel="canonical"]',
    () => Object.assign(document.createElement('link'), { rel: 'canonical' }),
    'href',
    url,
  );
  upsert('meta[property="og:title"]', metaEl('property', 'og:title'), 'content', meta.title);
  upsert(
    'meta[property="og:description"]',
    metaEl('property', 'og:description'),
    'content',
    meta.description,
  );
  upsert('meta[property="og:url"]', metaEl('property', 'og:url'), 'content', url);
  upsert('meta[property="og:locale"]', metaEl('property', 'og:locale'), 'content', OG_LOCALE[lang]);
  upsert('meta[name="twitter:title"]', metaEl('name', 'twitter:title'), 'content', meta.title);
  upsert(
    'meta[name="twitter:description"]',
    metaEl('name', 'twitter:description'),
    'content',
    meta.description,
  );
}
