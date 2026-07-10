/**
 * طبقة نداء واجهات نظام RBAC (الموظفين/الورديات/الموافقات) — عقد الـ API المتفق عليه مع فريق الـ Backend.
 *
 * ملاحظة مهمة: هذه النقاط تُبنى بالتوازي من فريق آخر في نفس اللحظة، لذلك:
 * - لا تفترض أنها موجودة فعلياً أثناء التطوير — أي استدعاء قد يرجع 404 قبل الدمج.
 * - كل الدوال هنا تتعامل مع الفشل بلطف (لا تُسقط الواجهة) وتُرجع نتيجة موحّدة.
 * - المسارات والـ payloads مطابقة تماماً لما هو متفق عليه في خطة RBAC.
 */

export type StaffRole = 'owner' | 'manager' | 'cashier';

export type StaffMember = {
  id: string;
  restaurant_id: string;
  display_name: string;
  role: StaffRole;
  is_active: boolean;
  code: string | null;
  max_discount_pct: number;
  max_void_amount: number;
};

export type VerifyPinSuccess = {
  staff_id: string;
  display_name: string;
  role: StaffRole;
  max_discount_pct: number;
  max_void_amount: number;
  staff_token: string;
};

export type ApiResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; pending?: false }
  | { ok: false; status: 202; pending: true; approval_id: string };

/** يستخرج رسالة الخطأ من أي نتيجة فاشلة (غير 202-pending) بأمان دون الحاجة لـ `any`. */
export function errorMessage(res: ApiResult<unknown>, fallback = 'حدث خطأ غير متوقع'): string {
  if (res.ok) return fallback;
  if ('pending' in res && res.pending) return 'بانتظار الموافقة';
  return ('error' in res && res.error) || fallback;
}

type AuthOpts = { staffToken?: string; accessToken?: string };

/**
 * ملاحظة أمن (بعد مراجعة أمنية): لم تعد أي دالة هنا ترسل staff_id/الدور
 * بجسم الطلب لتحديد الهوية — الخادم يستخرج الهوية حصراً من x-staff-token
 * (موقَّع HMAC، راجع src/lib/staff-auth.ts) أو من Authorization Bearer
 * الحقيقي لجلسة Supabase (للنقاط "مالك فقط" التي تتحقق من owner_id).
 */
function authHeaders(opts?: AuthOpts): Record<string, string> {
  const headers: Record<string, string> = {};
  if (opts?.staffToken) headers['x-staff-token'] = opts.staffToken;
  if (opts?.accessToken) headers['Authorization'] = `Bearer ${opts.accessToken}`;
  return headers;
}

async function safeFetch<T>(input: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    const res = await fetch(input, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
    const status = res.status;
    let body: Record<string, unknown> | null = null;
    try { body = await res.json(); } catch { /* لا محتوى JSON */ }

    if (status === 202 && body?.pending) {
      return { ok: false, status: 202, pending: true, approval_id: body.approval_id as string };
    }
    if (!res.ok) {
      return { ok: false, status, error: (body?.error as string) || (body?.message as string) || `فشل الطلب (${status})` };
    }
    return { ok: true, status, data: (body ?? {}) as T };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'تعذّر الاتصال بالخادم';
    return { ok: false, status: 0, error: message };
  }
}

/* ─── PIN / هوية الموظف ─── */
export function verifyPin(restaurantId: string, pin: string) {
  return safeFetch<VerifyPinSuccess>('/api/staff/verify-pin', {
    method: 'POST',
    body: JSON.stringify({ restaurant_id: restaurantId, pin }),
  });
}

/* ─── إدارة الموظفين (مالك فقط — يتطلب Authorization Bearer لجلسة Supabase الحقيقية) ─── */
export function listStaff(restaurantId: string, accessToken?: string) {
  return safeFetch<{ staff: StaffMember[] } | StaffMember[]>(
    `/api/staff?restaurant_id=${encodeURIComponent(restaurantId)}`,
    { headers: authHeaders({ accessToken }) }
  );
}

export function createStaff(payload: {
  restaurant_id: string;
  display_name: string;
  role: StaffRole;
  password: string;
  code?: string;
  max_discount_pct: number;
  max_void_amount: number;
}, accessToken?: string) {
  return safeFetch<StaffMember>('/api/staff', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: authHeaders({ accessToken }),
  });
}

