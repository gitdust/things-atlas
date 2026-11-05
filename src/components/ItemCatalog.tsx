import tagData from '../../data/tags.json';
import { DisputeIcon } from './DisputeIcon';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
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
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const tagsRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = tagsRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    updateScrollState();
    const raf = requestAnimationFrame(updateScrollState);
    const el = tagsRef.current;
    if (!el) return () => cancelAnimationFrame(raf);
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [updateScrollState, lang]);

  const scrollByOffset = (direction: 'left' | 'right') => {
    const el = tagsRef.current;
    if (!el) return;
    const offset = direction === 'left' ? -160 : 160;
    el.scrollBy({ left: offset, behavior: 'smooth' });
  };
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
      if (
        (!showDisputed && item.disputed) ||
        (term && !terms.some((name) => name.includes(term))) ||
        !selectedTags.every((tag) => item.tags?.includes(tag))
      )
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
  }, [catalog, term, lang, showDisputed, selectedTags]);
  const issue = new URL('https://github.com/gitdust/things-atlas/issues/new');
  issue.searchParams.set('title', `add: ${query.trim()}`);
  return (
    <aside className="drawer catalog" aria-label={lang === 'zh' ? '条目目录' : 'Entry catalogue'}>
      <header className="catalog-head">
        <div className="catalog-title-row">
          <h2>{lang === 'zh' ? '日常之物' : 'Everyday things'}</h2>
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
            <span>{t(lang, 'disputed')}</span>
          </label>
        </div>
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
        <div
          className="catalog-tags-wrap"
          data-can-scroll-left={canScrollLeft}
          data-can-scroll-right={canScrollRight}
        >
          <button
            type="button"
            className="tags-scroll-btn tags-scroll-left"
            aria-label={lang === 'zh' ? '向左滑动标签' : 'Scroll tags left'}
            onClick={() => scrollByOffset('left')}
            tabIndex={-1}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10 3.5 5.5 8l4.5 4.5" />
            </svg>
          </button>
          <div
            ref={tagsRef}
            className="catalog-tags"
            role="group"
            aria-label={lang === 'zh' ? '标签筛选（同时符合）' : 'Filter tags (match all)'}
            onScroll={updateScrollState}
            onWheel={(e) => {
              if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.currentTarget.scrollLeft += e.deltaY;
              }
            }}
          >
            <button
              type="button"
              aria-pressed={!selectedTags.length}
              onClick={() => {
                setSelectedTags([]);
                tagsRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
              }}
            >
              {lang === 'zh' ? '全部' : 'All'}
            </button>
            {tagData.tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                aria-pressed={selectedTags.includes(tag.id)}
                onClick={(e) => {
                  setSelectedTags((current) =>
                    current.includes(tag.id)
                      ? current.filter((id) => id !== tag.id)
                      : [...current, tag.id],
                  );
                  e.currentTarget.scrollIntoView({
                    behavior: 'smooth',
                    inline: 'nearest',
                    block: 'nearest',
                  });
                }}
              >
                {pick(lang, tag.name_zh, tag.name_en)}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="tags-scroll-btn tags-scroll-right"
            aria-label={lang === 'zh' ? '向右滑动标签' : 'Scroll tags right'}
            onClick={() => scrollByOffset('right')}
            tabIndex={-1}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6 3.5 10.5 8 6 12.5" />
            </svg>
          </button>
        </div>
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
