'use client';
import { useState, useEffect } from 'react';
import { ClientBottomNav } from '@/components/BottomNav';
import { User, Pencil, Check, MapPin, ChevronDown, Phone, Home as HomeIcon } from 'lucide-react';
import { useSettings } from '@/context/SettingsContext';
import { useDarkMode } from '@/context/ThemeContext';

const KEYS = {
  name:     'deliveryName',
  phone:    'deliveryPhone',
  district: 'deliveryDistrict',
  address:  'deliveryAddress',
};

const BASRA_DISTRICTS = [
  { id: 'ashar',      name: 'العشار',      desc: 'قلب البصرة التجاري والاقتصادي' },
  { id: 'maqal',      name: 'المعقل',      desc: 'حي راقٍ شمال البصرة على ضفاف شط العرب' },
  { id: 'qibla',      name: 'القبلة',      desc: 'الحي التاريخي العريق وسط المدينة' },
  { id: 'jazira',     name: 'الجزيرة',     desc: 'منطقة هادئة بين الأنهار قريبة من المركز' },
  { id: 'asmai',      name: 'الأصمعي',     desc: 'حي سكني شعبي غرب مركز المدينة' },
  { id: 'jazayer',    name: 'الجزائر',     desc: 'حي شعبي بين العشار والمعقل' },
  { id: 'haritha',    name: 'الهارثة',     desc: 'شمال البصرة على ضفاف شط العرب' },
  { id: 'zubayr',     name: 'الزبير',      desc: 'قضاء تاريخي جنوب غرب البصرة' },
  { id: 'abu_khasib', name: 'أبو الخصيب', desc: 'جنوب البصرة، منطقة النخيل والأنهار الجميلة' },
  { id: 'tanuma',     name: 'التنومة',     desc: 'حي شرق البصرة بالقرب من أبو الخصيب' },
  { id: 'qurna',      name: 'القرنة',      desc: 'شمال البصرة عند ملتقى دجلة والفرات' },
  { id: 'faw',        name: 'الفاو',       desc: 'أقصى جنوب البصرة على الخليج العربي' },
  { id: 'madina',     name: 'المدينة',     desc: 'المنطقة الإدارية والمركزية في البصرة' },
  { id: 'khor',       name: 'خور الزبير', desc: 'منطقة صناعية وميناء جنوب الزبير' },
] as const;

