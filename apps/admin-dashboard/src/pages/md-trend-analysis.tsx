import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend, CartesianGrid,
} from 'recharts'
import { t } from '@/lib/i18n'
import { PageHeader } from '@/components/page-header'
import { DateFilterTabs, dateRangeToISO, type DateRange } from '@/components/date-filter-tabs'
import { useMdTrend } from '@/hooks/use-md-stats'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'

type DimTrendPoint = {
  day: string
  pricing: number
  design: number
  handling: number
  overall: number
  submissions: number
}

function useDimensionTrend(from: string, to: string) {
  return useQuery({
    queryKey: ['dim-trend', from, to],
    queryFn: async (): Promise<DimTrendPoint[]> => {
      const { data, error } = await supabase
        .from('feedback_records')
        .select('created_at, rating_price, rating_design, rating_handling, rating_overall')
        .eq('branch_id', 'chennai-main')
        .gte('created_at', from)
        .lte('created_at', to)
      if (error) throw error

      const rows = data ?? []
      const map: Record<string, { count: number; ph: number; dh: number; hh: number; oh: number }> = {}

      rows.forEach(r => {
        const day = r.created_at.slice(0, 10)
        if (!map[day]) map[day] = { count: 0, ph: 0, dh: 0, hh: 0, oh: 0 }
        map[day].count++
        if (r.rating_price    === 'happy') map[day].ph++
        if (r.rating_design   === 'happy') map[day].dh++
        if (r.rating_handling === 'happy') map[day].hh++
        if (r.rating_overall  === 'happy') map[day].oh++
      })

      return Object.entries(map)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, v]) => ({
          day,
          submissions: v.count,
          pricing:  Math.round(v.ph / v.count * 100),
          design:   Math.round(v.dh / v.count * 100),
          handling: Math.round(v.hh / v.count * 100),
          overall:  Math.round(v.oh / v.count * 100),
        }))
    },
  })
}

const DIM_COLORS = {
  pricing:  '#3b82f6',
  design:   '#22c55e',
  handling: '#f59e0b',
  overall:  '#a78bfa',
}

export function MDTrendAnalysis() {
  const [dateRange, setDateRange] = useState<DateRange>('month')
  const { from, to } = dateRangeToISO(dateRange)
  const { data: dimTrend, isLoading } = useDimensionTrend(from, to)
  const { data: volumeTrend } = useMdTrend()

  const TOOLTIP_STYLE = {
    contentStyle: { background: '#1c1c1c', border: '1px solid #333', borderRadius: 8, fontSize: 12 },
    labelStyle: { color: '#9ca3af' },
    itemStyle: { color: '#e5e7eb' },
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <PageHeader title="Trend Analysis" subtitle="Is sentiment improving? Did your last change work?" />
        <DateFilterTabs value={dateRange} onChange={setDateRange} />
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">{t('common.loading')}</p>}

      {/* Sentiment timeline — specs §10.3 */}
      <div className="bg-card border border-border rounded-lg p-5 mb-6">
        <p className="text-sm font-semibold text-foreground mb-4">
          Happiness % per dimension — daily
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={dimTrend ?? []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false}
              tickFormatter={v => v.slice(5)} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false}
              domain={[0, 100]} tickFormatter={v => `${v}%`} />
            <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => `${v}%`} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
            {(Object.entries(DIM_COLORS) as [keyof typeof DIM_COLORS, string][]).map(([key, color]) => (
              <Line key={key} type="monotone" dataKey={key} name={key.charAt(0).toUpperCase() + key.slice(1)}
                stroke={color} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Volume vs sentiment — specs §10.3 */}
      <div className="bg-card border border-border rounded-lg p-5 mb-6">
        <p className="text-sm font-semibold text-foreground mb-4">
          Volume vs overall happiness — 7-day
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={volumeTrend ?? []} margin={{ top: 4, right: 24, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
            <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false}
              tickFormatter={v => v.slice(5)} />
            <YAxis yAxisId="left"  tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: '#6b7280', fontSize: 11 }}
              tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
            <Line yAxisId="left"  type="monotone" dataKey="submissions" name="Volume"
              stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6', r: 3 }} />
            <Line yAxisId="right" type="monotone" dataKey="happinessPct" name="Happiness %"
              stroke="#22c55e" strokeWidth={2} strokeDasharray="5 3" dot={{ fill: '#22c55e', r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Peak hours heatmap placeholder — specs §10.3 */}
      <div className="bg-card border border-border rounded-lg p-5">
        <p className="text-sm font-semibold text-foreground mb-1">Peak hours</p>
        <p className="text-xs text-muted-foreground">
          Submission volume by hour of day × day of week. Coming in next sprint.
        </p>
      </div>
    </div>
  )
}
