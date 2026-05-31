import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

console.log('--- SUPABASE CLIENT INITIALIZATION ---');
console.log('Supabase URL:', supabaseUrl ? `Present (${supabaseUrl.substring(0, 16)}...)` : 'MISSING (Check Vercel Env Variables)');
console.log('Supabase Anon Key:', supabaseAnonKey ? 'Present' : 'MISSING (Check Vercel Env Variables)');

let _supabase: SupabaseClient;
try {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing URL or Anon Key');
  }
  _supabase = createClient(supabaseUrl, supabaseAnonKey);
} catch (err) {
  console.warn('Failed to create Supabase client, using fallback placeholder:', err);
  _supabase = createClient('https://placeholder.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder');
}

export const supabase = _supabase;
