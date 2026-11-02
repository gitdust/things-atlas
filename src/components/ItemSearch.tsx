import { useState } from 'react';
import { pick, t, tf, type Lang } from '@/lib/i18n';
import type { AtlasItem } from '@/lib/types';

type Props = {
  lang: Lang;
  items: AtlasItem[];
  onSearch: () => void;
  onSelect: (id: string) => void;
};

export function ItemSearch({ lang, items, onSearch, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const term = query.trim();
  const normalized = term.normalize('NFKC').toLocaleLowerCase();
  // Search the complete collection, regardless of map filters.
  const matches = normalized
    ? items.filter((item) =>
        [item.name_zh, item.name_en, item.id].some((name) =>
          name.normalize('NFKC').toLocaleLowerCase().includes(normalized),
        ),
      )
    : [];
  const issueUrl = new URL('https://github.com/gitdust/things-atlas/issues/new');
  issueUrl.searchParams.set('title', `add: ${term}`);

  const select = (id: string) => {
    onSelect(id);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="item-search-row">
      <div
        className="item-search"
        onFocus={() => {
          setOpen(true);
          onSearch();
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
      >
        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            if (matches.length) select(matches[0].id);
            else setOpen(true);
          }}
        >
          <input
            type="search"
            aria-label={t(lang, 'search')}
            placeholder={t(lang, 'searchPlaceholder')}
            aria-controls="item-search-results"
            autoComplete="off"
            maxLength={120}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
          />
        </form>
        {open && term ? (
          <div className="search-results" id="item-search-results">
            <p role="status">
              {matches.length
                ? tf(lang, 'searchCount', { n: matches.length })
                : t(lang, 'searchEmpty')}
            </p>
            {matches.length ? (
              <ul>
                {matches.map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => select(item.id)}>
                      <span>{pick(lang, item.name_zh, item.name_en)}</span>
                      <small>{pick(lang, item.name_en, item.name_zh)}</small>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <>
                <p>{t(lang, 'searchSuggestHint')}</p>
                <a href={issueUrl.href} target="_blank" rel="noopener noreferrer">
                  {t(lang, 'searchSuggest')}
                </a>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
