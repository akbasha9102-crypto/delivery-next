-- Super Admin: add restaurant management fields
ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS admin_email        TEXT,
  ADD COLUMN IF NOT EXISTS admin_password     TEXT,
  ADD COLUMN IF NOT EXISTS subscription_start TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_suspended       BOOLEAN     DEFAULT FALSE;
