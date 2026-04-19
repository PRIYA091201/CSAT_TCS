import { useState } from 'react'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { useCreateZone, useUpdateZone, type Zone } from '@/hooks/use-zones'
import { useProductSections } from '@/hooks/use-product-sections'

type ZoneFormDialogProps = {
  zone?: Zone
  onClose: () => void
}

export function ZoneFormDialog({ zone, onClose }: ZoneFormDialogProps) {
  const isEdit = !!zone
  const { data: sections } = useProductSections()

  const [zoneName, setZoneName]           = useState(zone?.zone_name ?? '')
  const [zoneType, setZoneType]           = useState<'billing'|'browse'>(zone?.zone_type ?? 'billing')
  const [productSection, setProductSection] = useState(zone?.product_section ?? '')
  const [tokenTtl, setTokenTtl]           = useState(zone?.token_ttl_min ?? 30)
  const [isActive, setIsActive]           = useState(zone?.is_active ?? true)
  const [successMsg, setSuccessMsg]       = useState<string | null>(null)
  const [errorMsg, setErrorMsg]           = useState<string | null>(null)

  const createZone = useCreateZone()
  const updateZone = useUpdateZone()
  const loading    = createZone.isPending || updateZone.isPending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)

    const payload = {
      zone_name:       zoneName.trim(),
      zone_type:       zoneType,
      product_section: zoneType === 'browse' && productSection ? productSection : null,
      token_ttl_min:   tokenTtl,
      is_active:       isActive,
      branch_id:       'chennai-main',
    }

    try {
      if (isEdit && zone) {
        await updateZone.mutateAsync({ zoneId: zone.zone_id, updates: payload })
        setSuccessMsg(t('zones.updated'))
      } else {
        await createZone.mutateAsync(payload)
        setSuccessMsg(t('zones.created'))
      }
      setTimeout(onClose, 800)
    } catch {
      setErrorMsg(t('common.error'))
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? t('common.edit') : t('zones.new_zone')}
    >
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 shadow-xl">
        <h2 className="text-base font-semibold text-foreground mb-5">
          {isEdit ? t('common.edit') : t('zones.new_zone')}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Zone name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1" htmlFor="zone-name">
              {t('zones.zone_name')}
            </label>
            <input
              id="zone-name"
              type="text"
              required
              value={zoneName}
              onChange={e => setZoneName(e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="e.g. Billing Counter 1"
            />
          </div>

          {/* Zone type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">{t('zones.zone_type')}</label>
            <div className="flex gap-3">
              {(['billing', 'browse'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setZoneType(type)}
                  aria-pressed={zoneType === type}
                  className={cn(
                    'flex-1 h-10 rounded-md border text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring',
                    zoneType === type
                      ? 'border-primary bg-primary/15 text-primary'
                      : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t(`zones.${type}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Product section — browse only */}
          {zoneType === 'browse' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1" htmlFor="section">
                {t('zones.product_section')}
              </label>
              <select
                id="section"
                value={productSection}
                onChange={e => setProductSection(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">{t('zones.none')}</option>
                {(sections ?? []).map(s => (
                  <option key={s.section_id} value={s.section_id}>{s.display_name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Token TTL */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1" htmlFor="ttl">
              {t('zones.token_ttl')}
            </label>
            <input
              id="ttl"
              type="number"
              min={1}
              max={120}
              required
              value={tokenTtl}
              onChange={e => setTokenTtl(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={isActive}
              onClick={() => setIsActive(v => !v)}
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring',
                isActive ? 'bg-primary' : 'bg-muted'
              )}
            >
              <span className={cn(
                'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
                isActive ? 'translate-x-6' : 'translate-x-1'
              )} />
            </button>
            <span className="text-sm text-foreground">
              {isActive ? t('zones.active') : t('zones.inactive')}
            </span>
          </div>

          {successMsg && <p className="text-sm text-green-400">{successMsg}</p>}
          {errorMsg   && <p className="text-sm text-red-400"   role="alert">{errorMsg}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {loading ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
