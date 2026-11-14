import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type Lang, t } from '@/lib/i18n';
import { shareImages } from '@/lib/seo';
import { SHARE_LANGUAGES, shareUrl } from '@/lib/share';
import type { AtlasItem } from '@/lib/types';
import './share-dialog.css';

type Props = { item: AtlasItem; lang: Lang; onClose: () => void };
type Poster = { url: string; file: File };

const strings = {
  zh: {
    title: '分享条目',
    language: '分享语言',
    link: '条目链接',
    copy: '复制链接',
    copied: '链接已复制',
    copyError: '复制失败，请手动复制已选中的链接。',
    save: '保存图片',
    downloading: '已开始下载',
    loading: '海报加载中…',
    unavailable: '海报暂时无法加载。请重试或刷新页面。',
    retry: '重试',
    system: '系统分享',
    shareLink: '分享链接',
    shareImage: '分享图片',
    shareError: '系统分享失败。请重试，或使用复制链接与保存图片。',
    original: '打开原图',
    longPress: '打开原图后可长按保存。',
  },
  en: {
    title: 'Share entry',
    language: 'Share language',
    link: 'Entry link',
    copy: 'Copy link',
    copied: 'Link copied',
    copyError: 'Copy failed. Copy the selected link manually.',
    save: 'Save image',
    downloading: 'Download started',
    loading: 'Loading poster…',
    unavailable: 'The poster could not load. Try again or refresh the page.',
    retry: 'Retry',
    system: 'System share',
    shareLink: 'Share link',
    shareImage: 'Share image',
    shareError: 'System sharing failed. Try again, copy the link or save the image.',
    original: 'Open original',
    longPress: 'Open the original and press and hold to save.',
  },
} as const;

function track(event: string, itemId: string, lang: Lang, action: string, result: string) {
  const analytics = window as Window & {
    gtag?: (command: string, event: string, data: Record<string, string>) => void;
  };
  analytics.gtag?.('event', event, { item_id: itemId, lang, action, result });
}

