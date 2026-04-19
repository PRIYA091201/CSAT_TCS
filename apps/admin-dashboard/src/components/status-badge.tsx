import { cn } from '@/lib/utils'

type Status = 'active' | 'used' | 'expired' | 'revoked' | 'online' | 'offline'

const STATUS_STYLES: Record<Status, string> = {
  active:  'bg-green-500/15 text-green-400 border-green-500/30',
  used:    'bg-blue-500/15  text-blue-400  border-blue-500/30',
  expired: 'bg-muted        text-muted-foreground border-border',
  revoked: 'bg-red-500/15   text-red-400   border-red-500/30',
  online:  'bg-green-500/15 text-green-400 border-green-500/30',
  offline: 'bg-muted        text-muted-foreground border-border',
}

type StatusBadgeProps = { status: Status; label?: string }

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const display = label ?? status.charAt(0).toUpperCase() + status.slice(1)
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
      STATUS_STYLES[status]
    )}>
      {display}
    </span>
  )
}
