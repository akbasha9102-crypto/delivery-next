import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/admin';
import os from 'node:os';

async function isAuthed() {
  const jar = await cookies();
  const token = jar.get('sa_session')?.value;
  return token === process.env.SUPER_ADMIN_SESSION_TOKEN;
}

export type SystemHealthResponse = {
  timestamp: string;
  database: {
    connected: boolean;
    latencyMs: number;
    status: 'excellent' | 'good' | 'degraded' | 'down';
  };
  storage: {
    sizeBytes: number;
    sizePretty: string;
    quotaBytes: number;
    quotaPretty: string;
    percentUsed: number;
    percentUsedPretty: string;
  };
  realtime: {
    status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED' | 'TIMEOUT';
    connected: boolean;
    latencyMs: number;
  };
  server: {
    uptimeSeconds: number;
    memory: {
      rssBytes: number;
      heapUsedBytes: number;
      heapTotalBytes: number;
      totalSystemBytes: number;
      totalSystemPretty: string;
      percentUsed: number;
      percentUsedPretty: string;
    };
  };
};

// تنسيق حجم بالبايت لصيغة مقروءة (بايت/كيلوبايت/ميجابايت/جيجابايت) — بلا أي
// مكتبة إضافية، دالة محلية بسيطة.
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// نسبة استخدام موحّدة (تُستخدم لكل من مساحة القاعدة وذاكرة السيرفر) — تُقرّب
// لأقرب عدد صحيح، مع استثناء: أي استهلاك أكبر من صفر يُقرَّب لصفر يُعرض
// كـ"<1%" بدل "0%" حتى لا يبدو الاستخدام الفعلي الضئيل وكأنه معدوم.
function formatPercentUsed(used: number, quota: number): { percentUsed: number; percentUsedPretty: string } {
  if (!Number.isFinite(used) || !Number.isFinite(quota) || quota <= 0 || used < 0) {
    return { percentUsed: 0, percentUsedPretty: '—' };
  }
  const raw = (used / quota) * 100;
  const rounded = Math.round(raw);
  if (rounded === 0 && raw > 0) {
    return { percentUsed: 0, percentUsedPretty: '<1%' };
  }
  return { percentUsed: Math.min(rounded, 100), percentUsedPretty: `${Math.min(rounded, 100)}%` };
}

async function checkDatabaseAndStorage(): Promise<{
  database: SystemHealthResponse['database'];
  storage: SystemHealthResponse['storage'];
}> {
  const quotaBytes = Number(process.env.SUPABASE_DB_QUOTA_BYTES) || 524_288_000; // احتياطي 500 MB (باقة Free) لو المتغير غير مضبوط
  try {
    const t0 = Date.now();
    const { data: dbSizeBytes, error: dbError } = await supabaseAdmin.rpc('get_database_size_bytes');
    const dbLatencyMs = Date.now() - t0;
    const dbConnected = !dbError && typeof dbSizeBytes === 'number';
    const dbStatus: SystemHealthResponse['database']['status'] =
      !dbConnected ? 'down' : dbLatencyMs < 100 ? 'excellent' : dbLatencyMs < 300 ? 'good' : 'degraded';

    const { percentUsed, percentUsedPretty } = dbConnected
      ? formatPercentUsed(dbSizeBytes, quotaBytes)
      : { percentUsed: 0, percentUsedPretty: '—' };

    return {
      database: { connected: dbConnected, latencyMs: dbLatencyMs, status: dbStatus },
      storage: {
        sizeBytes: dbConnected ? dbSizeBytes : 0,
        sizePretty: dbConnected ? formatBytes(dbSizeBytes) : '—',
        quotaBytes,
        quotaPretty: formatBytes(quotaBytes),
        percentUsed,
        percentUsedPretty,
      },
    };
  } catch {
    return {
      database: { connected: false, latencyMs: -1, status: 'down' },
      storage: { sizeBytes: 0, sizePretty: '—', quotaBytes: 0, quotaPretty: '—', percentUsed: 0, percentUsedPretty: '—' },
    };
  }
}

