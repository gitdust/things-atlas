import type { ComponentPropsWithoutRef, ReactElement } from 'react';
import './close-button.css';

type Props = Pick<ComponentPropsWithoutRef<'button'>, 'onClick' | 'autoFocus' | 'disabled'> & {
  label: string;
};

export function CloseButton({ label, ...props }: Props): ReactElement {
  return (
    <button {...props} type="button" className="dialog-close-button" aria-label={label}>
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="m4 4 8 8M12 4l-8 8" />
      </svg>
    </button>
  );
}
