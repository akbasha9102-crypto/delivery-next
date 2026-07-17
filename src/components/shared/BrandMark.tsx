import Image from 'next/image';

type BrandMarkProps = {
  className?: string;
  priority?: boolean;
};

export function BrandMark({ className = 'w-9 h-9', priority = false }: BrandMarkProps) {
  return (
    <Image
      src="/logo-mark.png"
      alt="سهل"
      width={415}
      height={245}
      priority={priority}
      className={`${className} object-contain flex-shrink-0 dark:brightness-150 dark:saturate-[1.1]`}
    />
  );
}
