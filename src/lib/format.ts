const nf = (digits: number) =>
  new Intl.NumberFormat('el-GR', { maximumFractionDigits: digits, minimumFractionDigits: 0 })

const cache = new Map<number, Intl.NumberFormat>()

/** Greek number format (comma decimals). Returns '—' for missing values. */
export function num(v: number | null | undefined, digits = 1): string {
  if (v == null || Number.isNaN(v)) return '—'
  let f = cache.get(digits)
  if (!f) cache.set(digits, (f = nf(digits)))
  return f.format(v)
}

export function signed(v: number | null | undefined, digits = 1): string {
  if (v == null || Number.isNaN(v)) return '—'
  return (v > 0 ? '+' : '') + num(v, digits)
}

/** Parses user input accepting both "82,5" and "82.5". Empty → null. */
export function parseNum(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
