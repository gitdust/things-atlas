import { isLang, type Lang } from './i18n';

export type UrlLike = { pathname: string; search: string };

const PREFIXED = /^\/(en|es|ja)(?=\/|$)/;
const ITEM_PATH = /\/item\/([^/]+)\/?$/;

/**
 * URL state: `/<lang>/item/<id>/` (Chinese has no prefix), legacy `?id=`,
 * `?y=` year, and legacy `?lang=` until the worker redirects it.
 */
export function readUrlState(url: UrlLike) {
  const params = new URLSearchParams(url.search);
  const prefixed = PREFIXED.exec(url.pathname);
  const pathname = prefixed ? url.pathname.slice(prefixed[0].length) || '/' : url.pathname;
  const queryLang = params.get('lang');
  const lang: Lang = prefixed
    ? (prefixed[1] as Lang)
    : isLang(queryLang) && queryLang !== 'zh'
      ? queryLang
      : 'zh';
  const y = params.get('y');
  const pathId = ITEM_PATH.exec(pathname)?.[1];
  const year = y != null && y !== '' && Number.isFinite(Number(y)) ? Number(y) : null;
  return {
    year,
    id: pathId ? decodeURIComponent(pathId) : params.get('id'),
    lang,
  };
}
