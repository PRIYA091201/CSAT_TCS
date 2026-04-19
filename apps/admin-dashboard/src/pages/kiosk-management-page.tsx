import { useState } from 'react'
import { t } from '@/lib/i18n'
import { formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { KioskProvisionDialog } from '@/components/kiosk-provision-dialog'
import { KioskCredentialsDialog } from '@/components/kiosk-credentials-dialog'
import { useKiosks, useDeactivateKiosk, type ProvisionResult } from '@/hooks/use-kiosks'

export function KioskManagementPage() {
  const { data: kiosks, isLoading, error } = useKiosks()
  const deactivate = useDeactivateKiosk()

  const [showProvision, setShowProvision]               = useState(false)
  const [credentials, setCredentials]                   = useState<ProvisionResult | null>(null)
  const [confirmDeactivateId, setConfirmDeactivateId]   = useState<string | null>(null)

  if (isLoading) return <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
  if (error)     return <p className="text-red-400 text-sm">{t('common.error')}</p>

  async function handleDeactivate(kioskId: string) {
    await deactivate.mutateAsync(kioskId)
    setConfirmDeactivateId(null)
  }

  return (
    <div>
      <PageHeader
        title={t('kiosks.title')}
        action={
          <button
            onClick={() => setShowProvision(true)}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
          >
            + {t('kiosks.new_kiosk')}
          </button>
        }
      />

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('kiosks.kiosk_name')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('kiosks.zone')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Section</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('kiosks.last_seen')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('kiosks.status')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(kiosks ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  {t('common.no_data')}
                </td>
              </tr>
            )}
            {(kiosks ?? []).map(k => {
              const isOnline = k.last_seen_at
                ? Date.now() - new Date(k.last_seen_at).getTime() < 10 * 60 * 1000
                : false

              return (
                <tr key={k.kiosk_id} className="border-b border-border last:border-0 hover:bg-secondary/50">
                  <td className="px-4 py-3 font-medium text-foreground">{k.kiosk_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{k.zones?.zone_name ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{k.zones?.product_section ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {k.last_seen_at ? formatDate(k.last_seen_at) : t('kiosks.never_seen')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        status={k.is_active ? 'active' : 'expired'}
                        label={k.is_active ? 'Active' : 'Inactive'}
                      />
                      {k.is_active && (
                        <StatusBadge
                          status={isOnline ? 'online' : 'offline'}
                          label={isOnline ? 'Online' : 'Offline'}
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {k.is_active && (
                      <button
                        onClick={() => setConfirmDeactivateId(k.kiosk_id)}
                        className="text-xs text-red-400 hover:text-red-300 focus:outline-none focus:underline"
                      >
                        {t('common.deactivate')}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Provision dialog */}
      {showProvision && (
        <KioskProvisionDialog
          onClose={() => setShowProvision(false)}
          onProvisioned={result => {
            setShowProvision(false)
            setCredentials(result)
          }}
        />
      )}

      {/* Credentials shown once */}
      {credentials && (
        <KioskCredentialsDialog
          credentials={credentials}
          onClose={() => setCredentials(null)}
        />
      )}

      {/* Deactivate confirm */}
      {confirmDeactivateId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full mx-4">
            <p className="text-sm text-foreground mb-6">{t('kiosks.confirm_deactivate')}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeactivateId(null)}
                className="flex-1 h-10 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleDeactivate(confirmDeactivateId)}
                disabled={deactivate.isPending}
                className="flex-1 h-10 rounded-md bg-red-600 text-white text-sm font-medium disabled:opacity-50"
              >
                {t('common.deactivate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
