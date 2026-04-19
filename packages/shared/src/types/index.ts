// ============================================================
// Shared types — CSat / The Chennai Silks
// All Zod schemas + inferred TypeScript types live here.
// Import in apps via: import { ... } from '@shared/types'
// ============================================================

import { z } from 'zod'

// ── Enums ─────────────────────────────────────────────────────

export const ZoneTypeSchema = z.enum(['billing', 'browse'])
export type ZoneType = z.infer<typeof ZoneTypeSchema>

export const TokenStatusSchema = z.enum(['active', 'used', 'expired', 'revoked'])
export type TokenStatus = z.infer<typeof TokenStatusSchema>

export const RatingSchema = z.enum(['happy', 'neutral', 'sad'])
export type Rating = z.infer<typeof RatingSchema>

export const GenderSchema = z.enum(['male', 'female', 'other', 'prefer_not_to_say'])
export type Gender = z.infer<typeof GenderSchema>

export const AgeGroupSchema = z.enum(['18-25', '26-35', '36-45', '46+'])
export type AgeGroup = z.infer<typeof AgeGroupSchema>

export const UserRoleSchema = z.enum(['kiosk', 'admin', 'md'])
export type UserRole = z.infer<typeof UserRoleSchema>

export const TokenErrorCodeSchema = z.enum(['expired', 'used', 'revoked', 'invalid'])
export type TokenErrorCode = z.infer<typeof TokenErrorCodeSchema>

// ── Edge Function I/O schemas ─────────────────────────────────

// mint-token
export const MintTokenInputSchema = z.object({
  zone_id: z.string().uuid(),
})
export type MintTokenInput = z.infer<typeof MintTokenInputSchema>

export const MintTokenOutputSchema = z.object({
  token_id:        z.string().uuid(),
  expires_at:      z.string().datetime(),
  zone_id:         z.string().uuid(),
  zone_type:       ZoneTypeSchema,
  product_section: z.string(),
})
export type MintTokenOutput = z.infer<typeof MintTokenOutputSchema>

// validate-token
export const ValidateTokenInputSchema = z.object({
  token_id: z.string().uuid(),
})
export type ValidateTokenInput = z.infer<typeof ValidateTokenInputSchema>

export const ValidateTokenOutputSchema = z.object({
  valid:           z.boolean(),
  zone_id:         z.string().uuid().optional(),
  zone_type:       ZoneTypeSchema.optional(),
  product_section: z.string().optional(),
  store_name:      z.string().optional(),
  error_code:      TokenErrorCodeSchema.optional(),
})
export type ValidateTokenOutput = z.infer<typeof ValidateTokenOutputSchema>

// submit-feedback
export const SubmitFeedbackInputSchema = z.object({
  token_id:        z.string().uuid(),
  gender:          GenderSchema.optional(),
  age_group:       AgeGroupSchema.optional(),
  rating_price:    RatingSchema,
  rating_design:   RatingSchema,
  rating_handling: RatingSchema,
  rating_overall:  RatingSchema,
})
export type SubmitFeedbackInput = z.infer<typeof SubmitFeedbackInputSchema>

export const SubmitFeedbackOutputSchema = z.object({
  success:    z.boolean(),
  error_code: z.string().optional(),
})
export type SubmitFeedbackOutput = z.infer<typeof SubmitFeedbackOutputSchema>

// provision-kiosk
export const ProvisionKioskInputSchema = z.object({
  kiosk_name: z.string().min(1).max(100),
  zone_id:    z.string().uuid(),
  branch_id:  z.string().min(1).default('chennai-main'),
})
export type ProvisionKioskInput = z.infer<typeof ProvisionKioskInputSchema>

export const ProvisionKioskOutputSchema = z.object({
  kiosk_id: z.string().uuid(),
  email:    z.string().email(),
  password: z.string(),
})
export type ProvisionKioskOutput = z.infer<typeof ProvisionKioskOutputSchema>

// ── Database row types ────────────────────────────────────────

export type Zone = {
  zone_id:         string
  zone_name:       string
  zone_type:       ZoneType
  branch_id:       string
  product_section: string | null
  token_ttl_min:   number
  is_active:       boolean
  created_at:      string
}

export type Kiosk = {
  kiosk_id:     string
  kiosk_name:   string
  zone_id:      string
  auth_user_id: string
  branch_id:    string
  is_active:    boolean
  last_seen_at: string | null
  created_at:   string
  created_by:   string
}

export type Token = {
  token_id:   string
  zone_id:    string
  status:     TokenStatus
  created_at: string
  expires_at: string
  used_at:    string | null
  revoked_at: string | null
  revoked_by: string | null
}

export type ProductSection = {
  section_id:   string
  display_name: string
  is_active:    boolean
  sort_order:   number
}

export type FeedbackRecord = {
  feedback_id:     string
  token_id:        string
  zone_id:         string
  branch_id:       string
  zone_type:       ZoneType
  gender:          Gender | null
  age_group:       AgeGroup | null
  product_section: string
  rating_price:    Rating
  rating_design:   Rating
  rating_handling: Rating
  rating_overall:  Rating
  status:          'submitted' | 'flagged'
  created_at:      string
}

export type AuditLog = {
  log_id:        string
  user_id:       string
  action:        string
  resource_type: string | null
  resource_id:   string | null
  context:       Record<string, unknown> | null
  created_at:    string
}
