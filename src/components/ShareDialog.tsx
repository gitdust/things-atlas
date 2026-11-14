import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { type Lang, t } from '@/lib/i18n';
import { shareImages } from '@/lib/seo';
import { shareUrl } from '@/lib/share';
import type { AtlasItem } from '@/lib/types';
import './share-dialog.css';

type Props = { item: AtlasItem; lang: Lang; onClose: () => void };

const strings = {
  zh: {
    title: '分享条目',
    share: '分享',
    shareError: '分享失败，请重试。',
    copied: '当前浏览器不支持系统分享，已复制条目链接。',
    download: '下载海报',
    downloading: '已开始下载',
    loading: '海报加载中…',
    unavailable: '海报暂时无法加载。请重试或刷新页面。',
    retry: '重试',
    longPress: '打开原图后可长按保存。',
  },
  en: {
    title: 'Share entry',
    share: 'Share',
    shareError: 'Sharing failed. Try again.',
    copied: 'System sharing is unavailable. Entry link copied.',
    download: 'Download poster',
    downloading: 'Download started',
    loading: 'Loading poster…',
    unavailable: 'The poster could not load. Try again or refresh the page.',
    retry: 'Retry',
    longPress: 'Press and hold the opened image to save.',
  },
} as const;

function track(event: string, itemId: string, lang: Lang, action: string, result: string) {
  const analytics = window as Window & {
    gtag?: (command: string, event: string, data: Record<string, string>) => void;
  };
  analytics.gtag?.('event', event, { item_id: itemId, lang, action, result });
}

function ShareOptions({ item, lang }: Pick<Props, 'item' | 'lang'>) {
  const msg = strings[lang];
  const [poster, setPoster] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('');
  const [sharing, setSharing] = useState(false);
  const sharePending = useRef(false);
  const download = useRef<HTMLAnchorElement>(null);
  const image = shareImages[item.id]?.[lang]?.poster;
  const imageUrl = image && import.meta.env.BASE_URL.replace(/\/$/, '') + image.path;
  const url = shareUrl(item.id, lang);
  const filename = `things-atlas-${item.id}-${lang}.png`;
  const canDownload = 'download' in HTMLAnchorElement.prototype;

  const nativeShare = window.isSecureContext && typeof navigator.share === 'function';

  useEffect(() => {
    if (!image || !imageUrl) return;
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
        const response = await fetch(imageUrl, {
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
        setPoster(objectUrl);
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
  }, [image, imageUrl, attempt]);

  async function share() {
    if (sharePending.current) return;
    sharePending.current = true;
    setSharing(true);
    setStatus('');
    let result = 'completed';
    try {
      if (nativeShare) {
        await navigator.share({
          title: item[`name_${lang}`],
          text: item.share?.[lang].ogSummary ?? item[`summary_${lang}`],
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
        setStatus(msg.copied);
      }
    } catch (error) {
      result = error instanceof Error && error.name === 'AbortError' ? 'cancelled' : 'error';
      if (result === 'error') setStatus(msg.shareError);
    } finally {
      sharePending.current = false;
      setSharing(false);
      track(
        nativeShare ? 'share_system_result' : 'share_copy_link',
        item.id,
        lang,
        'link',
        !nativeShare && result === 'completed' ? 'success' : result,
      );
    }
  }

  return (
    <>
      <div className="share-preview" aria-busy={!!image && !poster && !failed}>
        {poster && image && (
          <img src={poster} alt={image.alt} width={image.width} height={image.height} />
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
        <button type="button" className="share-primary" disabled={sharing} onClick={share}>
          {msg.share}
        </button>
        <button
          type="button"
          className="share-download"
          aria-label={msg.download}
          title={msg.download}
          disabled={!poster}
          onClick={() => {
            if (!poster || !imageUrl) return;
            if (!canDownload) {
              window.open(imageUrl, '_blank', 'noopener');
              setStatus(msg.longPress);
              return;
            }
            download.current?.click();
            setStatus(msg.downloading);
            track('share_download', item.id, lang, 'image', 'started');
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 3v12m-5-5 5 5 5-5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
          </svg>
        </button>
        <a ref={download} href={poster ?? undefined} download={filename} hidden />
      </div>
      <div className="share-feedback" role="status">
        {status}
      </div>
    </>
  );
}

export default function ShareDialog({ item, lang, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opened = useRef(false);
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
      <ShareOptions key={`${item.id}:${lang}`} item={item} lang={lang} />
    </dialog>,
    document.body,
  );
}
