import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type ResponseRate = {
  tokensMinted: number
  tokensUsed: number
  ratePct: number
}

export function useZoneResponseRate(zoneId: string, from: string, to: string) {
  return useQuery({
    queryKey: ['response-rate', 'zone', zoneId, from, to],
    enabled: !!zoneId,
    queryFn: async (): Promise<ResponseRate> => {
      const { data, error } = await supabase
        .from('tokens')
        .select('status')
        .eq('zone_id', zoneId)
        .gte('created_at', from)
        .lte('created_at', to)

      if (error) throw error
      const rows = data ?? []
      const minted = rows.length
      const used   = rows.filter(r => r.status === 'used').length
      return {
        tokensMinted: minted,
        tokensUsed:   used,
        ratePct:      minted > 0 ? Math.round((used / minted) * 100) : 0,
      }
    },
  })
}

export function useBranchResponseRate(from: string, to: string) {
  return useQuery({
    queryKey: ['response-rate', 'branch', from, to],
    queryFn: async (): Promise<ResponseRate> => {
      const { data, error } = await supabase
        .from('tokens')
        .select('status, zones!inner(branch_id)')
        .gte('created_at', from)
        .lte('created_at', to)

      if (error) throw error
      const rows = data ?? []
      const minted = rows.length
      const used   = rows.filter(r => r.status === 'used').length
      return {
        tokensMinted: minted,
        tokensUsed:   used,
        ratePct:      minted > 0 ? Math.round((used / minted) * 100) : 0,
      }
    },
  })
}
