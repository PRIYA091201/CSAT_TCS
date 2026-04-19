// ============================================================
// Edge Function: validate-token
// CSat / The Chennai Silks
//
// Triggered by: customer form load after QR scan
// Auth required: NO — anonymous public endpoint
//
// Always returns HTTP 200 for known token states.
// Frontend checks data.valid — not HTTP status.
// 4xx only for malformed input or server errors.
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const STORE_NAME = 'The Chennai Silks'

const InputSchema = z.object({
  token_id: z.string().uuid(),
})

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // ── 1. Parse and validate input ──────────────────────────
    const body = await req.json()
    const input = InputSchema.parse(body)

    // ── 2. Service role client (bypasses RLS for read) ───────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── 3. Fetch token + joined zone ─────────────────────────
    const { data: token, error } = await supabase
      .from('tokens')
      .select(`
        token_id,
        status,
        expires_at,
        zone_id,
        zones (
          zone_type,
          product_section,
          branch_id
        )
      `)
      .eq('token_id', input.token_id)
      .single()

    // Token not found at all
    if (error || !token) {
      return jsonOk({ valid: false, error_code: 'invalid' })
    }

    const zone = token.zones as {
      zone_type:       string
      product_section: string | null
      branch_id:       string
    } | null

    // ── 4. Check token state ─────────────────────────────────
    if (token.status === 'used') {
      return jsonOk({ valid: false, error_code: 'used' })
    }

    if (token.status === 'revoked') {
      return jsonOk({ valid: false, error_code: 'revoked' })
    }

    if (token.status === 'expired') {
      return jsonOk({ valid: false, error_code: 'expired' })
    }

    // Double-check expiry by wall clock (cron may not have run yet)
    if (new Date(token.expires_at) < new Date()) {
      return jsonOk({ valid: false, error_code: 'expired' })
    }

    // ── 5. Token is valid — return zone info ─────────────────
    return jsonOk({
      valid:           true,
      zone_id:         token.zone_id,
      zone_type:       zone?.zone_type ?? null,
      product_section: zone?.product_section ?? null,
      store_name:      STORE_NAME,
    })

  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, 'invalid_input', 'token_id must be a valid UUID')
    }
    console.error('[validate-token] Unexpected error:', err)
    return jsonError(500, 'server_error', 'An unexpected error occurred')
  }
})

// ── Helpers ───────────────────────────────────────────────────

function jsonOk(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}
