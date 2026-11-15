type Props = {
  direction?: 'right' | 'down' | 'left' | 'up';
  className?: string;
};

const rotation = { right: 0, down: 90, left: 180, up: 270 } as const;

export function ChevronIcon({ direction = 'right', className }: Props) {
  return (
    <svg
      className={`icon-chevron${className ? ` ${className}` : ''}`}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 3.5 10.5 8 6 12.5" transform={`rotate(${rotation[direction]} 8 8)`} />
    </svg>
  );
}
