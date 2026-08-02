// صوت تنبيه شاشة المطبخ — نفس تقنية makeBellWavUrl بـ admin/layout.tsx (WAV يدوي
// عبر ArrayBuffer/DataView) لكن أطول وأعلى وبثلاث نغمات صاعدة كي يتميّز سمعياً
// عن جرس الإشعارات العادي ويُسمع بوضوح وسط ضجيج المطبخ.
export function makeKitchenAlertWavUrl(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const sr = 22050;
    const toneDur = 0.5;
    const tones = [660, 880, 1046];
    const n = (sr * toneDur * tones.length) | 0;
    const buf = new ArrayBuffer(44 + n * 2);
    const v = new DataView(buf);
    const ws = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE'); ws(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); ws(36, 'data'); v.setUint32(40, n * 2, true);

    const tone = (startT: number, endT: number, hz: number) => {
      const from = (startT * sr) | 0, to = (endT * sr) | 0;
      for (let i = from; i < to; i++) {
        const t = i / sr - startT;
        const env = Math.exp(-t * 4);
        v.setInt16(44 + i * 2, (Math.sin(2 * Math.PI * hz * t) * env * 0.95 * 32767) | 0, true);
      }
    };
    tones.forEach((hz, idx) => tone(idx * toneDur, (idx + 1) * toneDur, hz));

    return URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
  } catch {
    return null;
  }
}
