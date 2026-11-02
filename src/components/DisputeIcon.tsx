export function DisputeIcon({ label }: { label: string }) {
  return (
    <svg
      className="dispute-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      <path d="M14 11V4H3v9l3-2h8Z" />
      <path d="M10 14v3h8l3 3V9h-4" />
    </svg>
  );
}
