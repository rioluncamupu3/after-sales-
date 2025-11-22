import { createClient } from '@supabase/supabase-js';

// Supabase configuration
// You'll need to replace these with your actual Supabase project credentials
// Get them from: https://app.supabase.com -> Your Project -> Settings -> API

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Validate Supabase URL format
const isValidSupabaseUrl = (url: string): boolean => {
  if (!url) return false;
  // Supabase URLs should contain .supabase.co
  return url.includes('.supabase.co') && url.startsWith('https://');
};

// Validate JWT token format (basic check)
const isValidJWT = (token: string): boolean => {
  if (!token) return false;
  // JWT tokens have 3 parts separated by dots
  const parts = token.split('.');
  return parts.length === 3 && token.startsWith('eyJ');
};

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not found. Using localStorage fallback.');
} else if (!isValidSupabaseUrl(supabaseUrl)) {
  console.error('Invalid Supabase URL format. Expected URL containing .supabase.co');
  console.error('Current URL:', supabaseUrl);
} else if (!isValidJWT(supabaseAnonKey)) {
  console.error('Invalid Supabase anon key format. Expected a JWT token.');
}

// Only create client if credentials are valid
const shouldUseSupabase = supabaseUrl && supabaseAnonKey && isValidSupabaseUrl(supabaseUrl) && isValidJWT(supabaseAnonKey);

export const supabase = shouldUseSupabase
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

// Check if Supabase is configured
export const isSupabaseConfigured = () => {
  if (!supabase) return false;
  // Additional check: verify URL is correct
  return isValidSupabaseUrl(supabaseUrl) && isValidJWT(supabaseAnonKey);
};

