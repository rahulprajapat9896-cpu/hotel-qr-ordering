import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Null when env vars are not set — the app then runs on the built-in
// seed menu + browser-local orders so the UI is still fully demoable.
export const supabase = url && anon ? createClient(url, anon) : null;
export const isSupabaseConfigured = Boolean(supabase);
