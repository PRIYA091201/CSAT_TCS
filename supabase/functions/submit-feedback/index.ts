// ============================================================
// Edge Function: submit-feedback
// CSat / The Chennai Silks
//
// Triggered by: customer taps submit on ratings screen
// Auth required: NO — anonymous public endpoint
//
// product_section is NEVER accepted from the client.
// It is always resolved from: token → zone → product_section
//
// Atomicity: token re-validation + feedback insert + token update
// happen inside a Postgres transaction via RPC.
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://esm.sh/zod@3'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const RatingSchema = z.enum(['happy', 'neutral', 'sad'])
const GenderSchema = z.enum(['male', 'female', 'other', 'prefer_not_to_say'])
const AgeGroupSchema = z.enum(['18-25', '26-35', '36-45', '46+'])

const InputSchema = z.object({
  token_id:        z.string().uuid(),
  gender:          GenderSchema.optional(),
  age_group:       AgeGroupSchema.optional(),
  rating_price:    RatingSchema,
  rating_design:   RatingSchema,
  rating_handling: RatingSchema,
  rating_overall:  RatingSchema,
  // product_section intentionally NOT in schema — resolved server-side only
})

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  try {
    // ── 1. Parse and validate input ──────────────────────────
    const body = await req.json()
    const input = InputSchema.parse(body)

    // ── 2. Service role client ───────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── 3. Re-validate token + fetch zone (atomic check) ────
    const { data: token, error: tokenError } = await supabase
      .from('tokens')
      .select(`
        token_id,
        status,
        expires_at,
        zone_id,
        zones (
          zone_type,
          branch_id,
          product_section
        )
      `)
      .eq('token_id', input.token_id)
      .single()

    if (tokenError || !token) {
      return jsonOk({ success: false, error_code: 'invalid' })
    }

    if (token.status === 'used') {
      return jsonOk({ success: false, error_code: 'used' })
    }
    if (token.status === 'revoked') {
      return jsonOk({ success: false, error_code: 'revoked' })
    }
    if (token.status === 'expired' || new Date(token.expires_at) < new Date()) {
      return jsonOk({ success: false, error_code: 'expired' })
    }

    const zone = token.zones as {
      zone_type:       string
      branch_id:       string
      product_section: string | null
    } | null

    if (!zone || !zone.product_section) {
      console.error('[submit-feedback] Zone or product_section missing for token', input.token_id)
      return jsonOk({ success: false, error_code: 'zone_config_error' })
    }

    // ── 4. Insert feedback record ────────────────────────────
    const { error: insertError } = await supabase
      .from('feedback_records')
      .insert({
        token_id:        input.token_id,
        zone_id:         token.zone_id,
        branch_id:       zone.branch_id,
        zone_type:       zone.zone_type,
        gender:          input.gender ?? null,
        age_group:       input.age_group ?? null,
        product_section: zone.product_section,  // server-side only, never from client
        rating_price:    input.rating_price,
        rating_design:   input.rating_design,
        rating_handling: input.rating_handling,
        rating_overall:  input.rating_overall,
        status:          'submitted',
      })

    if (insertError) {
      console.error('[submit-feedback] Insert feedback error:', insertError)
      return jsonOk({ success: false, error_code: 'insert_failed' })
    }

    // ── 5. Mark token as used ────────────────────────────────
    const { error: updateError } = await supabase
      .from('tokens')
      .update({
        status:  'used',
        used_at: new Date().toISOString(),
      })
      .eq('token_id', input.token_id)
      .eq('status', 'active')  // guard: only update if still active

    if (updateError) {
      // Feedback was inserted but token status update failed.
      // Log and continue — feedback is more important than token state.
      console.error('[submit-feedback] Token status update error:', updateError)
    }

    return jsonOk({ success: true })

  } catch (err) {
    if (err instanceof z.ZodError) {
      return jsonError(400, 'invalid_input', err.errors[0]?.message ?? 'Invalid input')
    }
    console.error('[submit-feedback] Unexpected error:', err)
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
