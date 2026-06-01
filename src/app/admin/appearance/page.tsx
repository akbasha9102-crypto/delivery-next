'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { AdminBottomNav } from '@/components/BottomNav';
import { AdminGuard } from '@/components/AdminGuard';
import { Check, Upload, X } from 'lucide-react';
import Image from 'next/image';

const PRESETS = [
  '#e67e22', '#e74c3c', '#2ecc71', '#3498db',
  '#9b59b6', '#1abc9c', '#f39c12', '#e91e63',
  '#00bcd4', '#ff5722', '#607d8b', '#795548',
];

function AppearancePage() {
  const [name,       setName]       = useState('');
  const [color,      setColor]      = useState('#e67e22');
  const [logoUrl,    setLogoUrl]    = useState('');
  const [logoInput,  setLogoInput]  = useState('');
  const [settingsId, setSettingsId] = useState('');
  const [saving,     setSaving]     = useState(false);
  const [uploading,  setUploading]  = useState(false);
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('restaurant_settings').select('*').maybeSingle().then(({ data }) => {
      if (data) {
        setSettingsId(data.id);
        setName(data.restaurant_name);
        setColor(data.primary_color);
        setLogoUrl(data.logo_url || '');
        setLogoInput(data.logo_url || '');
      }
    });
  }, []);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2500);
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    const ext  = file.name.split('.').pop();
    const path = `logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true });
    if (error) { showToast('فشل رفع الصورة', false); setUploading(false); return; }
    const { data } = supabase.storage.from('logos').getPublicUrl(path);
    setLogoUrl(data.publicUrl);
    setLogoInput(data.publicUrl);
    setUploading(false);
  };

  const handleSave = async () => {
    if (!name.trim()) { showToast('أدخل اسم المطعم', false); return; }
    setSaving(true);
    const payload = {
      restaurant_name: name.trim(),
      primary_color: color,
      logo_url: logoInput.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const upsertPayload = settingsId ? { ...payload, id: settingsId } : payload;
    const { data: saved, error } = await supabase
      .from('restaurant_settings')
      .upsert(upsertPayload)
      .select()
      .single();

    setSaving(false);
    if (error) { console.error('appearance save error:', error); showToast('حدث خطأ أثناء الحفظ', false); return; }

    if (saved?.id) setSettingsId(saved.id);
    setLogoUrl(logoInput.trim());
    showToast('تم حفظ المظهر بنجاح ✓');
  };

  const darken = (hex: string) => {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    const d = (c: number) => Math.max(0, Math.floor(c*0.82)).toString(16).padStart(2,'0');
    return `#${d(r)}${d(g)}${d(b)}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 pb-28">
      <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-700 px-4 h-14 flex items-center justify-center">
        <h1 className="text-lg font-bold text-gray-900 dark:text-slate-100">المظهر</h1>
      </header>

      <div className="px-4 pt-5 space-y-4 max-w-lg mx-auto">

        {/* ── Preview ── */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-100 dark:border-slate-700 shadow-sm">
          <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: color }}>
            {logoUrl ? (
              <Image src={logoUrl} alt="logo" width={80} height={32} className="h-8 w-auto object-contain" unoptimized/>
            ) : (
              <span className="text-white font-extrabold text-lg">{name || 'اسم المطعم'}</span>
            )}
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold">☀</div>
          </div>
          <div className="p-4">
            <div className="flex gap-2 mb-3">
              {['الكل','مقبلات','رئيسي'].map((t,i) => (
                <span key={t} className="px-3 py-1 rounded-full text-xs font-bold"
                  style={i===0 ? { backgroundColor: color, color: '#fff' } : { backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                  {t}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[1,2].map(i => (
                <div key={i} className="rounded-xl overflow-hidden border border-gray-100 dark:border-slate-700">
                  <div className="h-16 bg-gray-100 dark:bg-slate-700"/>
                  <div className="p-2">
                    <div className="h-2.5 bg-gray-200 dark:bg-slate-600 rounded mb-1.5"/>
                    <div className="h-2 bg-gray-100 dark:bg-slate-700 rounded w-2/3 mb-2"/>
                    <div className="h-2 w-1/2 rounded mb-2" style={{ backgroundColor: color }}/>
                    <div className="h-6 rounded-lg text-white text-xs flex items-center justify-center font-bold"
                         style={{ backgroundColor: color }}>+ أضف</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Form ── */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-slate-700 space-y-5">

          {/* Name */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 text-right mb-2">اسم المطعم</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} dir="rtl"
              placeholder="اسم المطعم"
              className="w-full bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 text-right text-gray-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-[var(--primary)]"/>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 text-right mb-3">اللون الرئيسي</label>
            {/* Presets */}
            <div className="flex flex-wrap gap-2 mb-3 justify-end">
              {PRESETS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full border-2 transition-all active:scale-90 flex items-center justify-center"
                  style={{ backgroundColor: c, borderColor: color === c ? '#000' : 'transparent' }}>
                  {color === c && <Check size={14} color="#fff" strokeWidth={3}/>}
                </button>
              ))}
            </div>
            {/* Custom color + hex */}
            <div className="flex items-center gap-3 justify-end">
              <span className="text-sm text-gray-500 dark:text-slate-400 font-mono">{color}</span>
              <input type="text" value={color} onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setColor(e.target.value); }}
                className="w-28 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm text-center outline-none font-mono focus:ring-2"
                style={{ '--tw-ring-color': color } as React.CSSProperties}/>
              <input type="color" value={color} onChange={e => setColor(e.target.value)}
                className="w-10 h-10 rounded-xl cursor-pointer border border-gray-200 dark:border-slate-600"/>
            </div>
          </div>

          {/* Logo */}
          <div>
            <label className="block text-sm font-bold text-gray-700 dark:text-slate-300 text-right mb-2">اللوغو</label>
            <div className="flex gap-2">
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 dark:border-slate-600 rounded-xl text-sm font-semibold text-gray-600 dark:text-slate-400 active:scale-95 transition-all flex-shrink-0">
                <Upload size={15}/>
                {uploading ? 'جاري الرفع...' : 'رفع'}
              </button>
              <input type="text" value={logoInput} onChange={e => setLogoInput(e.target.value)} dir="ltr"
                placeholder="أو الصق رابط الصورة"
                className="flex-1 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm text-left text-gray-900 dark:text-slate-100 outline-none focus:ring-2 placeholder-gray-300"
                style={{ '--tw-ring-color': color } as React.CSSProperties}/>
              {logoInput && (
                <button onClick={() => { setLogoInput(''); setLogoUrl(''); }}
                  className="p-2.5 text-red-400 flex-shrink-0"><X size={16}/></button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}/>
            {logoInput && (
              <div className="mt-2 flex justify-end">
                <Image src={logoInput} alt="preview" width={120} height={40} className="h-10 w-auto object-contain rounded-lg border border-gray-100 dark:border-slate-700" unoptimized/>
              </div>
            )}
          </div>
        </div>

        {/* Save */}
        <button onClick={handleSave} disabled={saving}
          className="w-full text-white font-bold py-4 rounded-xl text-lg transition-all active:scale-95 disabled:opacity-60"
          style={{ backgroundColor: color }}>
          {saving ? 'جاري الحفظ...' : 'حفظ المظهر'}
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-24 left-4 right-4 mx-auto max-w-sm text-white text-center font-semibold py-3 px-5 rounded-2xl z-50 shadow-lg transition-all ${toast.ok ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}

      <AdminBottomNav/>
    </div>
  );
}

export default function AppearancePageWrapper() {
  return <AdminGuard><AppearancePage/></AdminGuard>;
}
