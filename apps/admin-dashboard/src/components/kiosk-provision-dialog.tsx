import { useState } from 'react'
import { t } from '@/lib/i18n'
import { useProvisionKiosk, type ProvisionResult } from '@/hooks/use-kiosks'
import { useZones } from '@/hooks/use-zones'

type Props = {
  onClose: () => void
  onProvisioned: (result: ProvisionResult) => void
}

export function KioskProvisionDialog({ onClose, onProvisioned }: Props) {
  const { data: zones } = useZones()
  const provision = useProvisionKiosk()

  const [kioskName, setKioskName] = useState('')
  const [zoneId, setZoneId]       = useState('')
  const [errorMsg, setErrorMsg]   = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    try {
      const result = await provision.mutateAsync({
        kiosk_name: kioskName.trim(),
        zone_id:    zoneId,
        branch_id:  'chennai-main',
      })
      onProvisioned(result)
    } catch {
      setErrorMsg(t('common.error'))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog" aria-modal="true" aria-label={t('kiosks.new_kiosk')}>
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 shadow-xl">
        <h2 className="text-base font-semibold text-foreground mb-5">{t('kiosks.new_kiosk')}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1" htmlFor="kiosk-name">
              {t('kiosks.kiosk_name')}
            </label>
            <input
              id="kiosk-name"
              type="text"
              required
              value={kioskName}
              onChange={e => setKioskName(e.target.value)}
              placeholder="Browse — Sarees"
              className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1" htmlFor="kiosk-zone">
              {t('kiosks.zone')}
            </label>
            <select
              id="kiosk-zone"
              required
              value={zoneId}
              onChange={e => setZoneId(e.target.value)}
              className="w-full h-10 px-3 rounded-md bg-secondary border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Select a zone…</option>
              {(zones ?? []).filter(z => z.is_active).map(z => (
                <option key={z.zone_id} value={z.zone_id}>
                  {z.zone_name} ({z.zone_type})
                </option>
              ))}
            </select>
          </div>

          {errorMsg && <p className="text-sm text-red-400" role="alert">{errorMsg}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 h-10 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={provision.isPending}
              className="flex-1 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
              {provision.isPending ? t('common.loading') : t('kiosks.new_kiosk')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