function InfoRow({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className="flex justify-between items-center py-3.5 border-b border-gray-50 dark:border-slate-700 last:border-0">
      <span className="text-gray-800 dark:text-slate-200 font-semibold text-sm">{value}</span>
      <div className="flex items-center gap-2">
        <span className="text-gray-400 dark:text-slate-500 text-sm">{label}</span>
        <span style={{ color }}>{icon}</span>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const { dark } = useDarkMode();
  const { restaurant_name, primary_color } = useSettings();
  
  const rawColor   = primary_color || "#e67e22";
  const isTooDark  = rawColor === '#000000' || rawColor.toLowerCase() === '#121212';
  const brandColor = (dark && isTooDark) ? '#ffffff' : rawColor;

  const [name,     setName]     = useState('');
  const [phone,    setPhone]    = useState('');
  const [district, setDistrict] = useState('');
  const [address,  setAddress]  = useState('');
  const [editing,  setEditing]  = useState(false);
  const [saved,    setSaved]    = useState(false);
  const [mounted,  setMounted]  = useState(false);

  useEffect(() => {
    const n = localStorage.getItem(KEYS.name)     || '';
    const p = localStorage.getItem(KEYS.phone)    || '';
    const d = localStorage.getItem(KEYS.district) || '';
    const a = localStorage.getItem(KEYS.address)  || '';
    setName(n);
    setPhone(p);
    setDistrict(d);
    setAddress(a);
    if (!n || !p) setEditing(true);
    setMounted(true);
  }, []);

  const selectedDistrict = BASRA_DISTRICTS.find(d => d.id === district);

  const handleSave = () => {
    if (!name.trim() || !phone.trim()) { alert('الرجاء إدخال الاسم ورقم الهاتف'); return; }
    localStorage.setItem(KEYS.name,     name.trim());
    localStorage.setItem(KEYS.phone,    phone.trim());
    localStorage.setItem(KEYS.district, district);
    localStorage.setItem(KEYS.address,  address.trim());
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-32">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 py-4">
        <h1 className="text-xl font-bold text-center" style={{ color: brandColor }}>معلوماتي</h1>
      </header>

      <div className="px-4 pt-5 max-w-lg mx-auto space-y-4">

        {/* Avatar */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-20 h-20 rounded-full flex items-center justify-center border-4" style={{ backgroundColor: `${brandColor}15`, borderColor: `${brandColor}40` }}>
            <User size={36} style={{ color: brandColor }}/>
          </div>
        </div>

        {!editing ? (
          /* ── وضع العرض ── */
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-50 dark:border-slate-700">
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 font-semibold text-sm active:scale-95 transition-all"
                style={{ color: brandColor }}
              >
                <Pencil size={14}/>
                تعديل
              </button>
              <h3 className="font-bold text-gray-900 dark:text-slate-100">معلوماتك الشخصية</h3>
            </div>

            <div className="px-5 pb-2">
              <InfoRow label="الاسم"    value={name}   icon={<User size={14}/>} color={brandColor}/>
              <InfoRow label="الهاتف"   value={phone}  icon={<Phone size={14}/>} color={brandColor}/>
              {selectedDistrict && (
                <InfoRow label="المنطقة" value={selectedDistrict.name} icon={<MapPin size={14}/>} color={brandColor}/>
              )}
              {address.trim() && (
                <InfoRow label="العنوان" value={address} icon={<HomeIcon size={14}/>} color={brandColor}/>
              )}
            </div>
          </div>
        ) : (
          /* ── وضع التعديل ── */
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 space-y-3">
            <h3 className="font-bold text-gray-900 dark:text-slate-100 text-right mb-1">
              {name ? 'تعديل المعلومات' : 'أضف معلوماتك'}
            </h3>

            <input
              type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="الاسم *" dir="rtl"
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 mb-1"
              style={{ '--tw-ring-color': brandColor } as any}
            />

            <input
              type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="رقم الهاتف *" dir="rtl"
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 mb-1"
              style={{ '--tw-ring-color': brandColor } as any}
            />

            <div className="relative">
              <select
                value={district} onChange={e => setDistrict(e.target.value)} dir="rtl"
                className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 appearance-none"
                style={{ '--tw-ring-color': brandColor } as any}
              >
                <option value="">اختر منطقة التوصيل</option>
                {BASRA_DISTRICTS.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
            </div>

            {selectedDistrict && (
              <div className="border rounded-xl px-4 py-2.5 flex items-center gap-2.5" style={{ backgroundColor: `${brandColor}10`, borderColor: `${brandColor}30` }}>
                <MapPin size={14} className="flex-shrink-0" style={{ color: brandColor }}/>
                <p className="text-sm text-gray-600 dark:text-slate-400 text-right flex-1">{selectedDistrict.desc}</p>
              </div>
            )}

            <input
              type="text" value={address} onChange={e => setAddress(e.target.value)}
              placeholder="تفاصيل العنوان (شارع، زقاق...)" dir="rtl"
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 mb-1"
              style={{ '--tw-ring-color': brandColor } as any}
            />

            <button
              onClick={handleSave}
              className="w-full text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg"
              style={{ backgroundColor: brandColor }}
            >
              <Check size={18}/>
              حفظ المعلومات
            </button>
          </div>
        )}

        {saved && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 text-center">
            <p className="text-green-700 dark:text-green-400 font-semibold text-sm">✓ تم حفظ معلوماتك بنجاح</p>
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
