import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { t } from '@/lib/i18n'
import { formatCount, formatPct } from '@/lib/utils'
import { PageHeader } from '@/components/page-header'
import { MetricCard } from '@/components/metric-card'
import { EmotionPulseBar } from '@/components/emotion-pulse-bar'
import { DateFilterTabs, dateRangeToISO, type DateRange } from '@/components/date-filter-tabs'
import { useZone } from '@/hooks/use-zones'
import { useZoneStats, useZoneTrend, type ZoneStats } from '@/hooks/use-zone-stats'
import { useZoneResponseRate } from '@/hooks/use-response-rate'

type DimensionKey = 'price' | 'design' | 'handling' | 'overall'

const DIMENSIONS: { key: DimensionKey; label: string }[] = [
  { key: 'price',    label: 'dashboard.pricing' },
  { key: 'design',   label: 'dashboard.design' },
  { key: 'handling', label: 'dashboard.handling' },
  { key: 'overall',  label: 'dashboard.overall' },
]

function getDimValues(stats: ZoneStats, key: DimensionKey) {
  return {
    happy:   stats[`${key}_happy`   as keyof ZoneStats] as number,
    neutral: stats[`${key}_neutral` as keyof ZoneStats] as number,
    unhappy: stats[`${key}_sad`     as keyof ZoneStats] as number,
  }
}

export function ZoneDashboard() {
  const { zoneId } = useParams<{ zoneId: string }>()
  const [dateRange, setDateRange] = useState<DateRange>('week')
  const { from, to } = dateRangeToISO(dateRange)

  const { data: zone }  = useZone(zoneId!)
  const { data: stats, isLoading } = useZoneStats(zoneId!, from, to)
  const { data: trend } = useZoneTrend(zoneId!)
  const { data: rr }    = useZoneResponseRate(zoneId!, from, to)

  if (isLoading || !stats) {
    return <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
  }

  const happyRatio = stats.total > 0
    ? Math.round((stats.overall_happy / stats.total) * 100)
    : 0

  return (
    <div>
      <PageHeader
        title={zone?.zone_name ?? '…'}
        subtitle={zone ? `${zone.zone_type} zone · ${zone.product_section ?? 'no section'} · TTL ${zone.token_ttl_min} min` : undefined}
      />

      <div className="mb-5">
        <DateFilterTabs value={dateRange} onChange={setDateRange} />
      </div>

      {/* Metric cards — 4 as per specs §9.2 */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          label={t('dashboard.total_submissions')}
          value={formatCount(stats.total)}
          subtitle={`${stats.today} today · ${stats.this_week} this week`}
        />
        <MetricCard
          label={t('dashboard.happiness_ratio')}
          value={formatPct(happyRatio)}
          subtitle={t('dashboard.across_all')}
          valueClassName={
            happyRatio >= 60 ? 'text-green-400' :
            happyRatio >= 40 ? 'text-amber-400' : 'text-red-400'
          }
        />
        <MetricCard
          label={t('dashboard.response_rate')}
          value={rr ? formatPct(rr.ratePct) : '—'}
          subtitle={rr ? t('dashboard.tokens_used', { used: rr.tokensUsed, total: rr.tokensMinted }) : ''}
        />
        <MetricCard
          label="This month"
          value={formatCount(stats.this_month)}
          subtitle="submissions"
        />
      </div>

      {/* Emotion pulse — specs §9.2 */}
      <div className="mt-6 bg-card border border-border rounded-lg p-5">
        <p className="text-sm font-semibold text-foreground mb-1">{t('dashboard.emotion_pulse')}</p>
        <div className="mb-4 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" />
            {t('dashboard.happy')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />
            {t('dashboard.okay')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block" />
            {t('dashboard.unhappy')}
          </span>
        </div>
        {DIMENSIONS.map(d => {
          const vals = getDimValues(stats, d.key)
          return (
            <EmotionPulseBar
              key={d.key}
              label={t(d.label)}
              happy={vals.happy}
              neutral={vals.neutral}
              unhappy={vals.unhappy}
            />
          )
        })}
      </div>

      {/* 7-day submission trend — specs §9.2 */}
      <div className="mt-6 bg-card border border-border rounded-lg p-5">
        <p className="text-sm font-semibold text-foreground mb-4">{t('dashboard.seven_day_trend')}</p>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={trend ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="day"
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => v.slice(5)}
            />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: '#1c1c1c', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#9ca3af' }}
              itemStyle={{ color: '#e5e7eb' }}
            />
            <Area
              type="monotone"
              dataKey="submissions"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#blueGrad)"
              dot={{ fill: '#3b82f6', r: 3 }}
              name="Submissions"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
