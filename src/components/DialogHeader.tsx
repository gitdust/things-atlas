import type { ReactNode, RefObject } from 'react';
import { CloseButton } from './CloseButton';

type Props = {
  titleId: string;
  children: ReactNode;
  closeLabel: string;
  onClose: () => void;
  className?: string;
  headingRef?: RefObject<HTMLHeadingElement>;
  autoFocusClose?: boolean;
};

export function DialogHeader({
  titleId,
  children,
  closeLabel,
  onClose,
  className,
  headingRef,
  autoFocusClose,
}: Props) {
  return (
    <header className={`dialog-header${className ? ` ${className}` : ''}`}>
      <h2 id={titleId} ref={headingRef} tabIndex={headingRef ? -1 : undefined}>
        {children}
      </h2>
      <CloseButton label={closeLabel} onClick={onClose} autoFocus={autoFocusClose} />
    </header>
  );
}
