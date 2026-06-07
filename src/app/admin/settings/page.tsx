'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/context/SettingsContext';
import { Save, Palette, Type, Image as ImageIcon, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function BrandingPage() {
  const { restaurant_name, primary_color, logo_url, refreshSettings, loaded } = useSettings();
  const [form, setForm] = useState({
    name: '',
    color: '#000000',
    logo: ''
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: '', error: false });

  useEffect(() => {
    if (loaded) {
      setForm({
        name: restaurant_name || '',
        color: primary_color || '#000000',
        logo: logo_url || ''
      });
    }
  }, [loaded, restaurant_name, primary_color, logo_url]);

  const handleSave = async () => {
    setSaving(true);
    setMsg({ text: '', error: false });

    const { error } = await supabase
      .from('restaurant_settings')
      .update({
        restaurant_name: form.name,
        primary_color: form.color,
        logo_url: form.logo,
        updated_at: new Date().toISOString()
      })
      .eq('id', (await supabase.from('restaurant_settings').select('id').limit(1)).data?.[0]?.id);

    if (error) {
      setMsg({ text: 'تعذّر حفظ الإعدادات', error: true });
    } else {
      await refreshSettings();
      setMsg({ text: '✓ تم حفظ التعديلات بنجاح', error: false });
    }
    setSaving(false);
  };

  if (!loaded) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto" /></div>;

  return (
    <div className="max-w-4xl mx-auto p-6 pb-32">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-black mb-8 text-right">إعدادات الهوية البصرية</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Controls */}
          <div className="space-y-8 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-gray-100 dark:border-slate-800 shadow-xl">
            
            <div className="space-y-2 text-right">
              <label className="flex items-center justify-end gap-2 text-sm font-black opacity-50">
                اسم المطعم <Type size={16}/>
              </label>
              <input 
                type="text" 
                value={form.name}
                onChange={e => setForm({...form, name: e.target.value})}
                className="w-full p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border-none focus:ring-2 focus:ring-black text-right font-bold"
                placeholder="أدخل اسم المطعم هنا"
              />
            </div>

            <div className="space-y-2 text-right">
              <label className="flex items-center justify-end gap-2 text-sm font-black opacity-50">
                اللون الأساسي <Palette size={16}/>
              </label>
              <div className="flex gap-4">
                 <input 
                  type="color" 
                  value={form.color}
                  onChange={e => setForm({...form, color: e.target.value})}
                  className="w-20 h-14 bg-transparent cursor-pointer rounded-xl overflow-hidden border-none"
                />
                <input 
                  type="text" 
                  value={form.color}
                  onChange={e => setForm({...form, color: e.target.value})}
                  className="flex-1 p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border-none focus:ring-2 focus:ring-black font-mono text-center"
                />
              </div>
            </div>

            <div className="space-y-2 text-right">
              <label className="flex items-center justify-end gap-2 text-sm font-black opacity-50">
                رابط الشعار (URL) <ImageIcon size={16}/>
              </label>
              <input 
                type="text" 
                value={form.logo}
                onChange={e => setForm({...form, logo: e.target.value})}
                className="w-full p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border-none focus:ring-2 focus:ring-black text-left font-medium"
                placeholder="https://image-url.com/logo.png"
              />
            </div>

            <button 
              onClick={handleSave}
              disabled={saving}
              className="w-full py-5 bg-black text-white rounded-[1.5rem] font-black flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" /> : <Save size={20}/>}
              حفظ التعديلات
            </button>

            {msg.text && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-center font-black ${msg.error ? 'text-red-500' : 'text-green-500'}`}>
                {msg.text}
              </motion.p>
            )}
          </div>

          {/* Preview */}
          <div className="space-y-4">
             <p className="text-right text-xs font-black opacity-30 uppercase tracking-widest px-2">معاينة مباشرة</p>
             <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border-4 border-black/5 shadow-2xl space-y-8 flex flex-col items-center justify-center min-h-[400px]">
                {form.logo ? (
                  <img src={form.logo} alt="Preview" className="h-24 w-24 object-contain rounded-2xl border-4 border-gray-50" />
                ) : (
                  <div className="h-24 w-24 bg-gray-100 rounded-2xl flex items-center justify-center text-gray-300">
                    <ImageIcon size={40} />
                  </div>
                )}
                <div className="text-center space-y-2">
                  <h2 className="text-2xl font-black" style={{ color: form.color }}>{form.name || 'اسم المطعم'}</h2>
                  <div className="w-12 h-1.5 mx-auto rounded-full" style={{ backgroundColor: form.color, opacity: 0.2 }} />
                </div>
                <div className="w-full p-6 rounded-3xl text-white font-black text-center shadow-lg" style={{ backgroundColor: form.color }}>
                  زر تجريبي
                </div>
             </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
