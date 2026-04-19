import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'

export type DateRange = 'today' | 'week' | 'month' | 'custom'

type DateFilterTabsProps = {
  value: DateRange
  onChange: (range: DateRange) => void
}

const TABS: { key: DateRange; label: string }[] = [
  { key: 'today',  label: 'dashboard.date_today' },
  { key: 'week',   label: 'dashboard.date_week' },
  { key: 'month',  label: 'dashboard.date_month' },
  { key: 'custom', label: 'dashboard.date_custom' },
]

export function DateFilterTabs({ value, onChange }: DateFilterTabsProps) {
  return (
    <div className="flex gap-1 p-1 bg-secondary rounded-lg w-fit" role="tablist" aria-label="Date range filter">
      {TABS.map(tab => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={value === tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            'px-4 py-1.5 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring',
            value === tab.key
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {t(tab.label)}
        </button>
      ))}
    </div>
  )
}

// Utility: convert DateRange to ISO date strings
export function dateRangeToISO(range: DateRange): { from: string; to: string } {
  const now = new Date()
  const to   = new Date(now)
  to.setHours(23, 59, 59, 999)

  const from = new Date(now)

  if (range === 'today') {
    from.setHours(0, 0, 0, 0)
  } else if (range === 'week') {
    from.setDate(now.getDate() - 6)
    from.setHours(0, 0, 0, 0)
  } else if (range === 'month') {
    from.setDate(1)
    from.setHours(0, 0, 0, 0)
  } else {
    // custom — caller provides own dates; default to last 30 days
    from.setDate(now.getDate() - 29)
    from.setHours(0, 0, 0, 0)
  }

  return { from: from.toISOString(), to: to.toISOString() }
}
