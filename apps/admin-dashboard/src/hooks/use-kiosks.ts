import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type Kiosk = {
  kiosk_id: string
  kiosk_name: string
  zone_id: string
  branch_id: string
  is_active: boolean
  last_seen_at: string | null
  created_at: string
  zones: { zone_name: string; zone_type: string; product_section: string | null } | null
}

export function useKiosks() {
  return useQuery({
    queryKey: ['kiosks'],
    queryFn: async (): Promise<Kiosk[]> => {
      const { data, error } = await supabase
        .from('kiosks')
        .select('*, zones(zone_name, zone_type, product_section)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Kiosk[]
    },
  })
}

export function useDeactivateKiosk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (kioskId: string) => {
      const { error } = await supabase
        .from('kiosks')
        .update({ is_active: false })
        .eq('kiosk_id', kioskId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kiosks'] }),
  })
}

export type ProvisionResult = {
  kiosk_id: string
  email: string
  password: string
}

export function useProvisionKiosk() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      kiosk_name: string
      zone_id: string
      branch_id: string
    }): Promise<ProvisionResult> => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not authenticated')

      const { data, error } = await supabase.functions.invoke('provision-kiosk', {
        body: input,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      if (error) throw error
      return data as ProvisionResult
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kiosks'] }),
  })
}
