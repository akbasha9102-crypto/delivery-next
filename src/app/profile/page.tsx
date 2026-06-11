'use client';
import { useState, useEffect, useRef } from 'react';
import { ClientBottomNav } from '@/components/BottomNav';
import { User, Pencil, Check, Phone } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { useDarkMode } from '@/context/ThemeContext';

const KEYS = {
  name:  'deliveryName',
  phone: 'deliveryPhone',
};

function EditableRow({
  label,
  value,
  icon,
  type = 'text',
  color,
  onSave,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  type?: string;
  color: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    if (draft.trim()) { onSave(draft.trim()); setEditing(false); }
  };

  return (
    <div className="flex justify-between items-center py-3.5 border-b border-gray-50 dark:border-slate-700 last:border-0">
      {editing ? (
        <div className="flex items-center gap-2 flex-1">
          <button onClick={commit} className="active:scale-95 transition-all" style={{ color }}>
            <Check size={17} />
          </button>
          <input
            ref={inputRef}
            type={type}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && commit()}
            dir="rtl"
            className="flex-1 bg-transparent border-b-2 text-right text-gray-900 dark:text-slate-100 outline-none text-sm py-0.5"
            style={{ borderColor: color }}
          />
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <button onClick={() => setEditing(true)} className="active:scale-95 transition-all" style={{ color }}>
              <Pencil size={15} />
            </button>
            <span className="text-gray-800 dark:text-slate-200 font-semibold text-sm">
              {value || <span className="text-gray-400 text-xs">غير محدد</span>}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 dark:text-slate-500 text-sm">{label}</span>
            <span style={{ color }}>{icon}</span>
          </div>
        </>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { dark } = useDarkMode();
  const { primary_color } = useSettings();

  const rawColor   = primary_color || '#e67e22';
  const isTooDark  = rawColor === '#000000' || rawColor.toLowerCase() === '#121212';
  const brandColor = dark && isTooDark ? '#ffffff' : rawColor;

  const [name,    setName]    = useState('');
  const [phone,   setPhone]   = useState('');
  const [saved,   setSaved]   = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setName(localStorage.getItem(KEYS.name)  || '');
    setPhone(localStorage.getItem(KEYS.phone) || '');
    setMounted(true);
  }, []);

  const saveName  = (v: string) => { setName(v);  localStorage.setItem(KEYS.name,  v); flash(); };
  const savePhone = (v: string) => { setPhone(v); localStorage.setItem(KEYS.phone, v); flash(); };

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-32">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4">
        <h1 className="text-xl font-bold text-center" style={{ color: brandColor }}>معلوماتي</h1>
      </header>

      <div className="px-4 pt-5 max-w-lg mx-auto space-y-4">

        <div className="flex justify-center pt-2 pb-1">
          <div className="w-20 h-20 rounded-full flex items-center justify-center border-4"
            style={{ backgroundColor: `${brandColor}15`, borderColor: `${brandColor}40` }}>
            <User size={36} style={{ color: brandColor }} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-2 border-b border-gray-50 dark:border-slate-700 text-right">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 py-2">معلوماتك الشخصية</h3>
          </div>
          <div className="px-5 pb-2">
            <EditableRow label="الاسم"   value={name}  icon={<User  size={14}/>} color={brandColor} onSave={saveName}  />
            <EditableRow label="الهاتف"  value={phone} icon={<Phone size={14}/>} color={brandColor} onSave={savePhone} type="tel" />
          </div>
        </div>

        {saved && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 text-center">
            <p className="text-green-700 dark:text-green-400 font-semibold text-sm">✓ تم الحفظ</p>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 dark:text-slate-600 pb-2">
          معلوماتك محفوظة على جهازك فقط
        </p>
      </div>

      <ClientBottomNav />
    </div>
  );
}
