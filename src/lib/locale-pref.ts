import { isLang, type Lang } from './i18n';

export const LANG_COOKIE = 'atlas_lang';

export function matchLang(tag: string): Lang | null {
  const base = tag.trim().toLowerCase().split('-')[0];
  return base === 'zh' || base === 'en' || base === 'es' || base === 'ja' ? base : null;
}

/** First supported language in an Accept-Language header, honouring q values. */
export function negotiateLang(header: string | null): Lang | null {
  if (!header) return null;
  const ranked = header
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const quality = params.map((item) => item.trim()).find((item) => item.startsWith('q='));
      const value = quality ? Number(quality.slice(2)) : 1;
      return { tag, q: Number.isFinite(value) ? value : 0 };
    })
    .filter((item) => item.tag && item.q > 0)
    .sort((a, b) => b.q - a.q);
  for (const item of ranked) {
    const lang = matchLang(item.tag);
    if (lang) return lang;
  }
  return null;
}

export function langFromCookie(header: string | null): Lang | null {
  if (!header) return null;
  const match = new RegExp(`(?:^|;)\\s*${LANG_COOKIE}=(zh|en|es|ja)(?:;|$)`).exec(header);
  return match && isLang(match[1]) ? match[1] : null;
}

export function rememberLang(lang: Lang) {
  document.cookie = `${LANG_COOKIE}=${lang}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
