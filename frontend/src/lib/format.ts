const euro = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

const longDate = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long' })
const longDateWithYear = new Intl.DateTimeFormat('it-IT', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function formatEuro(amount: number): string {
  return euro.format(amount)
}

/** "2026-12-20" → Date a mezzanotte locale (senza slittamenti di fuso). */
export function parseDay(isoDay: string): Date {
  const [year, month, day] = isoDay.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatDay(isoDay: string): string {
  const date = parseDay(isoDay)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return (sameYear ? longDate : longDateWithYear).format(date)
}

export function daysUntil(isoDay: string, now = new Date()): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((parseDay(isoDay).getTime() - today.getTime()) / 86_400_000)
}

export function exchangeCountdown(isoDay: string): string {
  const days = daysUntil(isoDay)
  if (days > 1) return `Mancano ${days} giorni allo scambio dei regali`
  if (days === 1) return 'Lo scambio dei regali è domani'
  if (days === 0) return 'Lo scambio dei regali è oggi'
  return `Lo scambio dei regali c'è stato il ${formatDay(isoDay)}`
}

export function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat('it-IT', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

/** Scurisce un colore hex: serve per bordi e ombre degli omini. */
export function shade(hex: string, amount: number): string {
  const value = parseInt(hex.slice(1), 16)
  const channel = (shift: number) =>
    Math.max(0, Math.min(255, Math.round(((value >> shift) & 255) * (1 - amount))))
  return `#${[16, 8, 0].map((s) => channel(s).toString(16).padStart(2, '0')).join('')}`
}

export const PALETTE = [
  '#C0392B',
  '#1E8449',
  '#D4A017',
  '#2E86C1',
  '#8E44AD',
  '#E67E22',
  '#16A085',
  '#C2185B',
  '#6D4C41',
  '#5D6D7E',
  '#AF7AC5',
  '#F1948A',
]
