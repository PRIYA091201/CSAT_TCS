import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

// Format a percentage value for display
export function formatPct(value: number): string {
  return `${Math.round(value)}%`
}

// Format a number with comma separators
export function formatCount(value: number): string {
  return value.toLocaleString('en-IN')
}

// Format a date for display (IST)
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

// Format remaining TTL from an ISO expiry string
export function formatTTL(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const mins = Math.floor(ms / 60_000)
  const secs = Math.floor((ms % 60_000) / 1000)
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`
}

// Derive heatmap colour class from happy %
export function heatmapColor(happyPct: number): { bg: string; text: string } {
  if (happyPct >= 60) return { bg: 'bg-green-950', text: 'text-green-400' }
  if (happyPct >= 40) return { bg: 'bg-amber-950', text: 'text-amber-400' }
  return { bg: 'bg-red-950', text: 'text-red-400' }
}

// Derive pulse bar text colour from happy %
export function pulseTextColor(happyPct: number): string {
  if (happyPct >= 60) return 'text-green-400'
  if (happyPct >= 40) return 'text-amber-400'
  return 'text-red-400'
}
