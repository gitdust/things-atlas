import { ModalDialog } from './ModalDialog';
import { DialogHeader } from './DialogHeader';
import { useState } from 'react';
import { version } from '../../package.json';
import releases from '@/generated/release-history.json';
import { t, type Lang } from '@/lib/i18n';

export function VersionControl({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(version);
  const selectedRelease = releases.find((release) => release.version === selectedVersion);
  const title = t(lang, 'releaseNotes');

  const selectTab = (index: number) => {
    const release = releases[index];
    setSelectedVersion(release.version);
    document.getElementById(`release-tab-${release.version}`)?.focus();
  };

  return (
    <>
      <button
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
      {open && (
        <ModalDialog
          className="release-dialog"
          aria-labelledby="release-dialog-title"
          onRequestClose={() => setOpen(false)}
        >
          <DialogHeader
            titleId="release-dialog-title"
            closeLabel={t(lang, 'closeReleaseNotes')}
            onClose={() => setOpen(false)}
            autoFocusClose
          >
            {title}
          </DialogHeader>
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
                  <li key={change.id}>{change[lang]}</li>
                ))}
              </ul>
            ) : (
              <p>{t(lang, 'noReleaseNotes')}</p>
            )}
          </section>
        </ModalDialog>
      )}
    </>
  );
}
