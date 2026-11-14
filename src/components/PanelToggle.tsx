import { forwardRef, useRef, type PointerEvent } from 'react';
import { t, type Lang } from '@/lib/i18n';
import { mq } from '@/lib/tokens';

type Props = {
  lang: Lang;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count?: number;
};

export const PanelToggle = forwardRef<HTMLButtonElement, Props>(function PanelToggle(
  { lang, open, onOpenChange, count },
  ref,
) {
  const gesture = useRef({ pointerId: null as number | null, startY: 0, suppressClick: false });
  const label = open ? t(lang, 'collapsePanel') : t(lang, 'expandCatalogue');

  const resetGesture = () => {
    gesture.current = { pointerId: null, startY: 0, suppressClick: false };
  };

  const startGesture = (event: PointerEvent<HTMLButtonElement>) => {
    resetGesture();
    if (!event.isPrimary || event.button !== 0 || !window.matchMedia(mq.mobile).matches) return;
    gesture.current.pointerId = event.pointerId;
    gesture.current.startY = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const endGesture = (event: PointerEvent<HTMLButtonElement>) => {
    if (gesture.current.pointerId !== event.pointerId) return;
    const draggedDown = event.clientY - gesture.current.startY > 36;
    gesture.current.pointerId = null;
    if (draggedDown && open) {
      // A pointer click follows pointerup; it must not reopen the panel.
      gesture.current.suppressClick = true;
      onOpenChange(false);
    }
  };

  return (
    <button
      ref={ref}
      type="button"
      className={`panel-toggle${open ? ' is-open' : ' is-collapsed'}`}
      aria-expanded={open}
      aria-controls="entry-panel"
      aria-label={label}
      title={label}
      onPointerDown={startGesture}
      onPointerUp={endGesture}
      onPointerCancel={resetGesture}
      onClick={(event) => {
        if (event.detail !== 0 && gesture.current.suppressClick) {
          resetGesture();
          return;
        }
        resetGesture();
        onOpenChange(!open);
      }}
    >
      <span className="panel-toggle-icon" aria-hidden="true">
        {open ? (
          <svg className="icon-chevron" viewBox="0 0 16 16">
            <path d="M6 3.5 10.5 8 6 12.5" />
          </svg>
        ) : (
          <svg className="icon-list" viewBox="0 0 16 16">
            <path d="M2.5 4h11M2.5 8h11M2.5 12h7" />
          </svg>
        )}
      </span>
      <span className="panel-toggle-text">
        <span className="panel-toggle-label">
          {open ? t(lang, 'collapse') : t(lang, 'catalogue')}
        </span>
        {!open && count != null && <span className="panel-toggle-count num">{count}</span>}
      </span>
    </button>
  );
});