function ShareOptions({
  item,
  lang,
  initialLang,
  sharePending,
}: {
  item: AtlasItem;
  lang: Lang;
  initialLang: Lang;
  sharePending: { current: boolean };
}) {
  const msg = strings[initialLang];
  const [poster, setPoster] = useState<Poster | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('');
  const [sharing, setSharing] = useState(false);
  const linkInput = useRef<HTMLInputElement>(null);
  const download = useRef<HTMLAnchorElement>(null);
  const image = shareImages[item.id]?.[lang]?.poster;
  const url = shareUrl(item.id, lang);

  useEffect(() => {
    if (!image) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    let downloadedUntil = 0;
    const lease = download.current;
    const recordDownload = () => {
      downloadedUntil = Date.now() + 30_000;
    };
    lease?.addEventListener('click', recordDownload);
    void (async () => {
      try {
        const response = await fetch(import.meta.env.BASE_URL.replace(/\/$/, '') + image.path, {
          signal: controller.signal,
          cache: attempt ? 'reload' : 'default',
        });
        if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== image.mime) {
          throw new Error('Poster response unavailable');
        }
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        const preview = new Image();
        preview.src = objectUrl;
        await preview.decode();
        if (controller.signal.aborted) return;
        const file = new File([blob], `things-atlas-${item.id}-${lang}.png`, { type: image.mime });
        setPoster({ url: objectUrl, file });
      } catch {
        if (!controller.signal.aborted) setFailed(true);
      }
    })();
    return () => {
      controller.abort();
      lease?.removeEventListener('click', recordDownload);
      const release = objectUrl;
      if (!release) return;
      const delay = downloadedUntil - Date.now();
      if (delay > 0) window.setTimeout(() => URL.revokeObjectURL(release), delay);
      else URL.revokeObjectURL(release);
    };
  }, [image, item.id, lang, attempt]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus(msg.copied);
      track('share_copy_link', item.id, lang, 'link', 'success');
    } catch {
      linkInput.current?.focus();
      linkInput.current?.select();
      setStatus(msg.copyError);
      track('share_copy_link', item.id, lang, 'link', 'error');
    }
  }

  const nativeShare = window.isSecureContext && typeof navigator.share === 'function';
  const canShareImage = nativeShare && !!poster && !!navigator.canShare?.({ files: [poster.file] });
  const canDownload = 'download' in HTMLAnchorElement.prototype;

  async function share(kind: 'link' | 'image') {
    if (sharePending.current) return;
    if (kind === 'image' && (!poster || !navigator.canShare?.({ files: [poster.file] }))) return;
    sharePending.current = true;
    setSharing(true);
    setStatus('');
    let result = 'completed';
    try {
      await navigator.share(
        kind === 'image' && poster
          ? { files: [poster.file] }
          : {
              title: item[`name_${lang}`],
              text: item.share?.[lang].ogSummary ?? item[`summary_${lang}`],
              url,
            },
      );
    } catch (error) {
      result = error instanceof Error && error.name === 'AbortError' ? 'cancelled' : 'error';
      if (result === 'error') setStatus(msg.shareError);
    } finally {
      sharePending.current = false;
      setSharing(false);
      track('share_system_result', item.id, lang, kind, result);
    }
  }

  return (
    <>
      <div className="share-preview" aria-busy={!!image && !poster && !failed}>
        {poster && image && (
          <img src={poster.url} alt={image.alt} width={image.width} height={image.height} />
        )}
        {!poster && <div role="status">{failed || !image ? msg.unavailable : msg.loading}</div>}
        {failed && (
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setAttempt(attempt + 1);
            }}
          >
            {msg.retry}
          </button>
        )}
      </div>
      <div className="share-actions">
        <button type="button" onClick={copy}>
          {msg.copy}
        </button>
        <button
          type="button"
          disabled={!poster || !canDownload}
          onClick={() => {
            if (!poster) return;
            download.current?.click();
            setStatus(msg.downloading);
            track('share_download', item.id, lang, 'image', 'started');
          }}
        >
          {msg.save}
        </button>
        <a ref={download} href={poster?.url} download={poster?.file.name} hidden />
        {nativeShare && (
          <details className="share-system">
            <summary>{msg.system}</summary>
            <div>
              <button type="button" disabled={sharing} onClick={() => share('link')}>
                {msg.shareLink}
              </button>
              <button
                type="button"
                disabled={sharing || !canShareImage}
                onClick={() => share('image')}
              >
                {msg.shareImage}
              </button>
            </div>
          </details>
        )}
      </div>
      {poster && image && (
        <div className="share-original">
          <a
            href={import.meta.env.BASE_URL.replace(/\/$/, '') + image.path}
            target="_blank"
            rel="noreferrer"
          >
            {msg.original}
          </a>
          {!canDownload && <span>{msg.longPress}</span>}
        </div>
      )}
      <input
        className="share-link"
        readOnly
        aria-label={msg.link}
        value={url}
        ref={linkInput}
        onFocus={(event) => event.currentTarget.select()}
      />
      <div className="share-feedback" role="status">
        {status}
      </div>
    </>
  );
}

export default function ShareDialog({ item, lang, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opened = useRef(false);
  const sharePending = useRef(false);
  const [shareLang, setShareLang] = useState(lang);
  const msg = strings[lang];
  useEffect(() => {
    const modal = dialog.current;
    modal?.showModal();
    if (!opened.current) {
      opened.current = true;
      track('share_open', item.id, lang, 'dialog', 'opened');
    }
    return () => {
      modal?.close();
    };
  }, [item.id, lang]);

  return createPortal(
    <dialog
      ref={dialog}
      className="share-dialog"
      aria-labelledby="share-title"
      onCancel={(event) => {
        event.preventDefault();
        dialog.current?.close();
        onClose();
      }}
    >
      <header className="share-head">
        <h2 id="share-title">{msg.title}</h2>
        <button
          type="button"
          className="close-btn"
          aria-label={t(lang, 'close')}
          onClick={() => {
            dialog.current?.close();
            onClose();
          }}
        >
          ×
        </button>
      </header>
      <div className="share-languages" role="group" aria-label={msg.language}>
        {SHARE_LANGUAGES.map((locale) => (
          <button
            type="button"
            key={locale}
            aria-pressed={locale === shareLang}
            lang={locale}
            onClick={() => setShareLang(locale)}
          >
            {locale === 'zh' ? '中文' : 'EN'}
          </button>
        ))}
      </div>
      <ShareOptions
        key={shareLang}
        item={item}
        lang={shareLang}
        initialLang={lang}
        sharePending={sharePending}
      />
    </dialog>,
    document.body,
  );
}
