import type { ComponentPropsWithoutRef } from 'react';

type Props = Omit<ComponentPropsWithoutRef<'a'>, 'href' | 'target' | 'rel'> & {
  href: string;
  showIndicator?: boolean;
};

export function ExternalLink({ children, showIndicator = false, ...props }: Props) {
  return (
    <a {...props} target="_blank" rel="noopener noreferrer">
      {children}
      {showIndicator && (
        <>
          {' '}
          <span aria-hidden="true">↗</span>
        </>
      )}
    </a>
  );
}
