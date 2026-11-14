import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { version } from '../../package.json';
import releases from '@/generated/release-history.json';
import { t, type Lang } from '@/lib/i18n';

export function VersionControl({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(version);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const selectedRelease = releases.find((release) => release.version === selectedVersion);
  const title = t(lang, 'releaseNotes');

  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);

  const selectTab = (index: number) => {
    const release = releases[index];
    setSelectedVersion(release.version);
    document.getElementById(`release-tab-${release.version}`)?.focus();
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="version-control"
        aria-label={`${title} · v${version}`}
        aria-haspopup="dialog"
        title={title}
        onClick={() => {
          setSelectedVersion(version);
          setOpen(true);
        }}
      >
        v{version}
      </button>
      {open &&
        createPortal(
          <dialog
            className="release-dialog"
            ref={dialog}
            aria-labelledby="release-dialog-title"
            onClose={() => {
              setOpen(false);
              trigger.current?.focus({ preventScroll: true });
            }}
          >
            <header className="release-dialog-head">
              <h2 id="release-dialog-title">{title}</h2>
              <button
                type="button"
                className="close-btn"
                aria-label={t(lang, 'closeReleaseNotes')}
                onClick={() => dialog.current?.close()}
                autoFocus
              >
                ×
              </button>
            </header>
            <div className="release-tabs" role="tablist" aria-label={title}>
              {releases.map((release, index) => (
                <button
                  key={release.version}
                  id={`release-tab-${release.version}`}
                  type="button"
                  role="tab"
                  aria-selected={selectedVersion === release.version}
                  aria-controls="release-panel"
                  tabIndex={selectedVersion === release.version ? 0 : -1}
                  onClick={() => setSelectedVersion(release.version)}
                  onKeyDown={(event) => {
                    let nextIndex = index;
                    if (event.key === 'ArrowRight') nextIndex = (index + 1) % releases.length;
                    else if (event.key === 'ArrowLeft')
                      nextIndex = (index - 1 + releases.length) % releases.length;
                    else if (event.key === 'Home') nextIndex = 0;
                    else if (event.key === 'End') nextIndex = releases.length - 1;
                    else return;
                    event.preventDefault();
                    selectTab(nextIndex);
                  }}
                >
                  v{release.version}
                </button>
              ))}
            </div>
            <section
              id="release-panel"
              role="tabpanel"
              aria-labelledby={`release-tab-${selectedVersion}`}
              tabIndex={0}
            >
              {selectedRelease?.changes.length ? (
                <ul className="release-changes" key={selectedVersion}>
                  {selectedRelease.changes.map((change) => (
                    <li key={change.id}>{lang === 'zh' ? change.zh : change.en}</li>
                  ))}
                </ul>
              ) : (
                <p>{t(lang, 'noReleaseNotes')}</p>
              )}
            </section>
          </dialog>,
          document.body,
        )}
    </>
  );
}
