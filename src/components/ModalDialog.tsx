import { useEffect, useRef, type ComponentPropsWithoutRef, type RefObject } from 'react';
import { createPortal } from 'react-dom';

type Props = Pick<
  ComponentPropsWithoutRef<'dialog'>,
  'children' | 'className' | 'aria-labelledby' | 'aria-describedby' | 'onAnimationEnd'
> & {
  onRequestClose: () => void;
  initialFocus?: RefObject<HTMLElement>;
  closeOnBackdrop?: boolean;
};

export function ModalDialog({
  onRequestClose,
  initialFocus,
  closeOnBackdrop = false,
  className,
  ...props
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef(document.activeElement);

  useEffect(() => {
    const modal = dialog.current;
    const previous = previousFocus.current;
    modal?.showModal();
    initialFocus?.current?.focus({ preventScroll: true });
    return () => {
      modal?.close();
      const fallback = document.querySelector<HTMLElement>('.topbar button, .topbar a');
      if (previous instanceof HTMLElement && previous.isConnected && previous !== document.body) {
        previous.focus({ preventScroll: true });
      } else fallback?.focus({ preventScroll: true });
    };
  }, [initialFocus]);

  return createPortal(
    <dialog
      {...props}
      ref={dialog}
      className={`modal-dialog${className ? ` ${className}` : ''}`}
      onCancel={(event) => {
        event.preventDefault();
        onRequestClose();
      }}
      onClick={(event) => {
        if (!closeOnBackdrop || event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        )
          onRequestClose();
      }}
    />,
    document.body,
  );
}
