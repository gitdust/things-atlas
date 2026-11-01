import type { CategoryId } from './types';
import type { Lang } from './i18n';

export type UrlLike = { pathname: string; search: string };

const ITEM_PATH = /\/item\/([^/]+)\/?$/;

/**
 * URL state: `/item/<id>/` (or legacy `?id=`), `?y=` year, `?cat=a,b`, `?lang=en`.
 */
export function readUrlState(url: UrlLike) {
  const params = new URLSearchParams(url.search);
  const y = params.get('y');
  const cat = params.get('cat');
  const pathId = ITEM_PATH.exec(url.pathname)?.[1];
  const year = y != null && y !== '' && Number.isFinite(Number(y)) ? Number(y) : null;
  return {
    year,
    categories: cat ? (cat.split(',').filter(Boolean) as CategoryId[]) : ([] as CategoryId[]),
    id: pathId ? decodeURIComponent(pathId) : params.get('id'),
    lang: (params.get('lang') === 'en' ? 'en' : 'zh') as Lang,
  };
}
