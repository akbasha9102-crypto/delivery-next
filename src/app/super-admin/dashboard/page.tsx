'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────
type Restaurant = {
  id: string; restaurant_name: string; primary_color: string;
  logo_url: string | null; is_closed: boolean; whatsapp_number: string | null;
  updated_at?: string;
  admin_email?: string | null; admin_password?: string | null;
  subscription_start?: string | null; is_suspended?: boolean | null;
  restaurant_id?: string | null; slug?: string | null; owner_id?: string | null;
};
type AuthUser = { id: string; email: string | null; created_at: string };
type Driver   = { id: string; name: string; phone: string; status: string };
type Order    = {
  id: string; client_name: string; client_phone: string;
  delivery_address: string | null; total_amount: number;
  status: string; created_at: string; driver_name?: string | null;
};

// توليد slug من اسم المطعم (يتطابق مع منطق الـ API)
function autoSlug(name: string): string {
  const noPrefix = name.replace(/^مطعم\s*/u, '').trim();
  const latin = noPrefix.replace(/[^a-zA-Z0-9\s]/g, '').toLowerCase().trim();
  if (latin.length >= 2) return latin.replace(/\s+/g, '-');
  return 'restaurant-' + Date.now();
}

// ─── Constants ────────────────────────────────────────────────────────────────
const COMMISSION = 0.10;

