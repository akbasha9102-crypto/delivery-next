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
  max_discount_pct: number;
  max_void_amount: number;
};

export type VerifyPinSuccess = {
  staff_id: string;
  display_name: string;
  role: StaffRole;
  max_discount_pct: number;
  max_void_amount: number;
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

/* ─── إدارة الموظفين (مالك فقط) ─── */
export function listStaff(restaurantId: string) {
  return safeFetch<{ staff: StaffMember[] } | StaffMember[]>(`/api/staff?restaurant_id=${encodeURIComponent(restaurantId)}`);
}

export function createStaff(payload: {
  restaurant_id: string;
  display_name: string;
  role: StaffRole;
  pin: string;
  max_discount_pct: number;
  max_void_amount: number;
}) {
  return safeFetch<StaffMember>('/api/staff', { method: 'POST', body: JSON.stringify(payload) });
}

export function updateStaff(id: string, patch: Partial<{
  display_name: string;
  role: StaffRole;
  is_active: boolean;
  pin: string;
  max_discount_pct: number;
  max_void_amount: number;
}>) {
  return safeFetch<StaffMember>(`/api/staff/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

/* ─── الورديات ─── */
export function openShift(payload: { staff_id: string; opening_cash: number }) {
  return safeFetch<{ id: string; opened_at: string; opening_cash: number; status: 'open' }>('/api/shifts/open', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function closeShift(shiftId: string, actualClosingCash: number) {
  return safeFetch<{ expected_closing_cash: number; variance: number }>(`/api/shifts/${shiftId}/close`, {
    method: 'POST',
    body: JSON.stringify({ actual_closing_cash: actualClosingCash }),
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

export function listShifts(restaurantId: string, staffId?: string) {
  const qs = new URLSearchParams({ restaurant_id: restaurantId });
  if (staffId) qs.set('staff_id', staffId);
  return safeFetch<{ shifts: Shift[] } | Shift[]>(`/api/shifts?${qs.toString()}`);
}

/* ─── عمليات الطلب الحساسة ─── */
export function voidOrder(orderId: string, staffId: string, reason: string) {
  return safeFetch<{ ok: true }>(`/api/orders/${orderId}/void`, {
    method: 'POST',
    body: JSON.stringify({ staff_id: staffId, reason }),
  });
}

export function refundOrder(orderId: string, staffId: string, reason: string) {
  return safeFetch<{ ok: true }>(`/api/orders/${orderId}/refund`, {
    method: 'POST',
    body: JSON.stringify({ staff_id: staffId, reason }),
  });
}

export function discountOrder(orderId: string, staffId: string, discountPct: number) {
  return safeFetch<{ ok: true }>(`/api/orders/${orderId}/discount`, {
    method: 'POST',
    body: JSON.stringify({ staff_id: staffId, discount_pct: discountPct }),
  });
}

/* ─── الموافقات ─── */
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

export function listApprovals(restaurantId: string, status: 'pending' | 'approved' | 'rejected' = 'pending') {
  const qs = new URLSearchParams({ restaurant_id: restaurantId, status });
  return safeFetch<{ approvals: ApprovalRequest[] } | ApprovalRequest[]>(`/api/approvals?${qs.toString()}`);
}

export function resolveApproval(id: string, action: 'approve' | 'reject', resolvedBy: string) {
  return safeFetch<{ ok: true }>(`/api/approvals/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ action, resolved_by: resolvedBy }),
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

export function listInventoryForStaff(restaurantId: string, staffId?: string) {
  const qs = new URLSearchParams({ restaurant_id: restaurantId });
  if (staffId) qs.set('staff_id', staffId);
  return safeFetch<{ items: CashierInventoryItem[] } | CashierInventoryItem[]>(`/api/inventory/list?${qs.toString()}`);
}

/**
 * تسجيل هدر/تلف مخزون من واجهة الكاشير.
 * ⚠️ نقطة غير موجودة ضمن العقد الأصلي المتفق عليه — أضفناها هنا لأن الخطة (قسم 4) تُلزم
 * بتمكين الكاشير من تسجيل هدر المخزون باسمه، والعقد المُعطى لم يتضمن نقطة POST مخصّصة لذلك.
 * يجب على فريق الـ Backend تأكيدها أو استبدالها بما يناسب تصميمهم الفعلي لجدول stock_movements.
 * الشكل المقترح هنا: { restaurant_id, staff_id, item_id, quantity, reason } → يُنشئ صف
 * stock_movements(movement_type='WASTE', performed_by=staff_id).
 */
export function registerWaste(payload: { restaurant_id: string; staff_id: string; item_id: string; quantity: number; reason: string }) {
  return safeFetch<{ ok: true }>('/api/inventory/waste', { method: 'POST', body: JSON.stringify(payload) });
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
  created_at: string;
};
