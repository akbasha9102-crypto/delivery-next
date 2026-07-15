type SahlLogoProps = {
  className?: string;
};

/**
 * شعار "سهل" — SVG داخلي مرسوم يدوياً بأسلوب Monoline (خط واحد بلا تعبئة).
 * الحروف من اليمين لليسار كخط عربي متصل واحد:
 *   السين  → موجتان ناعمتان حول خط الأساس
 *   الهاء  → عروة/حلقة تحت خط الأساس
 *   اللام  → ذيل صاعد + حوض عميق مفتوح النهاية
 */
export default function SahlLogo({ className = 'w-full max-w-[150px]' }: SahlLogoProps) {
  return (
    <svg
      viewBox="0 0 300 150"
      className={className}
      role="img"
      aria-label="سهل"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g
        transform="translate(12.5,-5)"
        fill="none"
        stroke="#1a62b1"
        strokeWidth={12}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path
          d="
            M 262,90
            C 250,90 244,55 232,55
            S 214,90 205,90
            C 196,90 187,122 178,122
            S 163,90 152,90
            C 150,105 138,118 122,120
            C 106,122 94,112 96,96
            C 97,90 99,89 100,88
            C 90,65 78,40 68,28
            C 60,42 55,65 58,90
            C 60,108 55,122 40,128
            C 28,132 18,122 15,105
            C 13,95 14,88 22,82
          "
        />
      </g>
    </svg>
  );
}
