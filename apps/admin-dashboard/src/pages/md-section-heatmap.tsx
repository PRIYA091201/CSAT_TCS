import { useState } from 'react'
import { t } from '@/lib/i18n'
import { cn, heatmapColor } from '@/lib/utils'
import { PageHeader } from '@/components/page-header'
import { DateFilterTabs, dateRangeToISO, type DateRange } from '@/components/date-filter-tabs'
import { useHeatmap, type TopConcern } from '@/hooks/use-heatmap'

const DIMENSIONS = ['pricing', 'design', 'handling', 'overall'] as const
type Dimension = typeof DIMENSIONS[number]

const DIM_LABELS: Record<Dimension, string> = {
  pricing:  'Pricing',
  design:   'Design',
  handling: 'Handling',
  overall:  'Overall',
}

function getDimKey(dim: Dimension): 'price_happy_pct' | 'design_happy_pct' | 'handling_happy_pct' | 'overall_happy_pct' {
  if (dim === 'pricing')  return 'price_happy_pct'
  if (dim === 'design')   return 'design_happy_pct'
  if (dim === 'handling') return 'handling_happy_pct'
  return 'overall_happy_pct'
}

function getInsightText(concern: TopConcern): string {
  const band = concern.happyPct < 40 ? 'red' : 'amber'
  let text = t(`heatmap.insights.${concern.dimension}.${band}`, {
    happy:   concern.happyPct,
    unhappy: concern.unhappyPct,
    count:   concern.count,
  })
  if (concern.isHighestVolume) {
    text += ` (${concern.count} submissions — highest volume).`
  }
  return text
}

const RANK_BADGES = ['①', '②', '③']

export function MDSectionHeatmap() {
  const [dateRange, setDateRange] = useState<DateRange>('week')
  const { from, to } = dateRangeToISO(dateRange)
  const { data, isLoading } = useHeatmap(from, to)

  if (isLoading || !data) {
    return <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
  }

  const { rows, concerns } = data

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <PageHeader title={t('heatmap.title')} />
        <DateFilterTabs value={dateRange} onChange={setDateRange} />
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left pb-2 pr-3 text-xs font-medium text-muted-foreground w-32" />
              {DIMENSIONS.map(dim => (
                <th key={dim} className="pb-2 px-2 text-xs font-medium text-muted-foreground text-center">
                  {DIM_LABELS[dim]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.section_id}>
                <td className="py-1 pr-3 text-sm font-medium text-foreground whitespace-nowrap">
                  {row.display_name}
                </td>
                {DIMENSIONS.map(dim => {
                  const pct = row[getDimKey(dim)] as number
                  const { bg, text } = heatmapColor(pct)
                  return (
                    <td key={dim} className="py-1 px-2">
                      <div className={cn(
                        'rounded-md px-3 py-2 text-center text-sm font-semibold min-w-[80px]',
                        bg, text
                      )}>
                        {pct}%
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-green-950 border border-green-500/30 inline-block" />
          {t('heatmap.legend_green')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-amber-950 border border-amber-500/30 inline-block" />
          {t('heatmap.legend_amber')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-950 border border-red-500/30 inline-block" />
          {t('heatmap.legend_red')}
        </span>
      </div>

      {/* Top concerns */}
      {concerns.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-foreground mb-4">{t('heatmap.top_concerns')}</h2>
          <div className="space-y-0">
            {concerns.map(concern => (
              <div
                key={`${concern.section}-${concern.dimension}`}
                className="flex items-start justify-between gap-4 py-4 border-b border-border last:border-0"
              >
                <div className="flex items-start gap-3">
                  <span className="text-lg leading-none mt-0.5 text-muted-foreground">
                    {RANK_BADGES[concern.rank - 1]}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {concern.sectionDisplay} — {DIM_LABELS[concern.dimension]}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {getInsightText(concern)}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-red-400 shrink-0">
                  {concern.happyPct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {concerns.length === 0 && rows.length > 0 && (
        <p className="mt-8 text-sm text-muted-foreground">
          No concerns — all sections have ≥ 5 submissions and &gt; 40% happy. Great work!
        </p>
      )}
    </div>
  )
}
