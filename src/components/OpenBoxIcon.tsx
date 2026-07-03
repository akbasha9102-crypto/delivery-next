export function OpenBoxIcon({ size = 24, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 20 L4 10 L20 10 L21 20 Z" />
      <path d="M4 10 L2 3 L9 7" />
      <path d="M20 10 L22 3 L15 7" />
    </svg>
  );
}
