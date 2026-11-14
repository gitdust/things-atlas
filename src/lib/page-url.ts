import { SITE_URL } from '@/config/site';
import { type Lang } from './i18n';

/** `/` for the atlas, `/item/<id>/` for an entry (prerendered at build time). */
export function itemPath(id: string | null): string {
  return id ? `/item/${encodeURIComponent(id)}/` : '/';
}

/** Chinese stays unprefixed. Other languages use `/en/`, `/es/`, `/ja/`. */
export function localizedPath(path: string, lang: Lang = 'zh'): string {
  if (lang === 'zh') return path;
  return path === '/' ? `/${lang}/` : `/${lang}${path}`;
}

/** Absolute URL of a page. `x-default` callers should pass `en`. */
export function absoluteUrl(path: string, lang: Lang = 'zh', origin = SITE_URL): string {
  return `${origin}${localizedPath(path, lang)}`;
}
