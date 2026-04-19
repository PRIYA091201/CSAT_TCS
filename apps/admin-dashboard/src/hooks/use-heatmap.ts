import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type HeatmapRow = {
  section_id: string
  display_name: string
  total: number
  price_happy_pct: number
  design_happy_pct: number
  handling_happy_pct: number
  overall_happy_pct: number
  price_unhappy: number; design_unhappy: number; handling_unhappy: number; overall_unhappy: number
}

export type TopConcern = {
  rank: number
  section: string
  sectionDisplay: string
  dimension: 'pricing' | 'design' | 'handling' | 'overall'
  happyPct: number
  unhappyPct: number
  count: number
  isHighestVolume: boolean
}

type RawRow = {
  product_section: string
  rating_price: string
  rating_design: string
  rating_handling: string
  rating_overall: string
  created_at: string
}

export function useHeatmap(from: string, to: string) {
  return useQuery({
    queryKey: ['heatmap', from, to],
    queryFn: async (): Promise<{ rows: HeatmapRow[]; concerns: TopConcern[] }> => {
      const [feedbackRes, sectionsRes] = await Promise.all([
        supabase
          .from('feedback_records')
          .select('product_section, rating_price, rating_design, rating_handling, rating_overall')
          .eq('branch_id', 'chennai-main')
          .gte('created_at', from)
          .lte('created_at', to),
        supabase
          .from('product_sections')
          .select('section_id, display_name, sort_order')
          .eq('is_active', true)
          .order('sort_order'),
      ])

      if (feedbackRes.error) throw feedbackRes.error
      if (sectionsRes.error) throw sectionsRes.error

      const rawRows = (feedbackRes.data ?? []) as RawRow[]
      const sections = sectionsRes.data ?? []

      // Group by section
      const bySection: Record<string, RawRow[]> = {}
      rawRows.forEach(r => {
        if (!bySection[r.product_section]) bySection[r.product_section] = []
        bySection[r.product_section].push(r)
      })

      const pct = (arr: RawRow[], field: keyof RawRow, val: string) =>
        arr.length > 0 ? Math.round(arr.filter(r => r[field] === val).length / arr.length * 100) : 0

      const rows: HeatmapRow[] = sections.map(s => {
        const sRows = bySection[s.section_id] ?? []
        return {
          section_id: s.section_id,
          display_name: s.display_name,
          total: sRows.length,
          price_happy_pct:    pct(sRows, 'rating_price',    'happy'),
          design_happy_pct:   pct(sRows, 'rating_design',   'happy'),
          handling_happy_pct: pct(sRows, 'rating_handling', 'happy'),
          overall_happy_pct:  pct(sRows, 'rating_overall',  'happy'),
          price_unhappy:    Math.round(sRows.filter(r => r.rating_price    === 'sad').length / Math.max(sRows.length,1) * 100),
          design_unhappy:   Math.round(sRows.filter(r => r.rating_design   === 'sad').length / Math.max(sRows.length,1) * 100),
          handling_unhappy: Math.round(sRows.filter(r => r.rating_handling === 'sad').length / Math.max(sRows.length,1) * 100),
          overall_unhappy:  Math.round(sRows.filter(r => r.rating_overall  === 'sad').length / Math.max(sRows.length,1) * 100),
        }
      })

      // Build top concerns
      type Combo = { section: string; display: string; dimension: TopConcern['dimension']; happyPct: number; unhappyPct: number; count: number }
      const combos: Combo[] = []
      rows.forEach(row => {
        ;(['pricing', 'design', 'handling', 'overall'] as const).forEach(dim => {
          const dimKey = dim === 'pricing' ? 'price' : dim
          const happyPct   = row[`${dimKey}_happy_pct` as keyof HeatmapRow] as number
          const unhappyPct = row[`${dimKey}_unhappy` as keyof HeatmapRow] as number
          combos.push({ section: row.section_id, display: row.display_name, dimension: dim, happyPct, unhappyPct, count: row.total })
        })
      })

      const maxVolume = Math.max(...combos.filter(c => c.happyPct < 40).map(c => c.count))
      const concerns: TopConcern[] = combos
        .filter(c => c.count >= 5)
        .sort((a, b) => a.happyPct - b.happyPct)
        .slice(0, 3)
        .map((c, i) => ({
          rank: i + 1,
          section: c.section,
          sectionDisplay: c.display,
          dimension: c.dimension,
          happyPct: c.happyPct,
          unhappyPct: c.unhappyPct,
          count: c.count,
          isHighestVolume: c.happyPct < 40 && c.count === maxVolume,
        }))

      return { rows, concerns }
    },
  })
}
