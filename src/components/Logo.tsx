export function Logo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round">
        <rect x="12" y="28" width="40" height="26" rx="3" />
        <rect x="8" y="19" width="48" height="10" rx="3" />
        <path d="M32 19v35" />
      </g>
      <g fill="none" stroke="#dc2626" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M32 18c-2-7-11-10-13-5s7 5 13 5z" />
        <path d="M32 18c2-7 11-10 13-5s-7 5-13 5z" />
      </g>
    </svg>
  );
}
