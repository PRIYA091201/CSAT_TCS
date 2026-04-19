// ============================================================
// Edge Function: expire-tokens
// CSat / The Chennai Silks
//
// Triggered by: Supabase cron job every 5 minutes
// Auth required: NO — cron job, no JWT, no bearer token
// Uses service role key only. RLS does not apply.
//
// NEVER add JWT validation to this function.
// It runs without any user context.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (_req: Request) => {
  const startedAt = new Date().toISOString()

  try {
    const now = new Date().toISOString()

    // Expire all active tokens where TTL has elapsed
    const { data, error } = await supabase
      .from('tokens')
      .update({ status: 'expired' })
      .eq('status', 'active')
      .lt('expires_at', now)
      .select('token_id')

    if (error) {
      console.error('[expire-tokens] Update error:', error)
      return new Response(
        JSON.stringify({ success: false, error: error.message, started_at: startedAt }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const expiredCount = data?.length ?? 0

    console.log(`[expire-tokens] ${startedAt} — expired ${expiredCount} token(s)`)

    return new Response(
      JSON.stringify({ success: true, expired_count: expiredCount, started_at: startedAt }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (err) {
    console.error('[expire-tokens] Unexpected error:', err)
    return new Response(
      JSON.stringify({ success: false, error: 'Unexpected error', started_at: startedAt }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
