export function formatMoney(n: number): string {
  return 'RM ' + (Number(n) || 0).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(ts: string | null | undefined): string {
  if (!ts) return '—'
  const dt = new Date(ts)
  return (
    dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
    ' · ' +
    dt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  )
}

export function isLowStock(remaining: number, stock: number): boolean {
  return remaining > 0 && remaining <= Math.max(3, Math.round(stock * 0.15))
}

export const LOW_STOCK_MIN = 3
export const LOW_STOCK_RATIO = 0.15
export const PRODUCT_CATEGORIES = ['Beverage', 'Food', 'Merch']
export const PAYMENT_METHODS: string[] = ['Cash', 'Transfer', 'E-Wallet', 'Other']

const PALETTE = ['violet', 'pink', 'mint', 'amber']

export function categoryColorClass(cat: string): string {
  let hash = 0
  const s = String(cat || 'Other')
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  return 'tag-' + PALETTE[hash % PALETTE.length]
}
