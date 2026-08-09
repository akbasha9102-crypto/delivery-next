// أنواع Database مصغّرة لمشروع dddmart (Supabase منفصل بالكامل عن مشروع
// delivery-next) — منسوخة يدوياً من dddmart/types/database.types.ts (جدولا
// stores و profiles فقط، وهما الوحيدان اللذان تلمسهما لوحة
// super-admin-dddmart هنا). لا تبعية حزمة (package) بين المشروعين، فهذه
// نسخة محلية مقصودة يجب تحديثها يدوياً إن تغيّر شكل الجدولين بمشروع dddmart.
export type DddmartUserRole = "admin" | "cashier";

export interface DddmartDatabase {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string;
          name: string;
          slug: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          role: DddmartUserRole;
          is_active: boolean;
          store_id: string;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          role?: DddmartUserRole;
          is_active?: boolean;
          store_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          role?: DddmartUserRole;
          is_active?: boolean;
          store_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
