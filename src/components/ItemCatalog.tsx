import { DisputeIcon } from './DisputeIcon';
import { useMemo, useState } from 'react';
import type { AtlasItem } from '@/lib/types';
import { formatYear, pick, t, type Lang } from '@/lib/i18n';

type Props = {
  lang: Lang;
  items: AtlasItem[];
  showDisputed: boolean;
  onShowDisputed: (value: boolean) => void;
  onSelect: (id: string) => void;
};
export function ItemCatalog({ lang, items, showDisputed, onShowDisputed, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => {
    const term = query.trim().normalize('NFKC').toLocaleLowerCase();
    const result = new Map<string, AtlasItem[]>();
    [...items]
      .sort((a, b) => a.primary_year - b.primary_year || a.id.localeCompare(b.id))
      .forEach((item) => {
        if (!showDisputed && item.disputed) return;
        if (
          term &&
          ![item.name_zh, item.name_en, item.id].some((n) =>
            n.normalize('NFKC').toLocaleLowerCase().includes(term),
          )
        )
          return;
        const y = item.primary_year;
        const label =
          y < 1
            ? lang === 'zh'
              ? '公元前'
              : 'BCE'
            : y < 1000
              ? lang === 'zh'
                ? '公元 1–999 年'
                : '1–999 CE'
              : `${Math.floor(y / 100) * 100}–${Math.floor(y / 100) * 100 + 99}`;
        result.set(label, [...(result.get(label) ?? []), item]);
      });
    return [...result];
  }, [items, query, lang, showDisputed]);
  const issue = new URL('https://github.com/gitdust/things-atlas/issues/new');
  issue.searchParams.set('title', `add: ${query.trim()}`);
  return (
    <aside className="drawer catalog" aria-label={lang === 'zh' ? '条目目录' : 'Entry catalogue'}>
      <header className="catalog-head">
        <h2>{lang === 'zh' ? '日常之物' : 'Everyday things'}</h2>
        <div className="catalog-search">
          <input
            type="search"
            aria-label={t(lang, 'search')}
            placeholder={t(lang, 'searchPlaceholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span
            className="catalog-search-count num"
            aria-live="polite"
            aria-label={lang === 'zh' ? '匹配数 / 总数' : 'Matches / total'}
          >
            {groups.reduce((n, [, rows]) => n + rows.length, 0)} / {items.length}
          </span>
        </div>
        <label className="switch catalog-dispute-switch">
          <input
            type="checkbox"
            checked={showDisputed}
            onChange={(e) => onShowDisputed(e.target.checked)}
          />
          <span className="switch-track" aria-hidden="true">
            <span className="switch-knob" />
          </span>
          <DisputeIcon label={t(lang, 'disputed')} />
          <span>{t(lang, 'showDisputed')}</span>
        </label>
      </header>
      <div className="catalog-scroll">
        {groups.map(([label, rows]) => (
          <section key={label} className="catalog-group">
            <h3>{label}</h3>
            <ul>
              {rows.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => onSelect(item.id)}>
                    <span className="catalog-year num">{formatYear(lang, item.primary_year)}</span>
                    <span>
                      {pick(lang, item.name_zh, item.name_en)}
                      {item.disputed ? <DisputeIcon label={t(lang, 'disputed')} /> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {!groups.length ? (
          <div className="catalog-empty">
            <p>{t(lang, 'searchEmpty')}</p>
            <p>{t(lang, 'searchSuggestHint')}</p>
            <a href={issue.href} target="_blank" rel="noopener noreferrer">
              {t(lang, 'searchSuggest')}
            </a>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
