import { SITE_URL } from '@/config/site';
import type { Lang } from './i18n';

/** `/` for the atlas, `/item/<id>/` for an entry (prerendered at build time). */
export function itemPath(id: string | null): string {
  return id ? `/item/${encodeURIComponent(id)}/` : '/';
}

/** Absolute URL of a page in a language (`zh` is the default, so no param). */
export function absoluteUrl(path: string, lang: Lang = 'zh', origin = SITE_URL): string {
  return `${origin}${path}${lang === 'en' ? '?lang=en' : ''}`;
}
