-- Impersonation audit log: super-admin logging in as a restaurant owner without password.
-- Idempotent: safe to re-run in Supabase SQL Editor. Applied manually, not automatically.

CREATE TABLE IF NOT EXISTS impersonation_log (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id           UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  restaurant_name         TEXT NOT NULL,
  target_owner_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_owner_email      TEXT NOT NULL,
  performed_by_label      TEXT NOT NULL DEFAULT 'super_admin',
  reason                  TEXT,
  ip_address              TEXT,
  user_agent              TEXT,
  session_started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  access_token_expires_at TIMESTAMPTZ,
  ended_at                TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_impersonation_log_restaurant ON impersonation_log(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_log_owner ON impersonation_log(target_owner_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_log_created_at ON impersonation_log(created_at DESC);

ALTER TABLE impersonation_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_all_impersonation_log" ON impersonation_log;
CREATE POLICY "deny_all_impersonation_log" ON impersonation_log FOR ALL USING (false);
