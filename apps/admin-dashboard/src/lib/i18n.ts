import en from '@/locales/en.json'

export function t(key: string, params?: Record<string, string | number>): string {
  const keys = key.split('.')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = en
  for (const k of keys) {
    value = value?.[k]
  }
  if (typeof value !== 'string') return key
  if (!params) return value
  return Object.entries(params).reduce(
    (str, [k, v]) => str.replace(`{${k}}`, String(v)),
    value
  )
}
