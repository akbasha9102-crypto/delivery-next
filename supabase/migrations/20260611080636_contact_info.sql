-- Add whatsapp_number and location_url to restaurant_settings
ALTER TABLE restaurant_settings
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS location_url    TEXT DEFAULT NULL;
