import { useState } from 'react'
import { t } from '@/lib/i18n'
import { formatTTL, formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'
import { useActiveTokens, useRevokeToken } from '@/hooks/use-tokens'

export function TokenManagementPage() {
  const { data: tokens, isLoading, error } = useActiveTokens()
  const revoke = useRevokeToken()
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  async function handleRevoke(tokenId: string) {
    await revoke.mutateAsync(tokenId)
    setConfirmId(null)
    setSuccessMsg(t('tokens.revoked'))
    setTimeout(() => setSuccessMsg(null), 3000)
  }

  if (isLoading) return <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
  if (error)     return <p className="text-red-400 text-sm">{t('common.error')}</p>

  return (
    <div>
      <PageHeader title={t('tokens.title')} />

      {successMsg && (
        <p className="mb-4 text-sm text-green-400" role="status">{successMsg}</p>
      )}

      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Token ID</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('tokens.zone')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('tokens.created')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('tokens.ttl_remaining')}</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">{t('tokens.status')}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {(tokens ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  No active tokens.
                </td>
              </tr>
            )}
            {(tokens ?? []).map(tok => (
              <tr key={tok.token_id} className="border-b border-border last:border-0 hover:bg-secondary/50">
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {tok.token_id.slice(0, 8)}…
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {tok.zones?.zone_name ?? '—'}
                  <span className="ml-1 text-xs text-muted-foreground/60 capitalize">
                    ({tok.zones?.zone_type})
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{formatDate(tok.created_at)}</td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                  {formatTTL(tok.expires_at)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={tok.status} label={t(`tokens.${tok.status === 'active' ? 'active' : tok.status}`)} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setConfirmId(tok.token_id)}
                    className="text-xs text-red-400 hover:text-red-300 focus:outline-none focus:underline"
                    aria-label={`Revoke token ${tok.token_id.slice(0, 8)}`}
                  >
                    {t('common.revoke')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confirm revoke */}
      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          role="dialog" aria-modal="true">
          <div className="bg-card border border-border rounded-xl p-6 max-w-sm w-full mx-4">
            <p className="text-sm text-foreground mb-6">{t('tokens.revoke_confirm')}</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmId(null)}
                className="flex-1 h-10 rounded-md border border-border text-sm text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                {t('common.cancel')}
              </button>
              <button
                onClick={() => handleRevoke(confirmId)}
                disabled={revoke.isPending}
                className="flex-1 h-10 rounded-md bg-red-600 text-white text-sm font-medium disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {t('common.revoke')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
