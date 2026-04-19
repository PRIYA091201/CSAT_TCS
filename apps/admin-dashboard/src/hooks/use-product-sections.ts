import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type ProductSection = {
  section_id: string
  display_name: string
  is_active: boolean
  sort_order: number
}

// Active sections only — used in dropdowns (zone form, kiosk form)
export function useProductSections() {
  return useQuery({
    queryKey: ['product_sections', 'active'],
    queryFn: async (): Promise<ProductSection[]> => {
      const { data, error } = await supabase
        .from('product_sections')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
      if (error) throw error
      return data ?? []
    },
  })
}

// All sections including inactive — used in admin management tab
export function useAllProductSections() {
  return useQuery({
    queryKey: ['product_sections', 'all'],
    queryFn: async (): Promise<ProductSection[]> => {
      const { data, error } = await supabase
        .from('product_sections')
        .select('*')
        .order('sort_order')
      if (error) throw error
      return data ?? []
    },
  })
}
