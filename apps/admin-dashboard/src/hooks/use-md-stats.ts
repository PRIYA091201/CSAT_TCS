import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export type OverviewStats = {
  total: number
  happinessRatioPct: number
  tokensUsed: number
  tokensMinted: number
  topConcernDimension: string
  topConcernUnhappyPct: number
  priceHappy: number; priceNeutral: number; priceSad: number
  designHappy: number; designNeutral: number; designSad: number
  handlingHappy: number; handlingNeutral: number; handlingSad: number
  overallHappy: number; overallNeutral: number; overallSad: number
  billingTotal: number; billingHappy: number; billingNeutral: number; billingSad: number
  browseTotal: number; browseHappy: number; browseNeutral: number; browseSad: number
}

export type TrendPoint = { day: string; submissions: number; happinessPct: number }

function countField<T extends Record<string, unknown>>(rows: T[], field: keyof T, val: string) {
  return rows.filter(r => r[field] === val).length
}

export function useMdOverview(from: string, to: string) {
  return useQuery({
    queryKey: ['md-overview', from, to],
    queryFn: async (): Promise<OverviewStats> => {
      const { data, error } = await supabase
        .from('feedback_records')
        .select('rating_price, rating_design, rating_handling, rating_overall, zone_type, created_at')
        .eq('branch_id', 'chennai-main')
        .gte('created_at', from)
        .lte('created_at', to)
      if (error) throw error
      const rows = data ?? []

      const ph = countField(rows, 'rating_price',    'happy')
      const dh = countField(rows, 'rating_design',   'happy')
      const hh = countField(rows, 'rating_handling', 'happy')
      const oh = countField(rows, 'rating_overall',  'happy')
      const total = rows.length

      // Top concern = lowest happy %
      const dims = [
        { key: 'pricing',  happy: ph, unhappy: countField(rows, 'rating_price',    'sad') },
        { key: 'design',   happy: dh, unhappy: countField(rows, 'rating_design',   'sad') },
        { key: 'handling', happy: hh, unhappy: countField(rows, 'rating_handling', 'sad') },
        { key: 'overall',  happy: oh, unhappy: countField(rows, 'rating_overall',  'sad') },
      ]
      const worst = dims.sort((a, b) => a.happy - b.happy)[0]

      const billing = rows.filter(r => r.zone_type === 'billing')
      const browse  = rows.filter(r => r.zone_type === 'browse')

      return {
        total,
        happinessRatioPct: total > 0 ? Math.round((ph + dh + hh + oh) / (total * 4) * 100) : 0,
        tokensUsed: 0, // fetched separately
        tokensMinted: 0,
        topConcernDimension: worst?.key ?? '—',
        topConcernUnhappyPct: total > 0 ? Math.round((worst?.unhappy ?? 0) / total * 100) : 0,
        priceHappy:    ph, priceNeutral: countField(rows,'rating_price','neutral'), priceSad:    countField(rows,'rating_price','sad'),
        designHappy:   dh, designNeutral: countField(rows,'rating_design','neutral'), designSad:   countField(rows,'rating_design','sad'),
        handlingHappy: hh, handlingNeutral: countField(rows,'rating_handling','neutral'), handlingSad: countField(rows,'rating_handling','sad'),
        overallHappy:  oh, overallNeutral: countField(rows,'rating_overall','neutral'), overallSad:  countField(rows,'rating_overall','sad'),
        billingTotal: billing.length,
        billingHappy:   countField(billing,'rating_overall','happy'),
        billingNeutral: countField(billing,'rating_overall','neutral'),
        billingSad:     countField(billing,'rating_overall','sad'),
        browseTotal: browse.length,
        browseHappy:   countField(browse,'rating_overall','happy'),
        browseNeutral: countField(browse,'rating_overall','neutral'),
        browseSad:     countField(browse,'rating_overall','sad'),
      }
    },
  })
}

export function useMdTrend() {
  return useQuery({
    queryKey: ['md-trend'],
    queryFn: async (): Promise<TrendPoint[]> => {
      const since = new Date()
      since.setDate(since.getDate() - 6)
      since.setHours(0, 0, 0, 0)

      const { data, error } = await supabase
        .from('feedback_records')
        .select('created_at, rating_price, rating_design, rating_handling, rating_overall')
        .eq('branch_id', 'chennai-main')
        .gte('created_at', since.toISOString())
      if (error) throw error

      const rows = data ?? []
      const map: Record<string, { count: number; happyTotal: number }> = {}

      rows.forEach(r => {
        const day = r.created_at.slice(0, 10)
        if (!map[day]) map[day] = { count: 0, happyTotal: 0 }
        map[day].count++
        const happyCount = [r.rating_price, r.rating_design, r.rating_handling, r.rating_overall]
          .filter(v => v === 'happy').length
        map[day].happyTotal += happyCount / 4
      })

      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date()
        d.setDate(d.getDate() - (6 - i))
        const key = d.toISOString().slice(0, 10)
        const entry = map[key]
        return {
          day: key,
          submissions: entry?.count ?? 0,
          happinessPct: entry ? Math.round(entry.happyTotal / entry.count * 100) : 0,
        }
      })
    },
  })
}
