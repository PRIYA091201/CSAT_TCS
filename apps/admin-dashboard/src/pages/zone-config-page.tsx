import { useState } from 'react'
import { Link } from 'react-router-dom'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { ZoneFormDialog } from '@/components/zone-form-dialog'
import { useZones, type Zone } from '@/hooks/use-zones'
import { useAllProductSections } from '@/hooks/use-product-sections'
import { supabase } from '@/lib/supabase'
import { useQueryClient } from '@tanstack/react-query'

type Tab = 'zones' | 'sections'

export function ZoneConfigPage() {
  const [tab, setTab]           = useState<Tab>('zones')
  const [editZone, setEditZone] = useState<Zone | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div>
      <PageHeader
        title={t('zones.title')}
        action={
          tab === 'zones' ? (
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
            >
              + {t('zones.new_zone')}
            </button>
          ) : undefined
        }
      />

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-secondary rounded-lg w-fit mb-6">
        {(['zones', 'sections'] as Tab[]).map(t_ => (
          <button
            key={t_}
            onClick={() => setTab(t_)}
            className={cn(
              'px-4 py-1.5 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring',
              tab === t_
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t_ === 'zones' ? 'Zones' : 'Product Sections'}
          </button>
        ))}
      </div>

      {tab === 'zones'    && <ZonesTab editZone={editZone} setEditZone={setEditZone} showCreate={showCreate} setShowCreate={setShowCreate} />}
      {tab === 'sections' && <SectionsTab />}
    </div>
  )
}

// ── Zones tab ─────────────────────────────────────────────────
function ZonesTab({ editZone, setEditZone, showCreate, setShowCreate }: {
  editZone: Zone | null
  setEditZone: (z: Zone | null) => void
  showCreate: boolean
  setShowCreate: (v: boolean) => void
}) {
  const { data: zones, isLoading, error } = useZones()

  if (isLoading) return <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
  if (error)     return <p className="text-red-400 text-sm">{t('common.error')}</p>

  return (
    <>
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary">
              {['Zone name','Type','Section','TTL','Status',''].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(zones ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  No zones yet. Create your first zone above.
                </td>
              </tr>
            )}
            {(zones ?? []).map(zone => (
              <tr key={zone.zone_id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">
                  <Link
                    to={`/zones/${zone.zone_id}`}
                    className="hover:text-primary transition-colors focus:outline-none focus:underline"
                  >
                    {zone.zone_name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground capitalize">{zone.zone_type}</td>
                <td className="px-4 py-3 text-muted-foreground">{zone.product_section ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{zone.token_ttl_min} min</td>
                <td className="px-4 py-3">
                  <StatusBadge
                    status={zone.is_active ? 'active' : 'expired'}
                    label={zone.is_active ? 'Active' : 'Inactive'}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setEditZone(zone)}
                    className="text-xs text-muted-foreground hover:text-foreground focus:outline-none focus:underline"
                  >
                    {t('common.edit')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && <ZoneFormDialog onClose={() => setShowCreate(false)} />}
      {editZone   && <ZoneFormDialog zone={editZone} onClose={() => setEditZone(null)} />}
    </>
  )
}

// ── Product Sections tab — specs §9.1 ─────────────────────────
function SectionsTab() {
  const { data: sections, isLoading, error } = useAllProductSections()
  const qc = useQueryClient()
  const [saving, setSaving] = useState<string | null>(null)

  async function toggleActive(sectionId: string, current: boolean) {
    setSaving(sectionId)
    await supabase
      .from('product_sections')
      .update({ is_active: !current })
      .eq('section_id', sectionId)
    qc.invalidateQueries({ queryKey: ['product_sections'] })
    setSaving(null)
  }

  if (isLoading) return <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
  if (error)     return <p className="text-red-400 text-sm">{t('common.error')}</p>

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary">
            {['Section ID','Display name','Sort order','Status',''].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(sections ?? []).map(s => (
            <tr key={s.section_id} className="border-b border-border last:border-0 hover:bg-secondary/50">
              <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{s.section_id}</td>
              <td className="px-4 py-3 font-medium text-foreground">{s.display_name}</td>
              <td className="px-4 py-3 text-muted-foreground">{s.sort_order}</td>
              <td className="px-4 py-3">
                <StatusBadge
                  status={s.is_active ? 'active' : 'expired'}
                  label={s.is_active ? 'Active' : 'Inactive'}
                />
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => toggleActive(s.section_id, s.is_active)}
                  disabled={saving === s.section_id}
                  className={cn(
                    'text-xs focus:outline-none focus:underline disabled:opacity-50',
                    s.is_active ? 'text-red-400 hover:text-red-300' : 'text-green-400 hover:text-green-300'
                  )}
                >
                  {saving === s.section_id ? '…' : s.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
