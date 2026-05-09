import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/hooks/use-auth'

type SideNavProps = { role: UserRole }

const ADMIN_LINKS = [
  { to: '/',        label: 'nav.dashboard' },
  { to: '/zones',   label: 'nav.zones' },
  { to: '/kiosks',  label: 'nav.kiosks' },
  { to: '/tokens',  label: 'nav.tokens' },
  { to: '/export',  label: 'nav.export' },
]

const MD_LINKS = [
  { to: '/md-view',          label: 'nav.md_view' },
  { to: '/md-view/heatmap',  label: 'nav.heatmap' },
  { to: '/md-view/trends',   label: 'nav.trends' },
  { to: '/export',           label: 'nav.export' },
]

export function SideNav({ role }: SideNavProps) {
  const navigate = useNavigate()
  const links = role === 'md' ? MD_LINKS : ADMIN_LINKS

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <nav
      className="w-52 shrink-0 flex flex-col border-r border-border bg-card px-3 py-4"
      aria-label="Main navigation"
    >
      {/* Store logo */}
      <div className="px-2 mb-6">
        <img
          src="/logo.svg"
          alt="The Chennai Silks"
          className="h-8 w-auto object-contain"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement
            target.style.display = 'none'
            const fallback = target.nextElementSibling as HTMLElement
            if (fallback) fallback.style.display = 'block'
          }}
        />
        <p className="text-sm font-semibold text-foreground hidden">{t('common.store_name')}</p>
        {role === 'md' && (
          <p className="text-xs text-muted-foreground mt-0.5">{t('md.role_label')}</p>
        )}
      </div>

      {/* Links */}
      <ul className="flex-1 space-y-1" role="list">
        {links.map(link => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) =>
                cn(
                  'block px-3 py-2 rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring',
                  isActive
                    ? 'bg-primary/15 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                )
              }
            >
              {t(link.label)}
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        className="mt-4 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-secondary text-left transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {t('nav.logout')}
      </button>
    </nav>
  )
}
