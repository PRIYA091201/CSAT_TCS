// ============================================================
// Supabase client helpers for Edge Functions (Deno runtime)
// Import inside any Edge Function:
//   import { getServiceClient, getCallerClient } from '../_shared/supabase.ts'
// ============================================================

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL            = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SUPABASE_ANON_KEY       = Deno.env.get('SUPABASE_ANON_KEY')!

/**
 * Service role client — bypasses RLS.
 * Use for all DB writes inside Edge Functions.
 * Never expose the service role key to the frontend.
 */
export function getServiceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

/**
 * Caller client — uses the request's Authorization header.
 * Use to verify the caller's JWT and read their role from app_metadata.
 */
export function getCallerClient(authHeader: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
}

/**
 * Verify the caller's JWT and return their role from app_metadata.
 * Returns null if the token is invalid or missing.
 */
export async function getCallerRole(
  authHeader: string | null
): Promise<{ userId: string; role: string } | null> {
  if (!authHeader) return null

  const client = getCallerClient(authHeader)
  const { data: { user }, error } = await client.auth.getUser()

  if (error || !user) return null

  const role = user.app_metadata?.role as string | undefined
  if (!role) return null

  return { userId: user.id, role }
}
