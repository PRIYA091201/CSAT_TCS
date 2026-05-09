import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { t } from '@/lib/i18n'

// Known admin accounts — used to auto-set user_metadata.role on first login
// This is the MVP fallback while app_metadata is configured via SQL
const ROLE_MAP: Record<string, 'admin' | 'md'> = {
  'admin@chennaisilks.com': 'admin',
  'md@chennaisilks.com':    'md',
}

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (authError || !data.user) {
      setError(t('auth.invalid_credentials'))
      setLoading(false)
      return
    }

    // If role missing from app_metadata, set it in user_metadata as fallback
    const appRole = data.user.app_metadata?.role
    const metaRole = data.user.user_metadata?.role
    const knownRole = ROLE_MAP[email.trim().toLowerCase()]

    if (!appRole && !metaRole && knownRole) {
      await supabase.auth.updateUser({
        data: { role: knownRole },
      })
    }

    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">

        {/* Store name header */}
        <div className="mb-8 text-center">
          <img src="/logo.png" alt="The Chennai Silks" className="w-16 h-16 mx-auto mb-4 object-contain" />
          <h1 className="text-xl font-semibold text-foreground">{t('auth.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('auth.subtitle')}</p>
        </div>

        {/* Login form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              {t('auth.email')}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full h-11 px-3 rounded-md bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm transition-colors"
              placeholder="admin@chennaisilks.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              {t('auth.password')}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full h-11 px-3 rounded-md bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-sm transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-md bg-red-500/10 border border-red-500/30 px-3 py-2">
              <p className="text-sm text-red-400" role="alert">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-md bg-primary text-primary-foreground font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                {t('auth.signing_in')}
              </span>
            ) : t('auth.sign_in')}
          </button>
        </form>

      </div>
    </div>
  )
}
