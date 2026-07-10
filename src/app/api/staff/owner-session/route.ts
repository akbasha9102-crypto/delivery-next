import { NextRequest, NextResponse } from 'next/server';
import { verifyOwnerRequest, signStaffToken } from '@/lib/auth/staff-auth';

// POST /api/staff/owner-session — { restaurant_id } + Authorization: Bearer <supabase access_token>
// يصدر staff_token موقَّع لهوية "المالك" بعد التحقق الفعلي من أن الجلسة
// تخص owner_id هذا المطعم حقاً (نفس فحص src/app/api/admin/my-restaurant).
// بدون هذه النقطة، شاشة "من أنت؟" كانت تثق بضغطة زر "المالك" بالواجهة
// فقط دون أي تحقق خادمي — وهذا ما استغلته المراجعة الأمنية (C1/C2).
export async function POST(req: NextRequest) {
  let body: { restaurant_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'body غير صالح' }, { status: 400 });
  }

  const restaurantId = body.restaurant_id ?? '';
  const result = await verifyOwnerRequest(req, restaurantId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const staff_token = signStaffToken({ sid: null, rid: restaurantId, role: 'owner' });
  return NextResponse.json({ staff_token });
}
