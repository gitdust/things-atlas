import type { Lang } from './i18n';

export type UrlLike = { pathname: string; search: string };

const ITEM_PATH = /\/item\/([^/]+)\/?$/;

/**
 * URL state: `/item/<id>/` (or legacy `?id=`), `?y=` year, `?lang=en`.
 */
export function readUrlState(url: UrlLike) {
  const params = new URLSearchParams(url.search);
  const y = params.get('y');
  const pathId = ITEM_PATH.exec(url.pathname)?.[1];
  const year = y != null && y !== '' && Number.isFinite(Number(y)) ? Number(y) : null;
  return {
    year,
    id: pathId ? decodeURIComponent(pathId) : params.get('id'),
    lang: (params.get('lang') === 'en' ? 'en' : 'zh') as Lang,
  };
}
