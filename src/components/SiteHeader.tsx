import { LanguageMenu } from './LanguageMenu';
import { VersionControl } from './VersionControl';
import { t, type Lang } from '@/lib/i18n';

type Props = {
  hasSelectedItem?: boolean;
  lang: Lang;
  onLangChange: (lang: Lang) => void;
  onHelp: () => void;
};

export function SiteHeader({ lang, onLangChange, onHelp, hasSelectedItem = false }: Props) {
  const BrandHeading = hasSelectedItem ? 'div' : 'h1';
  return (
    <header className="topbar">
      <div className="brand">
        <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="17.5" />
          <ellipse cx="20" cy="20" rx="7.5" ry="17.5" />
          <path d="M2.5 20h35M5 11.5h30M5 28.5h30" />
          <circle className="brand-pin" cx="26.5" cy="14" r="3.2" />
        </svg>
        <div className="brand-text">
          <BrandHeading className="brand-heading">
            <span className="brand-en">Things Atlas</span>
            <span className="brand-dot">·</span>
            <span className="brand-zh-row">
              <span className="brand-zh">日常之物图志</span>
              <VersionControl lang={lang} />
            </span>
          </BrandHeading>
          <p className="brand-tagline">{t(lang, 'tagline')}</p>
        </div>
      </div>

      <div className="top-controls">
        <button
          type="button"
          className="guide-help"
          onClick={onHelp}
          aria-label={t(lang, 'help')}
          title={t(lang, 'help')}
        >
          ?
        </button>
        <a
          className="github-link"
          href="https://github.com/gitdust/things-atlas"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          title="GitHub"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 .75a11.25 11.25 0 0 0-3.558 21.922c.563.104.768-.244.768-.543 0-.267-.01-.975-.015-1.913-3.13.68-3.79-1.508-3.79-1.508-.512-1.3-1.25-1.646-1.25-1.646-1.022-.699.078-.685.078-.685 1.13.08 1.725 1.16 1.725 1.16 1.005 1.723 2.637 1.225 3.28.937.102-.728.393-1.225.715-1.507-2.5-.285-5.128-1.25-5.128-5.565 0-1.23.44-2.233 1.16-3.02-.117-.285-.503-1.43.11-2.98 0 0 .945-.302 3.095 1.154a10.8 10.8 0 0 1 5.625 0c2.15-1.456 3.093-1.154 3.093-1.154.615 1.55.229 2.695.112 2.98.722.787 1.158 1.79 1.158 3.02 0 4.326-2.632 5.277-5.14 5.556.404.35.765 1.043.765 2.1 0 1.516-.014 2.739-.014 3.11 0 .302.203.652.774.542A11.25 11.25 0 0 0 12 .75Z" />
          </svg>
        </a>
        <LanguageMenu lang={lang} onChange={onLangChange} />
      </div>
    </header>
  );
}
