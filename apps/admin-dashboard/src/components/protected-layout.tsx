import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { SideNav } from '@/components/side-nav'
import { t } from '@/lib/i18n'

export function ProtectedLayout() {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-muted-foreground text-sm">
        {t('common.loading')}
      </div>
    )
  }

  // Not logged in at all → login page
  if (!user) return <Navigate to="/login" replace />

  // Logged in but role is not admin or md (e.g. kiosk user somehow) → login
  if (role !== 'admin' && role !== 'md') {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <SideNav role={role} />
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
