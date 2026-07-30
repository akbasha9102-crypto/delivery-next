'use client';
import { AnimatePresence, motion } from 'framer-motion';
import { MapPin, X } from 'lucide-react';

type Props = { address: string | null; onClose: () => void };

export default function MapSheet({ address, onClose }: Props) {
  return (
    <AnimatePresence>
      {address && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 280, damping: 32 }}
            className="bg-slate-900 w-full max-w-lg rounded-t-3xl p-5 space-y-4 border-t border-slate-800"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between" dir="rtl">
              <p className="text-white font-extrabold text-lg">📍 عنوان التوصيل</p>
              <button onClick={onClose}
                className="p-2.5 rounded-xl bg-slate-800 active:scale-90 transition-all">
                <X size={18} className="text-slate-300" />
              </button>
            </div>
            <div className="flex items-center gap-2 bg-slate-800 rounded-2xl px-4 py-3" dir="rtl">
              <MapPin size={16} className="text-blue-400 flex-shrink-0" />
              <p className="text-white font-medium text-base">{address}</p>
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
                className="flex items-center justify-center gap-2 py-3.5 bg-blue-600 text-white font-extrabold rounded-2xl text-sm active:scale-95 transition-all">
                🗺️ Google Maps
              </a>
              <a
                href={`https://waze.com/ul?q=${encodeURIComponent(address)}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 py-3.5 bg-[#00B4FF] text-white font-extrabold rounded-2xl text-sm active:scale-95 transition-all">
                🚗 Waze
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
