type BrandMarkProps = {
  className?: string;
};

export function BrandMark({ className = 'w-9 h-9 text-2xl' }: BrandMarkProps) {
  return (
    <span
      dir="rtl"
      className={`${className} flex items-center justify-center flex-shrink-0 leading-none font-bold bg-gradient-to-bl from-blue-400 to-blue-950 bg-clip-text text-transparent [font-family:var(--font-logo)]`}
    >
      سهل
    </span>
  );
}
