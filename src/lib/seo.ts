/**
 * Page metadata shared by the build-time prerenderer (scripts/prerender.ts)
 * and the runtime (App → applyDocumentMeta), so crawlers that don't run JS
 * and those that do see the same titles/descriptions.
 */
import { OG_IMAGE, SITE_NAME, SITE_NAME_ZH, SITE_URL } from '@/config/site';
import { LANGS, pick, type Lang } from './i18n';
import { absoluteUrl, itemPath } from './page-url';
import type { AtlasItem } from './types';
import type { ShareManifest } from './share';
import manifest from '../generated/share-manifest.json';

export { absoluteUrl, itemPath } from './page-url';

export const shareImages: ShareManifest = manifest;

export const HTML_LANG: Record<Lang, string> = { zh: 'zh-Hans', en: 'en', es: 'es', ja: 'ja' };
export const OG_LOCALE: Record<Lang, string> = {
  zh: 'zh_CN',
  en: 'en_US',
  es: 'es_ES',
  ja: 'ja_JP',
};

export type PageMeta = { title: string; description: string; path: string };

function clip(s: string, max = 160): string {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1).trimEnd()}…`;
}

export function homeMeta(lang: Lang, count: number): PageMeta {
  const copy = {
    zh: {
      title: `${SITE_NAME} · ${SITE_NAME_ZH} — 日常之物的发明与普及世界地图`,
      description: `在世界地图与时间轴上探索 ${count} 件日常之物——铅笔、牙刷、拉链、灯泡……它们何时何地被发明、取得专利、量产与普及。每一条都附可查证的来源。`,
    },
    en: {
      title: `${SITE_NAME} — A world map of when and where everyday objects began`,
      description: `Explore when and where ${count} everyday objects — the pencil, toothbrush, zipper, light bulb and more — were invented, patented, mass-produced and popularised, on an interactive world map and timeline. Every entry is sourced.`,
    },
    es: {
      title: `${SITE_NAME} — Un mapa de cuándo y dónde nacieron los objetos cotidianos`,
      description: `Explora cuándo y dónde se inventaron, patentaron, produjeron y popularizaron ${count} objetos cotidianos en un mapa y una línea de tiempo. Cada entrada tiene fuentes.`,
    },
    ja: {
      title: `${SITE_NAME} — 日常のものが始まった時と場所の世界地図`,
      description: `${count} の日常のものについて、発明・特許・量産・普及の時と場所を地図と時間軸で追います。すべての項目に出典があります。`,
    },
  } as const;
  return { ...copy[lang], path: '/' };
}

export function itemMeta(lang: Lang, item: AtlasItem): PageMeta {
  const name = pick(lang, item.name_zh, item.name_en, { ja: item.name_ja });
  const summary = pick(lang, item.summary_zh, item.summary_en, { ja: item.summary_ja });
  const title =
    lang === 'zh'
      ? `${name}的起源与历史 · ${SITE_NAME_ZH}`
      : lang === 'es'
        ? `${name} — Origen e historia | ${SITE_NAME}`
        : lang === 'ja'
          ? `${name}の起源と歴史 | ${SITE_NAME}`
          : `${name} — Origins and history | ${SITE_NAME}`;
  return {
    title,
    description: clip(summary, lang === 'zh' ? 120 : 160),
    path: itemPath(item.id),
  };
}

export function socialImage(lang: Lang, item: AtlasItem | null, origin = SITE_URL) {
  const image = item ? shareImages[item.id]?.[lang]?.og : undefined;
  const selected = image ?? {
    ...OG_IMAGE,
    mime: 'image/jpeg',
    alt:
      lang === 'zh'
        ? SITE_NAME_ZH
        : lang === 'ja'
          ? `${SITE_NAME} · 日常のもの図志`
          : lang === 'es'
            ? `${SITE_NAME} · Atlas de objetos cotidianos`
            : SITE_NAME,
  };
  return { ...selected, url: origin + selected.path };
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
  const image = socialImage(lang, item);
  const socialTags = {
    'og:image': image.url,
    'og:image:width': String(image.width),
    'og:image:height': String(image.height),
    'og:image:type': image.mime,
    'og:image:alt': image.alt,
    'twitter:image': image.url,
    'twitter:image:alt': image.alt,
    'og:type': item ? 'article' : 'website',
    'og:locale:alternate': LANGS.filter((code) => code !== lang)
      .map((code) => OG_LOCALE[code])
      .join(','),
  };
  for (const [name, value] of Object.entries(socialTags)) {
    const key = name.startsWith('twitter:') ? 'name' : 'property';
    upsert(`meta[${key}="${name}"]`, metaEl(key, name), 'content', value);
  }
}
