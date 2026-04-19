import { cn, pulseTextColor } from '@/lib/utils'

type EmotionPulseBarProps = {
  label: string
  happy: number    // percentage 0-100
  neutral: number
  unhappy: number
}

export function EmotionPulseBar({ label, happy, neutral, unhappy }: EmotionPulseBarProps) {
  // Clamp values: ensure they sum to ~100
  const total = happy + neutral + unhappy
  const h = total > 0 ? (happy   / total) * 100 : 0
  const n = total > 0 ? (neutral / total) * 100 : 0
  const u = total > 0 ? (unhappy / total) * 100 : 0

  return (
    <div className="flex items-center gap-3 mb-2">
      <span className="w-[90px] text-xs text-muted-foreground text-right shrink-0 truncate">
        {label}
      </span>
      <div className="flex-1 h-5 flex rounded overflow-hidden bg-muted">
        {h > 0 && (
          <div
            className="h-full bg-green-500 transition-[width] duration-300"
            style={{ width: `${h}%` }}
            aria-label={`Happy ${Math.round(h)}%`}
          />
        )}
        {n > 0 && (
          <div
            className="h-full bg-amber-400 transition-[width] duration-300"
            style={{ width: `${n}%` }}
            aria-label={`Okay ${Math.round(n)}%`}
          />
        )}
        {u > 0 && (
          <div
            className="h-full bg-red-500 transition-[width] duration-300"
            style={{ width: `${u}%` }}
            aria-label={`Unhappy ${Math.round(u)}%`}
          />
        )}
      </div>
      {/* Always show happy % — consistent with specs */}
      <span className={cn('w-10 text-xs text-right shrink-0 font-medium', pulseTextColor(happy))}>
        {Math.round(happy)}%
      </span>
    </div>
  )
}
