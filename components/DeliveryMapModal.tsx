'use client';
import { MapPin, X } from 'lucide-react';

type Props = { address: string; onClose: () => void };

export default function DeliveryMapModal({ address, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center"
      onClick={onClose}
    >
      <div
        className="bg-slate-800 w-full max-w-lg rounded-t-3xl p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between" dir="rtl">
          <p className="text-white font-black text-lg">📍 عنوان التوصيل</p>
          <button onClick={onClose}
            className="p-2 rounded-xl bg-slate-700 active:scale-90 transition-all">
            <X size={18} className="text-slate-300" />
          </button>
        </div>

        <div className="flex items-center gap-2 bg-slate-700 rounded-2xl px-4 py-3" dir="rtl">
          <MapPin size={16} className="text-blue-400 flex-shrink-0" />
          <p className="text-white font-bold text-base">{address}</p>
        </div>

        <iframe
          src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&output=embed&hl=ar`}
          className="w-full h-56 rounded-2xl border-0"
          loading="lazy"
        />

        <div className="grid grid-cols-2 gap-3">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-3.5 bg-blue-600 text-white font-black rounded-2xl text-sm active:scale-95 transition-all shadow-lg shadow-blue-900/40">
            🗺️ Google Maps
          </a>
          <a
            href={`https://waze.com/ul?q=${encodeURIComponent(address)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-3.5 bg-[#00B4FF] text-white font-black rounded-2xl text-sm active:scale-95 transition-all shadow-lg shadow-sky-900/40">
            🚗 Waze
          </a>
        </div>
      </div>
    </div>
  );
}
