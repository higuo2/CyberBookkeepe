export function CatCanIcon({
  className = "size-4",
  strokeWidth = 1.75,
}: {
  className?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      aria-hidden
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      viewBox="0 0 24 24"
    >
      <ellipse cx="12" cy="6" rx="7" ry="2.5" />
      <path d="M12 4.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
      <path d="M5 6v11c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5V6" />
      <path d="M5 11.5c0 1.38 3.13 2.5 7 2.5s7-1.12 7-2.5" />
    </svg>
  );
}
