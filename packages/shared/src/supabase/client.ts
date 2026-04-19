// ============================================================
// Supabase client factory — CSat / The Chennai Silks
// Import in apps via: import { supabase } from '@shared/supabase/client'
//
// Uses the anon key for all client-side calls.
// Edge Functions use the service role key internally (never exposed to client).
// ============================================================

import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnon) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables.'
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnon, {
  auth: {
    persistSession:    true,
    autoRefreshToken:  true,
    detectSessionInUrl: false,
  },
})