// فحص Realtime يعمل من جهة السيرفر لأن Next.js يزرع polyfill لـ
// globalThis.WebSocket عند إقلاع العملية (عبر next/dist/compiled/ws) — بدونه
// supabaseAdmin.channel(...) لا يعمل إطلاقاً على Node 20 الخام (لا يملك
// WebSocket أصلي).
async function checkRealtime(): Promise<SystemHealthResponse['realtime']> {
  const t0 = Date.now();
  const channel = supabaseAdmin.channel(`sa-health-${Date.now()}`);
  let status: string = 'TIMEOUT';
  try {
    status = await new Promise<string>((resolve) => {
      const timer = setTimeout(() => resolve('TIMEOUT'), 5000);
      channel.subscribe((s) => {
        if (['SUBSCRIBED', 'CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(s)) {
          clearTimeout(timer);
          resolve(s);
        }
      });
    });
  } finally {
    // يجب أن يبقى التنظيف هنا (finally) وليس بعد النجاح فقط — هذه عملية
    // PM2 fork-mode طويلة الأمد وليست serverless، فأي قناة متروكة تتراكم
    // عبر عمليات الفحص المتكررة (كل 30 ثانية) بدل هذا الضمان.
    try { await supabaseAdmin.removeChannel(channel); } catch { /* best-effort cleanup */ }
  }
  const latencyMs = Date.now() - t0;
  return { status: status as SystemHealthResponse['realtime']['status'], connected: status === 'SUBSCRIBED', latencyMs };
}

function checkServer(): SystemHealthResponse['server'] {
  try {
    const mem = process.memoryUsage();
    const totalSystemBytes = os.totalmem();
    const { percentUsed, percentUsedPretty } = formatPercentUsed(mem.rss, totalSystemBytes);
    return {
      uptimeSeconds: process.uptime(),
      memory: {
        rssBytes: mem.rss,
        heapUsedBytes: mem.heapUsed,
        heapTotalBytes: mem.heapTotal,
        totalSystemBytes,
        totalSystemPretty: formatBytes(totalSystemBytes),
        percentUsed,
        percentUsedPretty,
      },
    };
  } catch {
    return {
      uptimeSeconds: -1,
      memory: { rssBytes: 0, heapUsedBytes: 0, heapTotalBytes: 0, totalSystemBytes: 0, totalSystemPretty: '—', percentUsed: 0, percentUsedPretty: '—' },
    };
  }
}

export async function GET() {
  if (!await isAuthed()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // كل قسم معزول عن الآخر — فشل قسم واحد لا يجب أن يُسقط اللوحة كاملة
  // (500)، بل يُرجع قيماً افتراضية أسوأ حالة لذلك القسم فقط.
  let database: SystemHealthResponse['database'] = { connected: false, latencyMs: -1, status: 'down' };
  let storage: SystemHealthResponse['storage'] = { sizeBytes: 0, sizePretty: '—', quotaBytes: 0, quotaPretty: '—', percentUsed: 0, percentUsedPretty: '—' };
  try {
    const result = await checkDatabaseAndStorage();
    database = result.database;
    storage = result.storage;
  } catch { /* fallback القيم أعلاه محفوظة بالفعل */ }

  let realtime: SystemHealthResponse['realtime'] = { status: 'TIMEOUT', connected: false, latencyMs: -1 };
  try {
    realtime = await checkRealtime();
  } catch { /* fallback القيم أعلاه محفوظة بالفعل */ }

  let server: SystemHealthResponse['server'] = { uptimeSeconds: -1, memory: { rssBytes: 0, heapUsedBytes: 0, heapTotalBytes: 0, totalSystemBytes: 0, totalSystemPretty: '—', percentUsed: 0, percentUsedPretty: '—' } };
  try {
    server = checkServer();
  } catch { /* fallback القيم أعلاه محفوظة بالفعل */ }

  const body: SystemHealthResponse = {
    timestamp: new Date().toISOString(),
    database,
    storage,
    realtime,
    server,
  };

  return NextResponse.json(body);
}
