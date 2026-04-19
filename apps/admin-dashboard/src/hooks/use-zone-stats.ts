import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type ZoneStats = {
  total: number
  today: number
  this_week: number
  this_month: number
  price_happy: number; price_neutral: number; price_sad: number
  design_happy: number; design_neutral: number; design_sad: number
  handling_happy: number; handling_neutral: number; handling_sad: number
  overall_happy: number; overall_neutral: number; overall_sad: number
}

export type TrendDay = { day: string; submissions: number }

export function useZoneStats(zoneId: string, from: string, to: string) {
  return useQuery({
    queryKey: ['zone-stats', zoneId, from, to],
    enabled: !!zoneId,
    queryFn: async (): Promise<ZoneStats> => {
      const { data, error } = await supabase
        .from('feedback_records')
        .select('rating_price, rating_design, rating_handling, rating_overall, created_at')
        .eq('zone_id', zoneId)
        .gte('created_at', from)
        .lte('created_at', to)

      if (error) throw error
      const rows = data ?? []

      const now = new Date()
      const todayStart  = new Date(now); todayStart.setHours(0,0,0,0)
      const weekStart   = new Date(now); weekStart.setDate(now.getDate()-6); weekStart.setHours(0,0,0,0)
      const monthStart  = new Date(now); monthStart.setDate(1); monthStart.setHours(0,0,0,0)

      const count = (field: keyof typeof rows[0], val: string) =>
        rows.filter(r => r[field] === val).length

      return {
        total:      rows.length,
        today:      rows.filter(r => new Date(r.created_at) >= todayStart).length,
        this_week:  rows.filter(r => new Date(r.created_at) >= weekStart).length,
        this_month: rows.filter(r => new Date(r.created_at) >= monthStart).length,
        price_happy:    count('rating_price',    'happy'),
        price_neutral:  count('rating_price',    'neutral'),
        price_sad:      count('rating_price',    'sad'),
        design_happy:   count('rating_design',   'happy'),
        design_neutral: count('rating_design',   'neutral'),
        design_sad:     count('rating_design',   'sad'),
        handling_happy:   count('rating_handling', 'happy'),
        handling_neutral: count('rating_handling', 'neutral'),
        handling_sad:     count('rating_handling', 'sad'),
        overall_happy:   count('rating_overall',  'happy'),
        overall_neutral: count('rating_overall',  'neutral'),
        overall_sad:     count('rating_overall',  'sad'),
      }
    },
  })
}

export function useZoneTrend(zoneId: string) {
  return useQuery({
    queryKey: ['zone-trend', zoneId],
    enabled: !!zoneId,
    queryFn: async (): Promise<TrendDay[]> => {
      const since = new Date()
      since.setDate(since.getDate() - 6)
      since.setHours(0, 0, 0, 0)

      const { data, error } = await supabase
        .from('feedback_records')
        .select('created_at')
        .eq('zone_id', zoneId)
        .gte('created_at', since.toISOString())

      if (error) throw error
      const rows = data ?? []

      // Group by day
      const map: Record<string, number> = {}
      rows.forEach(r => {
        const day = r.created_at.slice(0, 10)
        map[day] = (map[day] ?? 0) + 1
      })

      // Fill last 7 days
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        const key = d.toISOString().slice(0, 10)
        return { day: key, submissions: map[key] ?? 0 }
      })
    },
  })
}
