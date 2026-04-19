import { useState } from 'react'
import { t } from '@/lib/i18n'
import { PageHeader } from '@/components/page-header'
import { useZones } from '@/hooks/use-zones'
import { supabase } from '@/lib/supabase'

// Specs §9.4: Export aggregated metrics: submissions by zone, section, dimension, date
// Non-PII only. Filtered by current dashboard view (date range, zone).

type AggRow = {
  date: string
  zone_name: string
  zone_type: string
  product_section: string
  total_submissions: number
  price_happy: number; price_neutral: number; price_sad: number
  price_happy_pct: number
  design_happy: number; design_neutral: number; design_sad: number
  design_happy_pct: number
  handling_happy: number; handling_neutral: number; handling_sad: number
  handling_happy_pct: number
  overall_happy: number; overall_neutral: number; overall_sad: number
  overall_happy_pct: number
}

function buildAggregatedRows(
  records: { created_at: string; zone_id: string; zone_type: string; product_section: string; rating_price: string; rating_design: string; rating_handling: string; rating_overall: string }[],
  zones: { zone_id: string; zone_name: string }[]
): AggRow[] {
  const zoneMap: Record<string, string> = {}
  zones.forEach(z => { zoneMap[z.zone_id] = z.zone_name })

  // Group by date + zone + section
  const map: Record<string, AggRow> = {}
  records.forEach(r => {
    const date    = r.created_at.slice(0, 10)
    const key     = `${date}||${r.zone_id}||${r.product_section}`
    if (!map[key]) {
      map[key] = {
        date,
        zone_name:         zoneMap[r.zone_id] ?? r.zone_id,
        zone_type:         r.zone_type,
        product_section:   r.product_section,
        total_submissions: 0,
        price_happy: 0, price_neutral: 0, price_sad: 0, price_happy_pct: 0,
        design_happy: 0, design_neutral: 0, design_sad: 0, design_happy_pct: 0,
        handling_happy: 0, handling_neutral: 0, handling_sad: 0, handling_happy_pct: 0,
        overall_happy: 0, overall_neutral: 0, overall_sad: 0, overall_happy_pct: 0,
      }
    }
    const row = map[key]
    row.total_submissions++
    if (r.rating_price    === 'happy')   row.price_happy++
    else if (r.rating_price    === 'neutral') row.price_neutral++
    else row.price_sad++
    if (r.rating_design   === 'happy')   row.design_happy++
    else if (r.rating_design   === 'neutral') row.design_neutral++
    else row.design_sad++
    if (r.rating_handling === 'happy')   row.handling_happy++
    else if (r.rating_handling === 'neutral') row.handling_neutral++
    else row.handling_sad++
    if (r.rating_overall  === 'happy')   row.overall_happy++
    else if (r.rating_overall  === 'neutral') row.overall_neutral++
    else row.overall_sad++
  })

  // Compute percentages
  return Object.values(map).map(row => {
    const n = row.total_submissions
    return {
      ...row,
      price_happy_pct:    n > 0 ? Math.round(row.price_happy    / n * 100) : 0,
      design_happy_pct:   n > 0 ? Math.round(row.design_happy   / n * 100) : 0,
      handling_happy_pct: n > 0 ? Math.round(row.handling_happy / n * 100) : 0,
      overall_happy_pct:  n > 0 ? Math.round(row.overall_happy  / n * 100) : 0,
    }
  }).sort((a, b) => b.date.localeCompare(a.date))
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return 'No data for selected filters.'
  const headers = Object.keys(rows[0])
  const lines = rows.map(row =>
    headers.map(h => {
      const val = row[h]
      const str = val === null || val === undefined ? '' : String(val)
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"` : str
    }).join(',')
  )
  return [headers.join(','), ...lines].join('\n')
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function ExportPage() {
  const { data: zones } = useZones()

  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 29)
    return d.toISOString().slice(0, 10)
  })
  const [toDate, setToDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [zoneId, setZoneId]   = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleExport() {
    setError(null)
    setSuccess(false)
    setLoading(true)

    try {
      let query = supabase
        .from('feedback_records')
        .select('created_at, zone_id, zone_type, product_section, rating_price, rating_design, rating_handling, rating_overall')
        .eq('branch_id', 'chennai-main')
        .gte('created_at', new Date(fromDate).toISOString())
        .lte('created_at', new Date(toDate + 'T23:59:59').toISOString())

      if (zoneId) query = query.eq('zone_id', zoneId)

      const { data, error: fetchError } = await query
      if (fetchError) throw fetchError

      const aggRows = buildAggregatedRows(data ?? [], zones ?? [])
      const csv      = toCSV(aggRows as unknown as Record<string, unknown>[])
      const filename = `csat-aggregated-${fromDate}-to-${toDate}.csv`
      downloadCSV(csv, filename)

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (err) {
      console.error('[export]', err)
      setError(t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg">
      <PageHeader
        title={t('export.title')}
        subtitle="Aggregated metrics by date × zone × section. Non-PII only."
      />

      <div className="bg-card border border-border rounded-lg p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1" htmlFor="from-date">
              {t('export.date_from')}
            </label>
            <input id="from-date" type="date" value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1" htmlFor="to-date">
              {t('export.date_to')}
            </label>
            <input id="to-date" type="date" value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1" htmlFor="export-zone">
            {t('export.zone_filter')}
          </label>
          <select id="export-zone" value={zoneId} onChange={e => setZoneId(e.target.value)}
            className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring">
            <option value="">{t('export.all_zones')}</option>
            {(zones ?? []).map(z => (
              <option key={z.zone_id} value={z.zone_id}>{z.zone_name} ({z.zone_type})</option>
            ))}
          </select>
        </div>

        {error   && <p className="text-sm text-red-400"   role="alert">{error}</p>}
        {success && <p className="text-sm text-green-400" role="status">{t('export.success')}</p>}

        <button onClick={handleExport} disabled={loading}
          className="w-full h-11 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring transition-opacity">
          {loading ? t('export.downloading') : t('export.download')}
        </button>

        <p className="text-xs text-muted-foreground">
          Exports: submissions grouped by date, zone, section with happy/okay/unhappy counts and percentages per dimension. No customer names, IP addresses, or device IDs.
        </p>
      </div>
    </div>
  )
}
