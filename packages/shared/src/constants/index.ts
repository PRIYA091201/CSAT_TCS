// ============================================================
// Shared constants — CSat / The Chennai Silks
// Import in apps via: import { ... } from '@shared/constants'
// ============================================================

export const STORE_NAME = 'The Chennai Silks'
export const DEFAULT_BRANCH_ID = 'chennai-main'

// Token TTLs — these come from zone config at runtime.
// These constants are DEFAULTS only, used for fallback/display.
// Never hardcode TTLs in business logic — always read from zone config.
export const BILLING_TOKEN_TTL_MIN = 30
export const BROWSE_TOKEN_TTL_MIN  = 10
export const KIOSK_QR_DISPLAY_SEC  = 30   // How long kiosk shows QR before resetting

// Customer form polling interval (mid-form expiry detection)
export const TOKEN_POLL_INTERVAL_MS = 60_000  // 60 seconds

// Offline connectivity poll interval
export const OFFLINE_POLL_INTERVAL_MS = 10_000  // 10 seconds

// Kiosk expired state display pause before returning to idle
export const KIOSK_EXPIRED_PAUSE_MS = 1_500

// Product section slugs — must match seed.sql and product_sections table
export const PRODUCT_SECTION_IDS = [
  'sarees',
  'shirts',
  'trousers',
  'kids_wear',
  'accessories',
  'fabrics',
] as const
export type ProductSectionId = typeof PRODUCT_SECTION_IDS[number]

// Rating values
export const RATING_VALUES = ['happy', 'neutral', 'sad'] as const

// Feedback dimensions
export const FEEDBACK_DIMENSIONS = ['price', 'design', 'handling', 'overall'] as const
export type FeedbackDimension = typeof FEEDBACK_DIMENSIONS[number]

// Heatmap colour thresholds (happy %)
export const HEATMAP_GREEN_THRESHOLD  = 60  // >= 60% happy = green
export const HEATMAP_AMBER_THRESHOLD  = 40  // >= 40% happy = amber, < 40 = red

// User roles
export const USER_ROLES = {
  KIOSK: 'kiosk',
  ADMIN: 'admin',
  MD:    'md',
} as const

// Audit log action names
export const AUDIT_ACTIONS = {
  REVOKE_TOKEN:     'revoke_token',
  CREATE_ZONE:      'create_zone',
  UPDATE_ZONE:      'update_zone',
  PROVISION_KIOSK:  'provision_kiosk',
  DEACTIVATE_KIOSK: 'deactivate_kiosk',
  EXPORT_CSV:       'export_csv',
  ENABLE_2FA:       'enable_2fa',
  DISABLE_2FA:      'disable_2fa',
} as const
