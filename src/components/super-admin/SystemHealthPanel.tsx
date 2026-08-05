'use client';
import { useEffect, useState, useCallback } from 'react';
import type { SystemHealthResponse } from '@/app/api/super-admin/system-health/route';

const POLL_INTERVAL_MS = 30000;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtUptime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}س ${m}د`;
}
function fmtMb(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function latencyDisplay(database: SystemHealthResponse['database']) {
  if (database.status === 'down') return { emoji: '🔴', text: 'غير متصل', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
  if (database.status === 'degraded') return { emoji: '🔴', text: 'بطيء', color: '#ef4444', bg: 'rgba(239,68,68,0.12)' };
  if (database.status === 'good') return { emoji: '🟡', text: `${database.latencyMs}ms - جيد`, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' };
  return { emoji: '🟢', text: `${database.latencyMs}ms - ممتاز`, color: '#22c55e', bg: 'rgba(34,197,94,0.12)' };
}

// ─── Health Card ──────────────────────────────────────────────────────────────
function HealthCard({ label, valueNode, sub, icon, color, bg }: {
  label: string; valueNode: React.ReactNode; sub?: string; icon: string; color: string; bg: string;
}) {
  return (
    <div className="rounded-2xl p-4 border border-white/5 relative overflow-hidden bg-[#13132b]">
      <div className="absolute inset-0" style={{ backgroundColor: bg }} />
      <div className="absolute top-3 left-3 text-2xl opacity-30">{icon}</div>
      <p className="relative text-white/60 text-xs font-medium mb-1">{label}</p>
      <p className="relative font-black text-lg leading-snug" style={{ color }}>{valueNode}</p>
      {sub && <p className="relative text-white/50 text-[11px] mt-1">{sub}</p>}
    </div>
  );
}

export function SystemHealthPanel() {
  const [data, setData] = useState<SystemHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/super-admin/system-health');
      if (!res.ok) throw new Error('request failed');
      const json: SystemHealthResponse = await res.json();
      setData(json);
      setError(null);
    } catch {
      setError('تعذّر جلب بيانات الأداء — تحقق من الاتصال بالسيرفر');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (error && !data) return (
    <div className="bg-[#13132b] rounded-2xl border border-white/5 py-10 px-4 text-center">
      <p className="text-red-400 text-sm font-bold">{error}</p>
    </div>
  );

  if (!data) return null;

  const lat = latencyDisplay(data.database);
  const connectionOk = data.database.connected;
  const realtimeOk = data.realtime.connected;

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center justify-between px-1">
        <p className="text-slate-400 text-xs">آخر تحديث: {new Date(data.timestamp).toLocaleTimeString('ar-EG')}</p>
        <button onClick={load} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-all active:scale-90">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <HealthCard
          label="زمن استجابة القاعدة"
          valueNode={`${lat.emoji} ${lat.text}`}
          icon="⚡"
          color={lat.color}
          bg={lat.bg}
        />
        <HealthCard
          label="الاتصال بقاعدة البيانات"
          valueNode={connectionOk ? '🟢 متصل بقاعدة البيانات' : '🔴 غير متصل'}
          icon="🗄️"
          color={connectionOk ? '#22c55e' : '#ef4444'}
          bg={connectionOk ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'}
        />
        <HealthCard
          label="حجم قاعدة البيانات"
          valueNode={data.storage.sizePretty}
          sub="حجم قاعدة البيانات"
          icon="💾"
          color="#8b5cf6"
          bg="rgba(139,92,246,0.12)"
        />
        <HealthCard
          label="الاتصال اللحظي (Realtime)"
          valueNode={realtimeOk ? '🟢 متصل' : '🔴 غير متصل'}
          sub={`${data.realtime.latencyMs}ms استجابة`}
          icon="📡"
          color={realtimeOk ? '#22c55e' : '#ef4444'}
          bg={realtimeOk ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'}
        />
      </div>

      {/* ── بطاقة السيرفر (عرض كامل، مدمجة) ── */}
      <div className="rounded-2xl p-4 border border-white/5 bg-[#0d0d20]">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">🖥️</span>
          <p className="text-white text-sm font-bold">حالة السيرفر</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-white/60 text-xs font-medium mb-1">مدة التشغيل</p>
            <p className="text-white font-black text-lg leading-none">{fmtUptime(data.server.uptimeSeconds)}</p>
          </div>
          <div>
            <p className="text-white/60 text-xs font-medium mb-1">الذاكرة المستخدمة (RSS)</p>
            <p className="text-white font-black text-lg leading-none">{fmtMb(data.server.memory.rssBytes)}</p>
          </div>
        </div>
        <p className="text-white/40 text-[11px] mt-2">منذ آخر إعادة تشغيل</p>
      </div>

      {error && (
        <p className="text-amber-400 text-[11px] px-1">تعذّر آخر تحديث — يعرض آخر بيانات معروفة</p>
      )}
    </div>
  );
}
