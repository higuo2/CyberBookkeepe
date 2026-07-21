export function CatAvatar({
  size = 44,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      height={size}
      viewBox="0 0 96 96"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="48" cy="48" fill="#FFE8B8" r="46" />
      <path
        d="M18 34c0-12 8-22 12-22 3 0 8 8 10 16M66 28c2-8 7-16 10-16 4 0 12 10 12 22"
        fill="#FFE8B8"
        stroke="#F0C878"
        strokeLinecap="round"
        strokeWidth="3"
      />
      <ellipse cx="48" cy="54" fill="#FFF6E0" rx="28" ry="24" />
      <circle cx="36" cy="50" fill="#5C4033" r="3.5" />
      <circle cx="60" cy="50" fill="#5C4033" r="3.5" />
      <ellipse cx="48" cy="58" fill="#F8A055" rx="4" ry="3" />
      <path
        d="M40 64c2.5 3 5.5 4.5 8 4.5S53.5 67 56 64"
        fill="none"
        stroke="#C47A4A"
        strokeLinecap="round"
        strokeWidth="2.2"
      />
      <path
        d="M20 54h10M66 54h10"
        stroke="#E8B070"
        strokeLinecap="round"
        strokeWidth="2"
      />
      <circle cx="72" cy="42" fill="#FFB4A2" opacity="0.55" r="5" />
      <circle cx="24" cy="42" fill="#FFB4A2" opacity="0.55" r="5" />
    </svg>
  );
}