const S: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  pending:   { label: 'انتظار',       color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  dot: 'bg-amber-400'  },
  preparing: { label: 'قيد التجهيز', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  dot: 'bg-blue-400'   },
  pickup:    { label: 'مع السائق',    color: '#f97316', bg: 'rgba(249,115,22,0.12)',  dot: 'bg-orange-400' },
  ready:     { label: 'في الطريق',   color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)',  dot: 'bg-purple-400' },
  completed: { label: 'مكتمل',       color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   dot: 'bg-green-400'  },
  rejected:  { label: 'مرفوض',       color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   dot: 'bg-red-400'    },
};
const DS: Record<string, { label: string; color: string; bg: string }> = {
  active:  { label: 'متاح',     color: '#22c55e', bg: 'rgba(34,197,94,0.12)'  },
  on_trip: { label: 'في رحلة',  color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
  offline: { label: 'غير متصل', color: '#6b7280', bg: 'rgba(107,114,128,0.1)' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(iso: string) {
  const d = new Date(iso), h = d.getHours();
  return `${h % 12 || 12}:${d.getMinutes().toString().padStart(2,'0')} ${h >= 12 ? 'م' : 'ص'}`;
}
function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────
function ToggleSwitch({ on, onChange, disabled, colorOn = '#22c55e' }: {
  on: boolean; onChange: () => void; disabled?: boolean; colorOn?: string;
}) {
  return (
    <button onClick={onChange} disabled={disabled}
      className="relative w-11 h-6 rounded-full transition-all duration-300 focus:outline-none disabled:opacity-50 flex-shrink-0"
      style={{ backgroundColor: on ? colorOn : '#374151' }}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-300 ${on ? 'translate-x-5' : ''}`} />
    </button>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, gradient }: {
  label: string; value: string | number; sub?: string; icon: string; gradient: string;
}) {
  return (
    <div className={`rounded-2xl p-4 border border-white/5 relative overflow-hidden ${gradient}`}>
      <div className="absolute top-3 left-3 text-2xl opacity-30">{icon}</div>
      <p className="text-white/60 text-xs font-medium mb-1">{label}</p>
      <p className="text-white font-black text-2xl leading-none">{value}</p>
      {sub && <p className="text-white/50 text-[11px] mt-1">{sub}</p>}
    </div>
  );
}

// ─── User Credential Row ──────────────────────────────────────────────────────
function UserCredentialRow({ user, restaurantDbId, onCredentialChange }: {
  user: AuthUser;
  restaurantDbId: string;
  onCredentialChange: (newSlug: string | null, newPass: string | null) => Promise<boolean>;
}) {
  const [editing,    setEditing]    = useState(false);
  const [newSlug,    setNewSlug]    = useState('');
  const [newPass,    setNewPass]    = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [status,     setStatus]     = useState<'idle'|'ok'|'err'>('idle');

  const currentUsername = user.email?.replace('@dasha.app', '') ?? '';

  const canSave = newSlug.trim() !== '' || newPass.trim() !== '';

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true); setStatus('idle');
    const ok = await onCredentialChange(newSlug.trim() || null, newPass.trim() || null);
    setSaving(false);
    setStatus(ok ? 'ok' : 'err');
    if (ok) { setNewSlug(''); setNewPass(''); setEditing(false); setTimeout(() => setStatus('idle'), 2000); }
  };

  // suppress unused var warning — restaurantDbId is used by the parent closure via onCredentialChange
  void restaurantDbId;

  return (
    <div className="bg-[#0d0d20] rounded-xl border border-slate-700/40 overflow-hidden">
      {/* Username row */}
      <div className="flex items-center justify-between px-3 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 text-violet-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-slate-500 mb-0.5">اسم المستخدم</p>
            <p className="text-slate-100 text-sm font-mono truncate" dir="ltr">{currentUsername}</p>
          </div>
        </div>
        <button
          onClick={() => { setEditing(v => !v); setStatus('idle'); setNewSlug(''); setNewPass(''); }}
          className={`flex-shrink-0 text-xs px-2.5 py-1.5 rounded-lg font-bold transition-all ${
            editing ? 'bg-slate-700 text-slate-300' : 'bg-violet-600/20 text-violet-400 hover:bg-violet-600/30'
          }`}
        >
          {editing ? 'إلغاء' : 'تعديل'}
        </button>
      </div>

      {/* Password row — always visible */}
      <div className="border-t border-slate-700/30 px-3 py-2.5 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-slate-700/40 flex items-center justify-center flex-shrink-0">
          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"/>
          </svg>
        </div>
        <div>
          <p className="text-[10px] text-slate-500 mb-0.5">كلمة المرور</p>
          <p className="text-slate-400 text-sm font-mono tracking-widest">••••••••</p>
        </div>
      </div>

      {/* Combined edit form */}
      {editing && (
        <div className="border-t border-slate-700/30 px-3 pb-3 pt-2.5 space-y-3">
          {/* New username field */}
          <div className="space-y-1">
            <p className="text-slate-500 text-[10px]">اسم المستخدم الجديد</p>
            <input
              value={newSlug}
              onChange={e => setNewSlug(e.target.value.replace(/[^a-z0-9-]/g, ''))}
              type="text"
              dir="ltr"
              placeholder={currentUsername}
              className="w-full bg-[#1a1a35] text-slate-100 text-sm outline-none px-3 py-2 rounded-lg placeholder:text-slate-600 border border-slate-600/40 focus:border-violet-500/50 transition-colors font-mono"
            />
          </div>

          {/* New password field */}
          <div className="space-y-1">
            <p className="text-slate-500 text-[10px]">كلمة المرور الجديدة</p>
            <div className="flex gap-2">
              <input
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                type={showPass ? 'text' : 'password'}
                dir="ltr"
                placeholder="اتركه فارغاً للإبقاء على الحالية"
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                className="flex-1 bg-[#1a1a35] text-slate-100 text-sm outline-none px-3 py-2 rounded-lg placeholder:text-slate-600 border border-slate-600/40 focus:border-violet-500/50 transition-colors"
              />
              <button onClick={() => setShowPass(v => !v)}
                className="w-9 h-9 rounded-lg bg-slate-700/50 flex items-center justify-center text-slate-400 hover:text-white transition-colors flex-shrink-0">
                {showPass
                  ? <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/></svg>
                  : <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                }
              </button>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className={`w-full py-2 rounded-lg text-xs font-bold transition-all active:scale-95 disabled:opacity-40 ${
              status === 'ok'  ? 'bg-green-600/30 text-green-400 border border-green-500/30' :
              status === 'err' ? 'bg-red-600/30 text-red-400 border border-red-500/30' :
              'bg-violet-600/20 text-violet-400 border border-violet-500/30 hover:bg-violet-600/30'
            }`}
          >
            {saving ? 'جاري الحفظ...' : status === 'ok' ? '✓ تم الحفظ' : status === 'err' ? '✗ فشل' : 'حفظ'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Restaurant Card ──────────────────────────────────────────────────────────
function RestaurantCard({
  r, toggling, matchedUser, onToggleSuspended, onRefresh,
}: {
  r: Restaurant;
  toggling: boolean;
  matchedUser: AuthUser | null;
  onToggleSuspended: () => void;
  onRefresh: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-[#13132b] rounded-2xl border border-slate-700/50 overflow-hidden">

      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-4 text-right hover:bg-white/5 transition-colors active:bg-white/10"
        onClick={() => setOpen(v => !v)}
      >
        {r.logo_url ? (
          <img src={r.logo_url} alt="" className="w-11 h-11 rounded-xl object-cover flex-shrink-0 bg-slate-700" />
        ) : (
          <div className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center text-xl" style={{ backgroundColor: r.primary_color + '30' }}>🏪</div>
        )}
        <div className="flex-1 min-w-0 text-right">
          <p className="font-bold text-sm text-white leading-tight truncate">{r.restaurant_name}</p>
          <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold mt-1 ${r.is_suspended ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
            {r.is_suspended ? 'موقوف' : 'نشط'}
          </span>
        </div>
        <span className={`text-slate-500 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-180' : ''}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {/* Expanded */}
      {open && (
        <div className="border-t border-slate-700/50 px-4 pb-4 pt-3 space-y-4">

          {/* ── Credentials ── */}
          <div className="space-y-2">
            <p className="text-slate-400 text-xs font-bold">حسابات الدخول للداشبورد</p>

            {matchedUser === null ? (
              <div className="bg-[#0d0d20] rounded-xl border border-slate-700/40 px-4 py-3 text-slate-500 text-sm text-center">
                لا يوجد حساب مرتبط بهذا المطعم
              </div>
            ) : (
              <UserCredentialRow
                user={matchedUser}
                restaurantDbId={r.restaurant_id ?? r.id}
                onCredentialChange={async (newSlug, newPass) => {
                  const res = await fetch('/api/super-admin/restaurants', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      restaurantDbId: r.restaurant_id ?? r.id,
                      newSlug,
                      newPassword: newPass,
                    }),
                  }).catch(() => null);
                  if (res?.ok) { onRefresh(); }
                  return !!res?.ok;
                }}
              />
            )}
          </div>

          {/* ── Subscription ── */}
          <div className="bg-[#0d0d20] rounded-xl p-3 border border-slate-700/40">
            <p className="text-slate-500 text-[10px] mb-1">تاريخ بدء الاشتراك في داشا</p>
            <p className="text-slate-200 text-sm font-bold">
              {r.subscription_start ? fmtDate(r.subscription_start) : '—'}
            </p>
          </div>

          {/* ── Suspend toggle ── */}
          <div className="flex items-center justify-between bg-red-950/30 border border-red-900/30 rounded-xl px-3 py-3">
            <div>
              <p className="text-red-300 text-sm font-semibold">تعليق الاشتراك الكامل</p>
              <p className="text-red-500/70 text-[10px] mt-0.5">يوقف الموقع والداشبورد فوراً</p>
            </div>
            <ToggleSwitch on={!!r.is_suspended} onChange={onToggleSuspended} disabled={toggling} colorOn="#ef4444" />
          </div>

          {/* ── Slug / Menu Link ── */}
          {r.slug && (
            <div className="bg-[#0d0d20] rounded-xl px-3 py-2.5 border border-slate-700/40 flex items-center justify-between">
              <button
                onClick={() => window.open(`/menu/${r.slug}`, '_blank')}
                className="text-violet-400 text-xs font-mono hover:underline"
              >
                /menu/{r.slug}
              </button>
              <p className="text-slate-500 text-[10px]">رابط المنيو</p>
            </div>
          )}

          {/* ── Preview button ── */}
          <button
            onClick={() => window.open(`/api/super-admin/preview?rid=${encodeURIComponent(r.restaurant_id ?? r.id)}`, '_blank')}
            className="w-full py-3 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 font-bold text-sm hover:bg-indigo-600/30 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"/>
            </svg>
            معاينة داشبورد المطعم
          </button>

        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SuperAdminDashboard() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [authUsers,   setAuthUsers]   = useState<AuthUser[]>([]);
  const [orders,      setOrders]      = useState<Order[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [tab,         setTab]         = useState<'overview'|'restaurants'|'add'>('overview');
  const [toggling,    setToggling]    = useState<string|null>(null);

  // ── نموذج إضافة مطعم ──
  const [addName,    setAddName]    = useState('');
  const [addSlug,    setAddSlug]    = useState('');
  const [addPass,    setAddPass]    = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addResult,  setAddResult]  = useState<{ok: boolean; msg: string} | null>(null);

  const loadAll = useCallback(async () => {
    const today = todayISO();
    const [{ data: rs }, { data: or }, restsResp] = await Promise.all([
      supabase.from('restaurant_settings').select('*').order('updated_at', { ascending: false }),
      supabase.from('orders').select('*').gte('created_at', today+'T00:00:00').order('created_at', { ascending: false }).limit(300),
      fetch('/api/super-admin/restaurants').catch(() => null),
    ]);
    // جلب restaurants من الـ API (يستخدم service role — موثوق دائماً)
    let rests: {id: string; name: string; slug: string; owner_id: string}[] = [];
    if (restsResp?.ok) {
      const json = await restsResp.json().catch(() => ({}));
      rests = json.restaurants ?? [];
    }
    const slugMap     = new Map(rests.map(r => [r.id, r.slug]));
    const ownerMap    = new Map(rests.map(r => [r.id, r.owner_id]));
    const merged = (rs || []).map((r: Restaurant) => ({
      ...r,
      slug:     r.restaurant_id ? (slugMap.get(r.restaurant_id)  ?? null) : null,
      owner_id: r.restaurant_id ? (ownerMap.get(r.restaurant_id) ?? null) : null,
    }));
    setRestaurants(merged as Restaurant[]);
    setOrders((or || []) as Order[]);
    setLoading(false);
  }, []);

  const loadAuthUsers = useCallback(async () => {
    const res = await fetch('/api/super-admin/admin-users').catch(() => null);
    if (!res?.ok) return;
    const { users } = await res.json().catch(() => ({ users: [] }));
    setAuthUsers(users ?? []);
  }, []);

  useEffect(() => {
    loadAll();
    loadAuthUsers();
    const ch = supabase.channel('sa-live')
      .on('postgres_changes', { event:'*', schema:'public', table:'orders' }, loadAll)
      .on('postgres_changes', { event:'*', schema:'public', table:'restaurant_settings' }, loadAll)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [loadAll, loadAuthUsers]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const toggleSuspended = async (r: Restaurant) => {
    setToggling(r.id);
    const next = !r.is_suspended;
    await supabase.from('restaurant_settings')
      .update({ is_suspended: next, ...(next ? { is_closed: true } : {}) })
      .eq('id', r.id);
    await loadAll(); setToggling(null);
  };

  const signOut = async () => {
    await fetch('/api/super-admin/auth', { method: 'DELETE' });
    window.location.href = '/super-admin/login';
  };

  const addRestaurant = async () => {
    if (!addName.trim() || !addPass.trim()) return;
    setAddLoading(true); setAddResult(null);
    const slug = addSlug.trim() || autoSlug(addName.trim());
    const res = await fetch('/api/super-admin/restaurants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: addName.trim(), slug, password: addPass.trim() }),
    }).catch(() => null);
    const json = await res?.json().catch(() => ({}));
    if (res?.ok) {
      setAddResult({ ok: true, msg: `✓ تم إنشاء مطعم "${addName.trim()}" — اسم المستخدم: ${slug}` });
      setAddName(''); setAddSlug(''); setAddPass('');
      loadAll(); loadAuthUsers();
    } else {
      setAddResult({ ok: false, msg: json?.error || 'حدث خطأ' });
    }
    setAddLoading(false);
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const activeRest    = restaurants.filter(r => !r.is_suspended).length;
  const suspendedRest = restaurants.filter(r =>  r.is_suspended).length;
  const liveOrders    = orders.filter(o => !['completed','rejected'].includes(o.status));
  const todayRevenue  = orders.filter(o => o.status === 'completed').reduce((s,o) => s+o.total_amount, 0);
  const commission    = Math.round(todayRevenue * COMMISSION);

  if (loading) return (
    <div className="min-h-screen bg-[#09090f] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#09090f] text-white pb-28" dir="rtl">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#09090f]/90 border-b border-white/5 px-4 py-3.5">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-900/40">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-black text-white leading-none">Super Admin</p>
              <p className="text-[10px] text-slate-500 mt-0.5">لوحة التحكم العليا</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {liveOrders.length > 0 && (
              <div className="flex items-center gap-1.5 bg-violet-500/10 border border-violet-500/20 rounded-xl px-2.5 py-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                <span className="text-violet-300 text-xs font-bold">{liveOrders.length} حي</span>
              </div>
            )}
            <button onClick={loadAll} className="p-2 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 transition-all active:scale-90">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </button>
            <button onClick={signOut} className="px-3 py-1.5 rounded-xl text-xs text-red-400 border border-red-900/30 hover:bg-red-900/20 transition-all active:scale-90 font-medium">
              خروج
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">

        {/* ── Stats Grid ── */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="المطاعم"      value={restaurants.length} sub={`${activeRest} نشط · ${suspendedRest} موقوف`}                      icon="🏪" gradient="bg-gradient-to-br from-violet-900/60 to-indigo-900/40"  />
          <StatCard label="عمولة المنصة" value={`${commission.toLocaleString()} د.ع`} sub={`من ${todayRevenue.toLocaleString()} إجمالي`} icon="💰" gradient="bg-gradient-to-br from-green-900/60 to-emerald-900/40"  />
        </div>

        {/* ── Tabs ── */}
        <div className="grid grid-cols-3 bg-[#13132b] rounded-2xl p-1 gap-1 border border-white/5">
          {([
            { key: 'overview',    label: 'عام',      icon: '📊' },
            { key: 'restaurants', label: 'مطاعم',    icon: '🏪' },
            { key: 'add',         label: 'إضافة',    icon: '➕' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex flex-col items-center py-2.5 rounded-xl text-[11px] font-bold transition-all ${
                tab === t.key
                  ? 'bg-gradient-to-b from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-900/30'
                  : 'text-slate-500 hover:text-slate-300'
              }`}>
              <span className="text-base">{t.icon}</span>
              <span className="mt-0.5">{t.label}</span>
            </button>
          ))}
        </div>

        {/* ══ Tab: عام ══ */}
        {tab === 'overview' && (
          <div className="bg-[#13132b] rounded-2xl border border-white/5 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5">
              <p className="text-white text-sm font-bold">ملخص المطاعم</p>
            </div>
            {restaurants.length === 0 ? (
              <div className="py-10 text-center text-slate-600 text-sm">لا توجد مطاعم</div>
            ) : restaurants.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  {r.logo_url
                    ? <img src={r.logo_url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                    : <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center text-sm" style={{ backgroundColor: r.primary_color + '30' }}>🏪</div>
                  }
                  <p className="text-sm font-medium text-white truncate">{r.restaurant_name}</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${r.is_suspended ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                  {r.is_suspended ? 'موقوف' : 'نشط'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* ══ Tab: مطاعم ══ */}
        {tab === 'restaurants' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <p className="text-slate-400 text-xs">{restaurants.length} مطعم مسجل</p>
              <p className="text-slate-400 text-xs">{activeRest} نشط · {suspendedRest} موقوف</p>
            </div>
            {restaurants.length === 0 ? (
              <div className="bg-[#13132b] rounded-2xl p-10 text-center text-slate-600 border border-white/5">لا توجد مطاعم</div>
            ) : restaurants.map(r => {
              const matchedUser = authUsers.find(u => u.id === r.owner_id) ?? null;
              return (
                <RestaurantCard
                  key={r.id}
                  r={r}
                  toggling={toggling === r.id}
                  matchedUser={matchedUser}
                  onToggleSuspended={() => toggleSuspended(r)}
                  onRefresh={() => { loadAll(); loadAuthUsers(); }}
                />
              );
            })}
          </div>
        )}

        {/* ══ Tab: إضافة مطعم ══ */}
        {tab === 'add' && (
          <div className="bg-[#13132b] rounded-2xl border border-white/5 p-5 space-y-4">
            <p className="text-white font-black text-sm text-right">إضافة مطعم جديد</p>

            {/* اسم المطعم */}
            <div>
              <p className="text-slate-500 text-[11px] mb-1.5 text-right">اسم المطعم *</p>
              <input
                value={addName}
                onChange={e => { setAddName(e.target.value); if (!addSlug) setAddSlug(autoSlug(e.target.value)); }}
                placeholder="مثال: مطعم ميلانو"
                dir="rtl"
                className="w-full bg-[#0d0d20] border border-slate-700/50 rounded-xl px-4 py-3 text-slate-100 text-sm outline-none focus:border-violet-500/50 placeholder:text-slate-600"
              />
            </div>

            {/* الـ Slug */}
            <div>
              <p className="text-slate-500 text-[11px] mb-1.5 text-right">
                الـ Slug — <span className="text-amber-400">اكتبه بالإنجليزي *</span>
              </p>
              <div className={`flex items-center bg-[#0d0d20] border rounded-xl overflow-hidden focus-within:border-violet-500/50 ${!addSlug.trim() ? 'border-amber-500/60' : 'border-slate-700/50'}`}>
                <span className="px-3 text-slate-600 text-xs border-r border-slate-700/50 py-3 select-none">menu/</span>
                <input
                  value={addSlug}
                  onChange={e => setAddSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/\s+/g, '-'))}
                  placeholder="milano"
                  dir="ltr"
                  className="flex-1 bg-transparent px-3 py-3 text-violet-300 text-sm outline-none font-mono"
                />
              </div>
              {!addSlug.trim() && addName.trim() && (
                <p className="text-amber-400 text-[10px] mt-1 text-right">اكتب الـ slug بالإنجليزي مثل: milano</p>
              )}
            </div>

            {/* معلومة اسم المستخدم */}
            {addSlug.trim() && (
              <div className="bg-indigo-900/20 border border-indigo-700/30 rounded-xl px-4 py-3 text-right">
                <p className="text-indigo-400 text-[11px] mb-0.5">اسم المستخدم للدخول للداشبورد</p>
                <p className="text-white font-mono font-bold text-sm">{addSlug.trim()}</p>
              </div>
            )}

            {/* الباسورد */}
            <div>
              <p className="text-slate-500 text-[11px] mb-1.5 text-right">كلمة المرور *</p>
              <input
                value={addPass}
                onChange={e => setAddPass(e.target.value)}
                type="text"
                placeholder="كلمة مرور قوية"
                dir="ltr"
                className="w-full bg-[#0d0d20] border border-slate-700/50 rounded-xl px-4 py-3 text-slate-100 text-sm outline-none focus:border-violet-500/50 placeholder:text-slate-600 font-mono"
              />
            </div>

            {/* نتيجة */}
            {addResult && (
              <div className={`rounded-xl px-4 py-3 text-sm font-bold text-right ${addResult.ok ? 'bg-green-900/30 border border-green-700/40 text-green-400' : 'bg-red-900/30 border border-red-700/40 text-red-400'}`}>
                {addResult.msg}
              </div>
            )}

            <button
              onClick={addRestaurant}
              disabled={addLoading || !addName.trim() || !addSlug.trim() || !addPass.trim()}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-black text-sm transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {addLoading ? (
                <><span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> جاري الإنشاء...</>
              ) : '➕ إنشاء المطعم'}
            </button>
            <p className="text-slate-600 text-[10px] text-center">الـ slug يظهر في رابط المنيو: menu/<span className="text-violet-400">{addSlug || 'slug'}</span></p>
          </div>
        )}

      </div>
    </div>
  );
}
