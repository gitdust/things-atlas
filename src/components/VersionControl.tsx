import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { version } from '../../package.json';
import type { Lang } from '@/lib/i18n';
import {
  isNewerVersion,
  parseReleaseManifest,
  pendingReleaseForVersion,
  PENDING_UPDATE_KEY,
  type ReleaseManifest,
} from '@/lib/versionUpdate';

const CHECK_INTERVAL = 5 * 60 * 1000;

export function VersionControl({ lang }: { lang: Lang }) {
  const [available, setAvailable] = useState<ReleaseManifest | null>(null);
  const [installed, setInstalled] = useState<ReleaseManifest | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    try {
      setInstalled(pendingReleaseForVersion(sessionStorage.getItem(PENDING_UPDATE_KEY), version));
    } catch {
      // Refresh still works when the browser disallows session storage.
    }

    let disposed = false;
    let pending: AbortController | null = null;
    const check = async () => {
      if (disposed || document.visibilityState === 'hidden' || pending) return;
      const controller = new AbortController();
      pending = controller;
      const timeout = window.setTimeout(() => controller.abort(), 10_000);
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!response.ok) return;
        const release = parseReleaseManifest(await response.json());
        if (disposed || !release) return;
        setAvailable(isNewerVersion(release.version, version) ? release : null);
      } catch {
        // Failed/offline checks must not interrupt map browsing.
      } finally {
        window.clearTimeout(timeout);
        if (pending === controller) pending = null;
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    void check();
    const interval = window.setInterval(() => void check(), CHECK_INTERVAL);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      disposed = true;
      pending?.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, []);

  useEffect(() => {
    if (installed && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [installed]);

  const acknowledge = () => {
    try {
      sessionStorage.removeItem(PENDING_UPDATE_KEY);
    } catch {
      // Storage can also become unavailable after the dialog opens.
    }
    setInstalled(null);
  };

  const refresh = () => {
    if (!available) return;
    try {
      // Carry only the clicked release across navigation, never older releases.
      sessionStorage.setItem(PENDING_UPDATE_KEY, JSON.stringify(available));
    } catch {
      // Do not prevent the requested reload if persistence is unavailable.
    }
    window.location.reload();
  };

  return (
    <>
      {available ? (
        <button
          type="button"
          className="version-control has-update"
          onClick={refresh}
          title={
            lang === 'zh'
              ? `新版 v${available.version}，点击更新`
              : `Version ${available.version} available. Click to update`
          }
          aria-label={
            lang === 'zh'
              ? `当前 v${version}，新版 v${available.version}，点击刷新`
              : `Current version ${version}. Version ${available.version} available. Refresh to update`
          }
        >
          v{version} <span>{lang === 'zh' ? '有更新 ↻' : 'Update ↻'}</span>
        </button>
      ) : (
        <span className="version-control">v{version}</span>
      )}
      {installed &&
        createPortal(
          <dialog
            className="release-dialog"
            ref={dialog}
            aria-labelledby="release-dialog-title"
            onClose={acknowledge}
          >
            <header className="release-dialog-head">
              <h2 id="release-dialog-title">
                {lang === 'zh' ? '本次更新' : 'What’s new'} · v{installed.version}
              </h2>
              <button
                type="button"
                className="close-btn"
                aria-label={lang === 'zh' ? '关闭更新内容' : 'Close release notes'}
                onClick={() => dialog.current?.close()}
                autoFocus
              >
                ×
              </button>
            </header>
            {installed.changes.length ? (
              <ul className="release-changes">
                {installed.changes.map((change) => (
                  <li key={change.id}>{lang === 'zh' ? change.zh : change.en}</li>
                ))}
              </ul>
            ) : (
              <p>{lang === 'zh' ? '已更新到最新版本。' : 'You’re up to date.'}</p>
            )}
          </dialog>,
          document.body,
        )}
    </>
  );
}
