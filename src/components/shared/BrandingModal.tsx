'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useSettings } from '@/context/SettingsContext';
import { useRestaurant } from '@/context/RestaurantContext';
import { Loader2, Save, Type, Palette, Image as ImageIcon, Moon, ShoppingBag, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function BrandingModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { restaurant_name, primary_color, logo_url, refreshSettings, loaded } = useSettings();
  const { restaurantId } = useRestaurant();
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
    if (!restaurantId) {
      setMsg({ text: 'تعذّر تحديد المطعم الحالي', error: true });
      return;
    }
    setSaving(true);
    setMsg({ text: '', error: false });

    // معرّف صف الإعدادات لهذا المطعم تحديداً — لا يجوز جلب أي صف بلا فلترة
    // بمعرّف المطعم، وإلا قد يُحفظ التعديل على مطعم آخر بالكامل (خطأ #5 بتقرير الفحص).
    const { data: settings } = await supabase.from('restaurant_settings').select('id').eq('restaurant_id', restaurantId).limit(1);
    const settingsId = settings?.[0]?.id;

    if (!settingsId) {
      setMsg({ text: 'تعذّر العثور على الإعدادات', error: true });
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from('restaurant_settings')
      .update({
        restaurant_name: form.name,
        primary_color: form.color,
        logo_url: form.logo,
        updated_at: new Date().toISOString()
      })
      .eq('id', settingsId);

    if (error) {
      setMsg({ text: 'تعذّر حفظ الإعدادات', error: true });
    } else {
      await refreshSettings();
      setMsg({ text: '✓ تم حفظ التعديلات بنجاح', error: false });
      setTimeout(() => setMsg({ text: '', error: false }), 3000);
    }
    setSaving(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] shadow-2xl relative"
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 left-6 p-2 bg-gray-100 dark:bg-slate-800 rounded-full text-gray-500 hover:text-black dark:hover:text-white transition-colors z-10"
        >
          <X size={24} />
        </button>

        <div className="p-8">
          <h1 className="text-2xl font-black mb-8 text-right">إعدادات الهوية البصرية</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Controls */}
            <div className="space-y-6">
              <div className="space-y-2 text-right">
                <label className="flex items-center justify-end gap-2 text-xs font-black opacity-50 uppercase tracking-widest">
                  اسم المطعم <Type size={14}/>
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
                <label className="flex items-center justify-end gap-2 text-xs font-black opacity-50 uppercase tracking-widest">
                  اللون الأساسي <Palette size={14}/>
                </label>
                <div className="flex flex-col items-center gap-4">
                  <div
                    className="w-full h-24 rounded-[1.5rem] shadow-inner flex items-center justify-center cursor-pointer relative overflow-hidden group border-4 border-gray-50 dark:border-slate-800"
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
                <label className="flex items-center justify-end gap-2 text-xs font-black opacity-50 uppercase tracking-widest">
                  رابط الشعار (URL) <ImageIcon size={14}/>
                </label>
                <input
                  type="text"
                  value={form.logo}
                  onChange={e => setForm({...form, logo: e.target.value})}
                  className="w-full p-4 bg-gray-50 dark:bg-slate-800 rounded-2xl border-none focus:ring-2 focus:ring-black text-left font-medium"
                  placeholder="https://..."
                />
              </div>

              <button 
                onClick={handleSave}
                disabled={saving}
                className="w-full py-5 bg-gradient-to-b from-[#22A066] to-[#186341] dark:bg-none dark:bg-[#10B981] text-white rounded-[1.5rem] font-black flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all disabled:opacity-50 mt-4"
              >
                {saving ? <Loader2 className="animate-spin" /> : <Save size={20}/>}
                حفظ التعديلات
              </button>

              {msg.text && (
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-center text-sm font-black ${msg.error ? 'text-red-500' : 'text-green-500'}`}>
                  {msg.text}
                </motion.p>
              )}
            </div>

            {/* Preview */}
            <div className="space-y-4">
               <p className="text-right text-[10px] font-black opacity-30 uppercase tracking-widest px-2">معاينة مباشرة (شاشة الجوال)</p>
               <div className="bg-gray-50 dark:bg-slate-950 p-4 rounded-[2.5rem] border-8 border-gray-100 dark:border-slate-800 shadow-2xl min-h-[400px] flex flex-col overflow-hidden relative scale-90 origin-top">
                  
                  {/* Simulated Header */}
                  <div className="bg-white dark:bg-slate-900 px-4 h-14 flex items-center justify-between shadow-sm rounded-t-[1.5rem]">
                    <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-slate-800 flex items-center justify-center">
                      <Moon size={12} className="text-gray-400"/>
                    </div>
                    <div className="text-center">
                      <p className="text-[9px] font-black truncate max-w-[100px]">{form.name || 'اسم المطعم'}</p>
                      <div className="w-5 h-0.5 mx-auto rounded-full opacity-20" style={{ backgroundColor: form.color }}/>
                    </div>
                    {form.logo ? (
                      <img src={form.logo} alt="Logo" className="h-8 w-8 object-cover rounded-lg border border-gray-100" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: form.color }}>
                        <ImageIcon size={14} />
                      </div>
                    )}
                  </div>

                  <div className="p-3 space-y-3">
                    {/* Simulated Category Pills */}
                    <div className="flex gap-1.5 overflow-x-hidden flex-row-reverse">
                      <div className="px-3 py-1.5 rounded-xl text-[8px] font-black text-white" style={{ backgroundColor: form.color }}>القسم المختار</div>
                      <div className="px-3 py-1.5 rounded-xl text-[8px] font-black bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-400">قسم آخر</div>
                    </div>

                    {/* Simulated Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] p-2 shadow-sm border border-gray-100 dark:border-slate-800 flex flex-col gap-2">
                      <div className="h-24 bg-gray-50 dark:bg-slate-800 rounded-[1rem] flex items-center justify-center text-gray-200">
                        <ImageIcon size={24} />
                      </div>
                      <div className="flex justify-between items-center flex-row-reverse px-1">
                        <div className="text-right">
                          <p className="font-black text-[10px]">اسم المنتج</p>
                          <p className="text-[8px] font-black" style={{ color: form.color }}>15,000 د.ع</p>
                        </div>
                        <div className="h-6 px-3 rounded-lg text-white text-[8px] font-black flex items-center justify-center" style={{ backgroundColor: form.color }}>
                          إضافة
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Bar Info */}
                  <div className="absolute bottom-4 left-4 right-4 p-3 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-xl border border-gray-100 dark:border-slate-800 flex items-center justify-between flex-row-reverse">
                     <div className="flex items-center gap-2">
                       <div className="w-6 h-6 rounded-lg flex items-center justify-center text-white" style={{ backgroundColor: form.color }}>
                         <ShoppingBag size={12} />
                       </div>
                       <p className="text-[8px] font-black">السلة</p>
                     </div>
                     <div className="px-3 py-1.5 rounded-lg text-white text-[8px] font-black" style={{ backgroundColor: form.color }}>إتمام الطلب</div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
