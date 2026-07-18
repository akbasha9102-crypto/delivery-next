/**
 * نص تفصيلي واضح بالعربية لسجل واحد من staff_actions_log، حسب action_type.
 * يعتمد فقط على الحقول المخزَّنة فعلياً بالسجل (before_data/after_data/entity_id)
 * — بدون أي نداء إضافي للقاعدة. يستبدل describeChange المحلي السابق بـ
 * src/app/admin/audit/page.tsx (كان يغطي price_edit/item_deleted/
 * category_deleted/settings_changed فقط، ويترك بقية أنواع العمليات بلا وصف).
 *
 * راجع نقاط الكتابة الفعلية لمعرفة شكل before_data/after_data بكل نوع:
 *  - src/lib/utils/staff-actions-log.ts وكل استدعاءات logStaffAction() بـ
 *    src/app/api/{orders,shifts,inventory,approvals}/**
 *  - supabase/migrations/20260707185929_data_audit_log.sql (triggers قاعدة
 *    البيانات لـ price_edit/item_deleted/category_deleted/settings_changed)
 */
import type { StaffActionLog } from '@/lib/api/staffApi';
import { translateAuditField, AUDIT_FIELD_IGNORE } from '@/lib/constants/audit-translations';

type JsonRecord = Record<string, unknown>;
const asRecord = (v: unknown): JsonRecord | null => (v && typeof v === 'object' ? v as JsonRecord : null);

const money = (n: unknown): string => Number(n ?? 0).toLocaleString();
const orderRef = (entityId: string | null): string => (entityId ?? '').slice(0, 8);

// أنواع approval_requests.request_type — راجع src/app/api/orders/[id]/{void,refund,discount,apply-coupon}/route.ts
const REQUEST_TYPE_LABELS: Record<string, string> = {
  void_order: 'إلغاء طلب',
  refund: 'استرجاع مبلغ',
  discount_override: 'تجاوز حد الخصم',
  coupon_override: 'كوبون رجعي',
  price_override: 'تجاوز السعر',
};

export function describeAuditLog(l: StaffActionLog): string | null {
  const before = asRecord(l.before_data);
  const after = asRecord(l.after_data);

  switch (l.action_type) {
    case 'price_edit': {
      if (!before || !after) return null;
      return `غيّر سعر صنف ${after.name ?? before.name ?? ''} من ${money(before.price)} د.ع إلى ${money(after.price)} د.ع`;
    }

    case 'item_deleted':
      return before ? `حذف مادة ${before.name ?? ''} من المنيو` : null;

    case 'category_deleted':
      return before ? `حذف قسم ${before.name ?? ''} من المنيو` : null;

    case 'settings_changed': {
      if (!before || !after) return null;

      if (Boolean(before.coupon_enabled) !== Boolean(after.coupon_enabled)) {
        return after.coupon_enabled
          ? `فعّل كوبون الخصم ${after.coupon_code ?? ''} بنسبة ${after.coupon_discount_pct ?? 0}%`
          : `عطّل كوبون الخصم ${before.coupon_code ?? after.coupon_code ?? ''}`;
      }
      if (Boolean(before.is_closed) !== Boolean(after.is_closed)) {
        return after.is_closed ? 'أغلق المطعم مؤقتاً' : 'أعاد فتح المطعم';
      }
      if (Number(before.delivery_fee) !== Number(after.delivery_fee)) {
        return `غيّر رسوم التوصيل من ${money(before.delivery_fee)} د.ع إلى ${money(after.delivery_fee)} د.ع`;
      }
      if (Number(before.min_order_amount) !== Number(after.min_order_amount)) {
        return `غيّر الحد الأدنى للطلب من ${money(before.min_order_amount)} د.ع إلى ${money(after.min_order_amount)} د.ع`;
      }

      const changedKeys = Object.keys(after)
        .filter(k => !AUDIT_FIELD_IGNORE.has(k))
        .filter(k => JSON.stringify(after[k]) !== JSON.stringify(before[k]));
      if (changedKeys.length === 0) return null;
      return `تغيّر: ${changedKeys.map(translateAuditField).join('، ')}`;
    }

    case 'order_void': {
      if (!after) return null;
      const reason = after.reason ? ` — السبب: ${after.reason}` : '';
      return `ألغى الطلب #${orderRef(l.entity_id)} بقيمة ${money(after.amount)} د.ع${reason}`;
    }

    case 'order_refund': {
      if (!after) return null;
      const reason = after.reason ? ` — السبب: ${after.reason}` : '';
      return `استرجع مبلغ ${money(after.amount)} د.ع عن الطلب #${orderRef(l.entity_id)}${reason}`;
    }

    case 'discount_applied': {
      if (!after) return null;
      return `طبّق خصم ${after.discount_pct ?? ''}% على الطلب #${orderRef(l.entity_id)}`;
    }

    case 'coupon_applied': {
      if (!after) return null;
      return `طبّق كوبون ${after.coupon_code ?? ''} بخصم ${after.discount_pct ?? ''}% على الطلب #${orderRef(l.entity_id)}`;
    }

    case 'inventory_waste': {
      if (!after) return null;
      const reason = after.reason ? ` — السبب: ${after.reason}` : '';
      return `سجّل هدر ${money(after.quantity)} من مادة ${after.item_name ?? ''}${reason}`;
    }

    case 'shift_open':
      return after ? `فتح وردية برصيد افتتاحي ${money(after.opening_cash)} د.ع` : null;

    case 'shift_close': {
      if (!after) return null;
      const onBehalf = after.on_behalf_of_label ? ` (نيابة عن ${after.on_behalf_of_label})` : '';
      return `أغلق الوردية — المتوقع ${money(after.expected_closing_cash)} د.ع، الفعلي ${money(after.actual_closing_cash)} د.ع، الفرق ${money(after.variance)} د.ع${onBehalf}`;
    }

    // دورة حياة طلبات الموافقة — approval_requested يحمل تفاصيل الطلب الأصلي
    // بـ after_data (يختلف شكلها حسب request_type)، approved/rejected لا
    // يحملان سوى status، فالوصف هنا عام عمداً (لا بيانات إضافية بالسجل نفسه).
    case 'approval_requested': {
      if (!after) return null;
      const requestType = String(after.request_type ?? '');
      const label = REQUEST_TYPE_LABELS[requestType] ?? requestType;
      if (requestType === 'void_order' || requestType === 'refund') {
        const reason = after.reason ? ` — السبب: ${after.reason}` : '';
        return `طلب موافقة (${label}) بقيمة ${money(after.amount)} د.ع${reason}`;
      }
      if (requestType === 'discount_override') {
        return `طلب موافقة على خصم ${after.discount_pct ?? ''}% (تراكمي ${Number(after.cumulative_pct ?? 0).toFixed(1)}%)`;
      }
      if (requestType === 'coupon_override') {
        return `طلب موافقة على تطبيق كوبون ${after.coupon_code ?? ''} بخصم ${after.discount_pct ?? ''}%`;
      }
      return `طلب موافقة: ${label}`;
    }

    case 'approval_approved':
      return 'وافق المالك على طلب معلّق';

    case 'approval_rejected':
      return 'رفض المالك طلباً معلّقاً';

    default:
      return null;
  }
}
