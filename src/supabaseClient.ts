import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials are missing. Please check your .env file.');
}

let _supabase: SupabaseClient;
try {
  _supabase = createClient(supabaseUrl, supabaseAnonKey);
} catch (err) {
  console.error('Failed to create Supabase client:', err);
  // Create a dummy client so the app doesn't crash
  _supabase = createClient('https://placeholder.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder');
}

export const supabase = _supabase;
