import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type TokenRow = {
  token_id: string
  status: 'active' | 'used' | 'expired' | 'revoked'
  created_at: string
  expires_at: string
  used_at: string | null
  revoked_at: string | null
  zone_id: string
  zones: { zone_name: string; zone_type: string } | null
}

export function useActiveTokens() {
  return useQuery({
    queryKey: ['tokens', 'active'],
    queryFn: async (): Promise<TokenRow[]> => {
      const { data, error } = await supabase
        .from('tokens')
        .select('*, zones(zone_name, zone_type)')
        .eq('status', 'active')
        .order('expires_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as TokenRow[]
    },
    refetchInterval: 30_000,
  })
}

export function useRevokeToken() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (tokenId: string) => {
      const now = new Date().toISOString()

      // 1. Get current user for audit log
      const { data: { user } } = await supabase.auth.getUser()

      // 2. Revoke token (guard: only revoke active tokens)
      const { error } = await supabase
        .from('tokens')
        .update({
          status:     'revoked',
          revoked_at: now,
          revoked_by: user?.id ?? null,
        })
        .eq('token_id', tokenId)
        .eq('status', 'active')
      if (error) throw error

      // 3. Write immutable audit log entry — specs §12 / agenta.md
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id:       user.id,
          action:        'revoke_token',
          resource_type: 'token',
          resource_id:   tokenId,
          context: {
            old_status: 'active',
            new_status: 'revoked',
            revoked_at: now,
          },
        })
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tokens'] }),
  })
}
