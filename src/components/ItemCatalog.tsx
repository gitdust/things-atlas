import { DisputeIcon } from './DisputeIcon';
import { useId, useMemo, useState } from 'react';
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
  const countId = useId();
  const term = query.trim().normalize('NFKC').toLowerCase();
  const catalog = useMemo(
    () =>
      [...items]
        .sort((a, b) => a.primary_year - b.primary_year || a.id.localeCompare(b.id))
        .map((item) => ({
          item,
          terms: [item.name_zh, item.name_en, item.id].map((name) =>
            name.normalize('NFKC').toLowerCase(),
          ),
        })),
    [items],
  );
  const { groups, matchCount } = useMemo(() => {
    const result = new Map<string, AtlasItem[]>();
    let matchCount = 0;
    for (const { item, terms } of catalog) {
      if ((!showDisputed && item.disputed) || (term && !terms.some((name) => name.includes(term))))
        continue;
      const year = item.primary_year;
      const label =
        year < 1
          ? lang === 'zh'
            ? '公元前'
            : 'BCE'
          : year < 1000
            ? lang === 'zh'
              ? '公元 1–999 年'
              : '1–999 CE'
            : `${Math.floor(year / 100) * 100}–${Math.floor(year / 100) * 100 + 99}`;
      const group = result.get(label);
      if (group) group.push(item);
      else result.set(label, [item]);
      matchCount++;
    }
    return { groups: [...result], matchCount };
  }, [catalog, term, lang, showDisputed]);
  const issue = new URL('https://github.com/gitdust/things-atlas/issues/new');
  issue.searchParams.set('title', `add: ${query.trim()}`);
  return (
    <aside className="drawer catalog" aria-label={lang === 'zh' ? '条目目录' : 'Entry catalogue'}>
      <header className="catalog-head">
        <h2>{lang === 'zh' ? '日常之物' : 'Everyday things'}</h2>
        <form
          className="catalog-search"
          role="search"
          aria-label={t(lang, 'search')}
          onSubmit={(event) => event.preventDefault()}
        >
          <input
            type="search"
            aria-label={t(lang, 'search')}
            placeholder={t(lang, 'searchPlaceholder')}
            aria-describedby={countId}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span
            id={countId}
            className="catalog-search-count num"
            role="status"
            aria-live="polite"
            aria-label={
              lang === 'zh'
                ? `${matchCount} 个匹配条目，共 ${items.length} 个条目`
                : `${matchCount} matching entries out of ${items.length}`
            }
          >
            {matchCount} / {items.length}
          </span>
        </form>
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
                  <button type="button" data-item-id={item.id} onClick={() => onSelect(item.id)}>
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
