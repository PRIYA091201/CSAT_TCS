import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type Zone = {
  zone_id: string
  zone_name: string
  zone_type: 'billing' | 'browse'
  branch_id: string
  product_section: string | null
  token_ttl_min: number
  is_active: boolean
  created_at: string
}

export type ZoneInsert = Omit<Zone, 'zone_id' | 'created_at'>

// Fetch all zones
export function useZones() {
  return useQuery({
    queryKey: ['zones'],
    queryFn: async (): Promise<Zone[]> => {
      const { data, error } = await supabase
        .from('zones')
        .select('*')
        .order('zone_type')
        .order('zone_name')
      if (error) throw error
      return data ?? []
    },
  })
}

// Fetch single zone
export function useZone(zoneId: string) {
  return useQuery({
    queryKey: ['zones', zoneId],
    queryFn: async (): Promise<Zone> => {
      const { data, error } = await supabase
        .from('zones')
        .select('*')
        .eq('zone_id', zoneId)
        .single()
      if (error) throw error
      return data
    },
  })
}

// Create zone
export function useCreateZone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (zone: ZoneInsert) => {
      const { data, error } = await supabase
        .from('zones')
        .insert(zone)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zones'] }),
  })
}

// Update zone
export function useUpdateZone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ zoneId, updates }: { zoneId: string; updates: Partial<ZoneInsert> }) => {
      const { data, error } = await supabase
        .from('zones')
        .update(updates)
        .eq('zone_id', zoneId)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, { zoneId }) => {
      qc.invalidateQueries({ queryKey: ['zones'] })
      qc.invalidateQueries({ queryKey: ['zones', zoneId] })
    },
  })
}
