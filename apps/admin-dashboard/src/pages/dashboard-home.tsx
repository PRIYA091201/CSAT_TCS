import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useZones } from '@/hooks/use-zones'
import { t } from '@/lib/i18n'
import { PageHeader } from '@/components/page-header'
import { StatusBadge } from '@/components/status-badge'

export function DashboardHome() {
  const { role } = useAuth()
  const { data: zones, isLoading } = useZones()

  // MD users always land on cross-zone overview — proper React Router redirect
  if (role === 'md') {
    return <Navigate to="/md-view" replace />
  }

  return (
    <div>
      <PageHeader
        title={t('common.store_name')}
        subtitle="Store Admin — select a zone to view its dashboard"
        action={
          <Link
            to="/zones"
            className="px-4 py-2 rounded-md bg-secondary border border-border text-sm text-foreground hover:bg-card transition-colors"
          >
            Manage zones →
          </Link>
        }
      />

      {isLoading && (
        <p className="text-muted-foreground text-sm">{t('common.loading')}</p>
      )}

      <div className="grid grid-cols-2 gap-4 mt-2">
        {(zones ?? []).map(zone => (
          <Link
            key={zone.zone_id}
            to={`/zones/${zone.zone_id}`}
            className="block bg-card border border-border rounded-lg p-4 hover:border-primary/50 transition-colors focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <div className="flex items-start justify-between mb-2">
              <p className="text-sm font-semibold text-foreground">{zone.zone_name}</p>
              <StatusBadge
                status={zone.is_active ? 'active' : 'expired'}
                label={zone.is_active ? 'Active' : 'Inactive'}
              />
            </div>
            <p className="text-xs text-muted-foreground capitalize">{zone.zone_type} zone</p>
            {zone.product_section && (
              <p className="text-xs text-muted-foreground mt-0.5">Section: {zone.product_section}</p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">TTL: {zone.token_ttl_min} min</p>
          </Link>
        ))}

        {!isLoading && (zones ?? []).length === 0 && (
          <div className="col-span-2 bg-card border border-border rounded-lg p-8 text-center">
            <p className="text-sm text-muted-foreground mb-3">No zones configured yet.</p>
            <Link
              to="/zones"
              className="inline-flex px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
            >
              Create your first zone
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
