'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/context/SettingsContext';
import { Save, Palette, Type, Image as ImageIcon, Loader2, Moon, ShoppingBag } from 'lucide-react';
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

            <div className="space-y-4 text-right">
              <label className="flex items-center justify-end gap-2 text-sm font-black opacity-50">
                اللون الأساسي <Palette size={16}/>
              </label>
              <div className="flex flex-col items-center gap-4">
                 <div 
                   className="w-full h-32 rounded-[2rem] shadow-inner flex items-center justify-center cursor-pointer relative overflow-hidden group border-4 border-gray-50 dark:border-slate-800"
                   style={{ backgroundColor: form.color }}
                 >
                    <input 
                      type="color" 
                      value={form.color}
                      onChange={e => setForm({...form, color: e.target.value})}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-white font-mono text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                      {form.color.toUpperCase()}
                    </div>
                 </div>
                 <p className="text-[10px] text-gray-400 font-bold">انقر على المربع أعلاه لتغيير اللون</p>
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
              className="w-full py-5 text-white rounded-[1.5rem] font-black flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all disabled:opacity-50"
              style={{ backgroundColor: form.color }}
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
             <p className="text-right text-xs font-black opacity-30 uppercase tracking-widest px-2">معاينة مباشرة (شاشة الجوال)</p>
             <div className="bg-gray-50 dark:bg-slate-950 p-4 rounded-[3rem] border-8 border-gray-200 dark:border-slate-800 shadow-2xl min-h-[500px] flex flex-col overflow-hidden relative">
                
                {/* Simulated Header */}
                <div className="bg-white dark:bg-slate-900 px-4 h-16 flex items-center justify-between shadow-sm rounded-t-[1.5rem]">
                  <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                    <Moon size={14} className="text-gray-400"/>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] font-black truncate max-w-[120px]">{form.name || 'اسم المطعم'}</p>
                    <div className="w-6 h-0.5 mx-auto rounded-full opacity-20" style={{ backgroundColor: form.color }}/>
                  </div>
                  {form.logo ? (
                    <img src={form.logo} alt="Logo" className="h-10 w-10 object-cover rounded-lg border border-gray-100" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: form.color }}>
                      <ImageIcon size={16} />
                    </div>
                  )}
                </div>

                <div className="p-4 space-y-4">
                  {/* Simulated Category Pills */}
                  <div className="flex gap-2 overflow-x-hidden flex-row-reverse">
                    <div className="px-4 py-2 rounded-xl text-[10px] font-black text-white" style={{ backgroundColor: form.color }}>القسم المختار</div>
                    <div className="px-4 py-2 rounded-xl text-[10px] font-black bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-400">قسم آخر</div>
                    <div className="px-4 py-2 rounded-xl text-[10px] font-black bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-400">قسم ثالث</div>
                  </div>

                  {/* Simulated Card */}
                  <div className="bg-white dark:bg-slate-900 rounded-[2rem] p-3 shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col gap-2">
                    <div className="h-32 bg-gray-50 dark:bg-slate-800 rounded-[1.5rem] flex items-center justify-center text-gray-200">
                      <ImageIcon size={32} />
                    </div>
                    <div className="flex justify-between items-center flex-row-reverse px-1">
                      <div className="text-right">
                        <p className="font-black text-sm">اسم المنتج</p>
                        <p className="text-xs font-black" style={{ color: form.color }}>15,000 د.ع</p>
                      </div>
                      <div className="h-8 px-4 rounded-xl text-white text-[10px] font-black flex items-center justify-center" style={{ backgroundColor: form.color }}>
                        إضافة
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Bar Info */}
                <div className="absolute bottom-6 left-6 right-6 p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-2xl border border-gray-100 dark:border-slate-800 flex items-center justify-between flex-row-reverse">
                   <div className="flex items-center gap-2">
                     <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: form.color }}>
                       <ShoppingBag size={14} />
                     </div>
                     <p className="text-[10px] font-black">السلة</p>
                   </div>
                   <div className="px-4 py-2 rounded-xl text-white text-[10px] font-black" style={{ backgroundColor: form.color }}>إتمام الطلب</div>
                </div>
             </div>
             <p className="text-center text-[10px] text-gray-400 font-medium">الشعار يظهر دائماً في الجهة اليسرى للهيدر</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
