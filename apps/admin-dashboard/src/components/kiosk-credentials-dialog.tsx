import { useState } from 'react'
import { t } from '@/lib/i18n'
import type { ProvisionResult } from '@/hooks/use-kiosks'

type Props = { credentials: ProvisionResult; onClose: () => void }

export function KioskCredentialsDialog({ credentials, onClose }: Props) {
  const [copied, setCopied] = useState(false)

  function copyAll() {
    const text = `Email: ${credentials.email}\nPassword: ${credentials.password}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog" aria-modal="true" aria-label={t('kiosks.credentials_title')}>
      <div className="bg-card border border-border rounded-xl w-full max-w-md p-6 shadow-xl">
        <h2 className="text-base font-semibold text-foreground mb-1">{t('kiosks.credentials_title')}</h2>
        <p className="text-sm text-amber-400 mb-5">{t('kiosks.credentials_note')}</p>

        <div className="space-y-3 mb-6">
          <div className="bg-secondary rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">{t('kiosks.email_label')}</p>
            <p className="text-sm font-mono text-foreground break-all">{credentials.email}</p>
          </div>
          <div className="bg-secondary rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">{t('kiosks.password_label')}</p>
            <p className="text-sm font-mono text-foreground break-all">{credentials.password}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={copyAll}
            className="flex-1 h-10 rounded-md border border-border text-sm text-foreground hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {copied ? 'Copied!' : 'Copy credentials'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-md bg-primary text-primary-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
