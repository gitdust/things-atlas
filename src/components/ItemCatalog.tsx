import { useMemo, useState } from 'react';
import type { AtlasItem } from '@/lib/types';
import { formatYear, pick, t, type Lang } from '@/lib/i18n';

type Props = { lang: Lang; items: AtlasItem[]; onSelect: (id: string) => void };
export function ItemCatalog({ lang, items, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const groups = useMemo(() => {
    const term = query.trim().normalize('NFKC').toLocaleLowerCase();
    const result = new Map<string, AtlasItem[]>();
    [...items]
      .sort((a, b) => a.primary_year - b.primary_year || a.id.localeCompare(b.id))
      .forEach((item) => {
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
  }, [items, query, lang]);
  const issue = new URL('https://github.com/gitdust/things-atlas/issues/new');
  issue.searchParams.set('title', `add: ${query.trim()}`);
  return (
    <aside className="drawer catalog" aria-label={lang === 'zh' ? '条目目录' : 'Entry catalogue'}>
      <header className="catalog-head">
        <h2>{lang === 'zh' ? '日常之物' : 'Everyday things'}</h2>
        <p>
          {lang === 'zh'
            ? `按年代浏览全部 ${items.length} 个条目`
            : `Browse all ${items.length} entries by date`}
        </p>
        <input
          type="search"
          aria-label={t(lang, 'search')}
          placeholder={t(lang, 'searchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <p aria-live="polite">
          {lang === 'zh'
            ? `${groups.reduce((n, [, rows]) => n + rows.length, 0)} 个条目`
            : `${groups.reduce((n, [, rows]) => n + rows.length, 0)} entries`}
        </p>
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
                      {item.disputed ? (
                        <small>{lang === 'zh' ? ' · 有争议' : ' · Disputed'}</small>
                      ) : null}
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