export function updateStaff(id: string, patch: Partial<{
  display_name: string;
  role: StaffRole;
  is_active: boolean;
  password: string;
  max_discount_pct: number;
  max_void_amount: number;
}>, accessToken?: string) {
  return safeFetch<StaffMember>(`/api/staff/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
    headers: authHeaders({ accessToken }),
  });
}

/** يصدر staff_token موقَّع لهوية "المالك" بعد تحقق خادمي فعلي من الجلسة (يسدّ ثغرة C1/C2). */
export function getOwnerSession(restaurantId: string, accessToken: string) {
  return safeFetch<{ staff_token: string }>('/api/staff/owner-session', {
    method: 'POST',
    body: JSON.stringify({ restaurant_id: restaurantId }),
    headers: authHeaders({ accessToken }),
  });
}

export type MyStaffContext = {
  staff_id: string;
  restaurant_id: string;
  display_name: string;
  role: StaffRole;
  max_discount_pct: number;
  max_void_amount: number;
  staff_token: string;
};

/**
 * يتحقق هل الجلسة الحالية (Supabase Auth) تخص موظفاً دخل مباشرة بكود+كلمة
 * مرور من /login (حساب Auth مستقل تماماً)، بدل جلسة المالك المشتركة.
 * 404 يعني: هذه جلسة المالك نفسه، وليست موظفاً.
 */
export function getMyStaffContext(accessToken: string) {
  return safeFetch<MyStaffContext>('/api/staff/my-context', {
    headers: authHeaders({ accessToken }),
  });
}

/* ─── الورديات (تتطلب x-staff-token) ─── */
export function openShift(payload: { opening_cash: number }, staffToken: string) {
  return safeFetch<{ id: string; opened_at: string; opening_cash: number; status: 'open' }>('/api/shifts/open', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: authHeaders({ staffToken }),
  });
}

export function closeShift(shiftId: string, actualClosingCash: number, staffToken: string) {
  return safeFetch<{ expected_closing_cash: number; variance: number }>(`/api/shifts/${shiftId}/close`, {
    method: 'POST',
    body: JSON.stringify({ actual_closing_cash: actualClosingCash }),
    headers: authHeaders({ staffToken }),
  });
}

export type Shift = {
  id: string;
  restaurant_id: string;
  staff_id: string;
  opening_cash: number;
  expected_closing_cash: number | null;
  actual_closing_cash: number | null;
  variance: number | null;
  opened_at: string;
  closed_at: string | null;
  status: 'open' | 'closed';
};

export function listShifts(restaurantId: string, staffToken: string) {
  const qs = new URLSearchParams({ restaurant_id: restaurantId });
  return safeFetch<{ shifts: Shift[] } | Shift[]>(`/api/shifts?${qs.toString()}`, {
    headers: authHeaders({ staffToken }),
  });
}

/* ─── عمليات الطلب الحساسة (تتطلب x-staff-token — الهوية تُستخرَج منه حصراً) ─── */
export function voidOrder(orderId: string, reason: string, staffToken: string) {
  return safeFetch<{ ok: true }>(`/api/orders/${orderId}/void`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
    headers: authHeaders({ staffToken }),
  });
}

export function refundOrder(orderId: string, reason: string, staffToken: string) {
  return safeFetch<{ ok: true }>(`/api/orders/${orderId}/refund`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
    headers: authHeaders({ staffToken }),
  });
}

export function discountOrder(orderId: string, discountPct: number, staffToken: string) {
  return safeFetch<{ ok: true }>(`/api/orders/${orderId}/discount`, {
    method: 'POST',
    body: JSON.stringify({ discount_pct: discountPct }),
    headers: authHeaders({ staffToken }),
  });
}

/* ─── الموافقات (مالك فقط — Authorization Bearer) ─── */
export type ApprovalRequest = {
  id: string;
  restaurant_id: string;
  requested_by: string;
  request_type: 'void_order' | 'refund' | 'discount_override' | 'price_override';
  order_id: string | null;
  amount: number | null;
  reason: string | null;
  status: 'pending' | 'approved' | 'rejected';
  resolved_by: string | null;
  created_at: string;
  resolved_at: string | null;
};

export function listApprovals(restaurantId: string, status: 'pending' | 'approved' | 'rejected' = 'pending', accessToken?: string) {
  const qs = new URLSearchParams({ restaurant_id: restaurantId, status });
  return safeFetch<{ approvals: ApprovalRequest[] } | ApprovalRequest[]>(`/api/approvals?${qs.toString()}`, {
    headers: authHeaders({ accessToken }),
  });
}

export function resolveApproval(id: string, action: 'approve' | 'reject', accessToken: string) {
  return safeFetch<{ ok: true }>(`/api/approvals/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ action }),
    headers: authHeaders({ accessToken }),
  });
}

/* ─── المخزون (نسخة الكاشير — بدون تكلفة/مورّد) ─── */
export type CashierInventoryItem = {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  min_alert_stock: number;
};

export function listInventoryForStaff(restaurantId: string, staffToken?: string) {
  const qs = new URLSearchParams({ restaurant_id: restaurantId });
  return safeFetch<{ items: CashierInventoryItem[] } | CashierInventoryItem[]>(`/api/inventory/list?${qs.toString()}`, {
    headers: authHeaders({ staffToken }),
  });
}

/** تسجيل هدر/تلف مخزون من واجهة الكاشير — الهوية عبر x-staff-token. */
export function registerWaste(payload: { item_id: string; quantity: number; reason: string }, staffToken: string) {
  return safeFetch<{ ok: true }>('/api/inventory/waste', {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: authHeaders({ staffToken }),
  });
}

/* ─── سجل التدقيق (عرض فقط — مالك) ─── */
export type StaffActionLog = {
  id: string;
  restaurant_id: string;
  staff_id: string | null;
  action_type: string;
  entity_type: string | null;
  entity_id: string | null;
  before_data: unknown;
  after_data: unknown;
  performed_by_auth_id: string | null;
  performed_by_label: string | null;
  created_at: string;
};
