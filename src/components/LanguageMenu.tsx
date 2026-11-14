import { useEffect, useId, useRef, useState } from 'react';
import { LANGS, t, type Lang } from '@/lib/i18n';

const LABELS: Record<Lang, { short: string; name: string; html: string }> = {
  zh: { short: '\u4e2d', name: '\u4e2d\u6587', html: 'zh-Hans' },
  en: { short: 'EN', name: 'English', html: 'en' },
  es: { short: 'ES', name: 'Espa\u00f1ol', html: 'es' },
  ja: { short: 'JA', name: '\u65e5\u672c\u8a9e', html: 'ja' },
};

type Props = {
  lang: Lang;
  onChange: (lang: Lang) => void;
};

export function LanguageMenu({ lang, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div
      ref={root}
      className={`lang-menu${open ? ' is-open' : ''}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="lang-menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={t(lang, 'language')}
        lang={LABELS[lang].html}
        onClick={() => setOpen((value) => !value)}
      >
        {LABELS[lang].short}
      </button>
      <ul id={menuId} className="lang-menu-list" role="menu" aria-label={t(lang, 'language')}>
        {LANGS.map((code) => (
          <li key={code} role="none">
            <button
              type="button"
              role="menuitemradio"
              aria-checked={code === lang}
              lang={LABELS[code].html}
              className={code === lang ? 'is-active' : undefined}
              onClick={() => {
                onChange(code);
                setOpen(false);
              }}
            >
              <span>{LABELS[code].short}</span>
              {LABELS[code].name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
