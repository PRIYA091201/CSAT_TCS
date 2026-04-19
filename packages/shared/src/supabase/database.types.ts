// ============================================================
// Supabase database types — CSat / The Chennai Silks
//
// Generated type stub. Replace with output of:
//   supabase gen types typescript --local > packages/shared/src/supabase/database.types.ts
// after running migrations locally.
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      product_sections: {
        Row: {
          section_id:   string
          display_name: string
          is_active:    boolean
          sort_order:   number
        }
        Insert: {
          section_id:   string
          display_name: string
          is_active?:   boolean
          sort_order?:  number
        }
        Update: {
          display_name?: string
          is_active?:    boolean
          sort_order?:   number
        }
      }
      zones: {
        Row: {
          zone_id:         string
          zone_name:       string
          zone_type:       'billing' | 'browse'
          branch_id:       string
          product_section: string | null
          token_ttl_min:   number
          is_active:       boolean
          created_at:      string
        }
        Insert: {
          zone_id?:        string
          zone_name:       string
          zone_type:       'billing' | 'browse'
          branch_id?:      string
          product_section?: string | null
          token_ttl_min?:  number
          is_active?:      boolean
        }
        Update: {
          zone_name?:       string
          zone_type?:       'billing' | 'browse'
          product_section?: string | null
          token_ttl_min?:   number
          is_active?:       boolean
        }
      }
      kiosks: {
        Row: {
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
        Insert: {
          kiosk_id?:    string
          kiosk_name:   string
          zone_id:      string
          auth_user_id: string
          branch_id?:   string
          is_active?:   boolean
          created_by:   string
        }
        Update: {
          is_active?:    boolean
          last_seen_at?: string | null
        }
      }
      tokens: {
        Row: {
          token_id:   string
          zone_id:    string
          status:     'active' | 'used' | 'expired' | 'revoked'
          created_at: string
          expires_at: string
          used_at:    string | null
          revoked_at: string | null
          revoked_by: string | null
        }
        Insert: {
          token_id?:  string
          zone_id:    string
          status?:    'active' | 'used' | 'expired' | 'revoked'
          expires_at: string
        }
        Update: {
          status?:     'active' | 'used' | 'expired' | 'revoked'
          used_at?:    string | null
          revoked_at?: string | null
          revoked_by?: string | null
        }
      }
      feedback_records: {
        Row: {
          feedback_id:     string
          token_id:        string
          zone_id:         string
          branch_id:       string
          zone_type:       'billing' | 'browse'
          gender:          'male' | 'female' | 'other' | 'prefer_not_to_say' | null
          age_group:       '18-25' | '26-35' | '36-45' | '46+' | null
          product_section: string
          rating_price:    'happy' | 'neutral' | 'sad'
          rating_design:   'happy' | 'neutral' | 'sad'
          rating_handling: 'happy' | 'neutral' | 'sad'
          rating_overall:  'happy' | 'neutral' | 'sad'
          status:          'submitted' | 'flagged'
          created_at:      string
        }
        Insert: {
          feedback_id?:    string
          token_id:        string
          zone_id:         string
          branch_id?:      string
          zone_type:       'billing' | 'browse'
          gender?:         'male' | 'female' | 'other' | 'prefer_not_to_say' | null
          age_group?:      '18-25' | '26-35' | '36-45' | '46+' | null
          product_section: string
          rating_price:    'happy' | 'neutral' | 'sad'
          rating_design:   'happy' | 'neutral' | 'sad'
          rating_handling: 'happy' | 'neutral' | 'sad'
          rating_overall:  'happy' | 'neutral' | 'sad'
          status?:         'submitted' | 'flagged'
        }
        Update: {
          status?: 'submitted' | 'flagged'
        }
      }
      audit_logs: {
        Row: {
          log_id:        string
          user_id:       string
          action:        string
          resource_type: string | null
          resource_id:   string | null
          context:       Json | null
          created_at:    string
        }
        Insert: {
          log_id?:       string
          user_id:       string
          action:        string
          resource_type?: string | null
          resource_id?:  string | null
          context?:      Json | null
        }
        Update: never  // audit_logs are immutable
      }
    }
  }
}
