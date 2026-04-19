import { useState } from 'react'
import {
  ComposedChart, Area, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'
import { t } from '@/lib/i18n'
import { formatCount, formatPct } from '@/lib/utils'
import { MetricCard } from '@/components/metric-card'
import { EmotionPulseBar } from '@/components/emotion-pulse-bar'
import { DateFilterTabs, dateRangeToISO, type DateRange } from '@/components/date-filter-tabs'
import { useMdOverview, useMdTrend } from '@/hooks/use-md-stats'
import { useBranchResponseRate } from '@/hooks/use-response-rate'
import { Link } from 'react-router-dom'

const DIMENSIONS = [
  { key: 'price',    label: 'dashboard.pricing',  happyKey: 'priceHappy',    neutralKey: 'priceNeutral',    sadKey: 'priceSad' },
  { key: 'design',   label: 'dashboard.design',   happyKey: 'designHappy',   neutralKey: 'designNeutral',   sadKey: 'designSad' },
  { key: 'handling', label: 'dashboard.handling', happyKey: 'handlingHappy', neutralKey: 'handlingNeutral', sadKey: 'handlingSad' },
  { key: 'overall',  label: 'dashboard.overall',  happyKey: 'overallHappy',  neutralKey: 'overallNeutral',  sadKey: 'overallSad' },
] as const

export function MDCrossZoneView() {
  const [dateRange, setDateRange] = useState<DateRange>('week')
  const { from, to } = dateRangeToISO(dateRange)
  const { data: stats, isLoading } = useMdOverview(from, to)
  const { data: trend } = useMdTrend()
  const { data: rr }    = useBranchResponseRate(from, to)

  if (isLoading || !stats) {
    return <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{t('common.store_name')}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{t('md.role_label')}</p>
        </div>
        <DateFilterTabs value={dateRange} onChange={setDateRange} />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          label={t('dashboard.total_submissions')}
          value={formatCount(stats.total)}
        />
        <MetricCard
          label={t('dashboard.happiness_ratio')}
          value={formatPct(stats.happinessRatioPct)}
          subtitle={t('dashboard.across_all')}
          valueClassName={
            stats.happinessRatioPct >= 60 ? 'text-green-400' :
            stats.happinessRatioPct >= 40 ? 'text-amber-400' : 'text-red-400'
          }
        />
        <MetricCard
          label={t('dashboard.response_rate')}
          value={rr ? formatPct(rr.ratePct) : '—'}
          subtitle={rr ? t('dashboard.tokens_used', { used: rr.tokensUsed, total: rr.tokensMinted }) : ''}
        />
        <MetricCard
          label={t('dashboard.top_concern')}
          value={stats.topConcernDimension}
          subtitle={t('dashboard.unhappy_this_week', { pct: stats.topConcernUnhappyPct })}
          valueClassName="text-base text-red-400"
        />
      </div>

      {/* Emotion pulse — all zones */}
      <div className="mt-6 bg-card border border-border rounded-lg p-4">
        <p className="text-sm font-medium text-foreground mb-1">{t('dashboard.emotion_pulse')}</p>
        <p className="text-xs text-muted-foreground mb-4">{t('dashboard.all_zones')}</p>
        <div className="mb-3 flex gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" />{t('dashboard.happy')}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" />{t('dashboard.okay')}</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-red-500  inline-block" />{t('dashboard.unhappy')}</span>
        </div>
        {DIMENSIONS.map(d => (
          <EmotionPulseBar
            key={d.key}
            label={t(d.label)}
            happy={stats[d.happyKey]}
            neutral={stats[d.neutralKey]}
            unhappy={stats[d.sadKey]}
          />
        ))}
      </div>

      {/* Zone comparison */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        {[
          {
            title: t('dashboard.billing_zone'),
            total: stats.billingTotal,
            happy: stats.billingHappy,
            neutral: stats.billingNeutral,
            sad: stats.billingSad,
          },
          {
            title: t('dashboard.browse_zone'),
            total: stats.browseTotal,
            happy: stats.browseHappy,
            neutral: stats.browseNeutral,
            sad: stats.browseSad,
          },
        ].map(zone => (
          <div key={zone.title} className="bg-card border border-border rounded-lg p-4">
            <p className="text-sm font-medium text-foreground mb-0.5">{zone.title}</p>
            <p className="text-xs text-muted-foreground mb-4">
              {t('dashboard.submissions', { count: zone.total })}
            </p>
            <EmotionPulseBar label={t('dashboard.overall')}
              happy={zone.happy} neutral={zone.neutral} unhappy={zone.sad} />
          </div>
        ))}
      </div>

      {/* 7-day trend — dual axis */}
      <div className="mt-6 bg-card border border-border rounded-lg p-4">
        <p className="text-sm font-medium text-foreground mb-4">{t('dashboard.seven_day_trend')}</p>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={trend ?? []} margin={{ top: 4, right: 24, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="blueGrad2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false}
              tickFormatter={v => v.slice(5)} />
            <YAxis yAxisId="left"  tick={{ fill: '#6b7280', fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: '#6b7280', fontSize: 11 }}
              tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
            <Tooltip
              contentStyle={{ background: '#1c1c1c', border: '1px solid #333', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#9ca3af' }}
              itemStyle={{ color: '#e5e7eb' }}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: '#9ca3af' }} />
            <Area yAxisId="left" type="monotone" dataKey="submissions" name="Submissions"
              stroke="#3b82f6" strokeWidth={2} fill="url(#blueGrad2)" dot={{ fill: '#3b82f6', r: 3 }} />
            <Line yAxisId="right" type="monotone" dataKey="happinessPct" name="Happiness %"
              stroke="#22c55e" strokeWidth={2} strokeDasharray="5 3" dot={{ fill: '#22c55e', r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Navigation links */}
      <div className="mt-6 flex gap-6">
        <Link to="/md-view/heatmap"
          className="text-sm text-primary hover:underline focus:outline-none focus:underline">
          Section heatmap →
        </Link>
        <Link to="/md-view/trends"
          className="text-sm text-primary hover:underline focus:outline-none focus:underline">
          Trend analysis →
        </Link>
      </div>
    </div>
  )
}
