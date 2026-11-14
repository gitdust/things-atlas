import { formatYear, type Lang } from './i18n';
import { YEAR_KEYS } from './primaryYear';
import { absoluteUrl, itemPath } from './page-url';
import type { AtlasItem, YearMark } from './types';

export const SHARE_LANGUAGES = ['zh', 'en'] as const;
export const SHARE_FORMATS = {
  poster: { width: 1080, height: 1440, mime: 'image/png', ext: 'png' },
  og: { width: 1200, height: 630, mime: 'image/jpeg', ext: 'jpg' },
} as const;

export type ShareFormat = keyof typeof SHARE_FORMATS;
export type ShareImage = { path: string; width: number; height: number; mime: string; alt: string };
export type ShareManifest = Record<string, Partial<Record<Lang, Record<ShareFormat, ShareImage>>>>;

export function shareUrl(id: string, lang: Lang) {
  return absoluteUrl(itemPath(id), lang);
}

export function shareYear(lang: Lang, mark: NonNullable<YearMark>) {
  const year = formatYear(lang, mark.year);
  const approximate = mark.precision === 'decade' || mark.precision === 'century';
  if (lang === 'zh') return `${approximate ? '约 ' : ''}${year} 年`;
  if (lang === 'ja') return `${approximate ? '約' : ''}${year}年`;
  if (lang === 'es') return `${approximate ? 'c. ' : ''}${year}`;
  return `${approximate ? 'c. ' : ''}${year}`;
}

export function shareContent(item: AtlasItem, lang: Lang) {
  const name = lang === 'es' || lang === 'ja' ? item.name_en : item[`name_${lang}`];
  const editorial = lang === 'zh' || lang === 'en' ? item.share?.[lang] : undefined;
  const summary = editorial?.summary ?? (lang === 'zh' ? item.summary_zh : item.summary_en);
  const ogSummary = editorial?.ogSummary ?? summary;
  const source = item.sources[0]?.title;
  for (const [field, value] of Object.entries({ name, summary, ogSummary, source })) {
    if (!value?.trim()) throw new Error(`${item.id}: missing ${lang} share ${field}`);
  }

  // Existing notes carry the historical context even when the data key is "invention".
  // A neutral label avoids turning written records or discoveries into invention claims.
  const primary =
    item.primary && item.years[item.primary]
      ? item.primary
      : YEAR_KEYS.find((key) => item.years[key]);
  const keys = primary ? [primary, ...YEAR_KEYS.filter((key) => key !== primary)] : YEAR_KEYS;
  const candidates =
    editorial?.milestones ??
    keys.flatMap((yearKey) => {
      const mark = item.years[yearKey];
      const note = lang === 'zh' ? mark?.ref_zh : mark?.ref;
      return note?.trim() ? [{ yearKey, label: '', text: note }] : [];
    });

  const seen = new Set<number>();
  const milestones = candidates
    .flatMap(({ yearKey, label, text }) => {
      const mark = item.years[yearKey];
      if (!mark)
        throw new Error(`${item.id}: share.${lang}.milestones references missing years.${yearKey}`);
      if (seen.has(mark.year)) return [];
      seen.add(mark.year);
      return [{ year: mark.year, date: shareYear(lang, mark), label, text }];
    })
    .slice(0, 3)
    .sort((a, b) => a.year - b.year);

  return {
    name,
    summary,
    ogSummary,
    source,
    milestones,
    dispute: item.disputed
      ? lang === 'zh'
        ? '起源存在争议'
        : lang === 'ja'
          ? '起源には異説がある'
          : lang === 'es'
            ? 'El origen está en disputa'
            : 'Origins disputed'
      : '',
  };
}
