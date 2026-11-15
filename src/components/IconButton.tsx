import { forwardRef, type ComponentPropsWithoutRef } from 'react';

type Props = Omit<ComponentPropsWithoutRef<'button'>, 'type' | 'aria-label'> & {
  label: string;
  tone?: 'neutral' | 'accent';
};

export const IconButton = forwardRef<HTMLButtonElement, Props>(function IconButton(
  { label, tone = 'neutral', className, ...props },
  ref,
) {
  return (
    <button
      {...props}
      ref={ref}
      type="button"
      aria-label={label}
      data-tone={tone}
      className={`icon-button${className ? ` ${className}` : ''}`}
    />
  );
});
