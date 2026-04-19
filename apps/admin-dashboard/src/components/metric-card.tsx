import { cn } from '@/lib/utils'

type MetricCardProps = {
  label: string
  value: string | number
  subtitle?: string
  valueClassName?: string
}

export function MetricCard({ label, value, subtitle, valueClassName }: MetricCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={cn('text-2xl font-semibold text-foreground', valueClassName)}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  )
}
