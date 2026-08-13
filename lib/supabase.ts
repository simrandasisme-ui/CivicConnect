import { createClient } from "@supabase/supabase-js";

// Fallback values prevent runtime crashes if .env.local is missing
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://twpznouwzuqwytqapfux.supabase.co";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_DYS-ReC85qG8sOZE-w5r9Q_luIV6g6-";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});