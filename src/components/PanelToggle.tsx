import { forwardRef, useRef, type PointerEvent } from 'react';
import type { Lang } from '@/lib/i18n';
import { mq } from '@/lib/tokens';

type Props = {
  lang: Lang;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const PanelToggle = forwardRef<HTMLButtonElement, Props>(function PanelToggle(
  { lang, open, onOpenChange },
  ref,
) {
  const gesture = useRef({ pointerId: null as number | null, startY: 0, suppressClick: false });
  const label = open
    ? lang === 'zh'
      ? '收起面板'
      : 'Collapse panel'
    : lang === 'zh'
      ? '展开条目列表'
      : 'Expand catalogue';

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
      className="panel-toggle"
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
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m9 6 6 6-6 6" />
      </svg>
    </button>
  );
});
