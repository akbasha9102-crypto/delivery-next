import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gbmwrvnmvobvieembxmf.supabase.co';
const supabaseAnonKey = 'sb_publishable_DB8lKUjdnAah-jNbpFV22w_7Id2Eggr';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
