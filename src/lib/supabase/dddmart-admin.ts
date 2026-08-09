// عميل service-role ثانٍ ومنفصل تماماً، يشير لمشروع dddmart (Supabase مختلف
// كلياً عن مشروع delivery-next الذي يخدمه admin.ts). يُستخدم حصراً من مسارات
// super-admin-dddmart لإنشاء/تعديل صفوف stores وحسابات Auth بمشروع dddmart —
// نفس حدود الثقة لـ admin.ts بالضبط: يُستورَد فقط من route handlers على
// السيرفر، لا يُستورَد إطلاقاً من مكوّنات client ('use client').
import { createClient } from '@supabase/supabase-js';
import type { DddmartDatabase } from './dddmart-types';

const dddmartSupabaseUrl        = process.env.DDDMART_SUPABASE_URL              ?? 'https://placeholder.supabase.co';
const dddmartSupabaseServiceKey = process.env.DDDMART_SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder-build-key';

export const dddmartAdmin = createClient<DddmartDatabase>(
  dddmartSupabaseUrl,
  dddmartSupabaseServiceKey,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
