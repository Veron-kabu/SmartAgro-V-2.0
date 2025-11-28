import { COLORS } from '../constants/colors'
// Shared business logic for Orders screens (kept outside app/ to avoid expo-router route warnings)

export function formatCurrency(amount) {
  const n = Number(amount || 0)
  return `Ksh ${n.toFixed(2)}`
}

export function formatDate(iso) {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString()
  } catch {
    return iso || ''
  }
}

export function statusBadgeColor(status) {
  const s = (status || '').toLowerCase()
  if (s === 'paused') return { bg: COLORS.inputBackground, fg: COLORS.warning }
  if (['pending', 'in_progress', 'accepted', 'processing', 'paid', 'shipped'].includes(s)) return { bg: COLORS.inputBackground, fg: COLORS.primary }
  if (['completed', 'delivered'].includes(s)) return { bg: COLORS.errorLight, fg: COLORS.online }
  if (['cancelled', 'rejected', 'failed'].includes(s)) return { bg: COLORS.errorLight, fg: COLORS.error }
  return { bg: COLORS.divider, fg: COLORS.text }
}

export function groupOrders(orders = []) {
  const current = []
  const completed = []
  for (const o of orders) {
    const s = (o.status || '').toLowerCase()
    if (['completed', 'delivered'].includes(s)) completed.push(o)
    else current.push(o)
  }
  return { current, completed }
}

// Canonical status pipeline (farmer side)
// pending -> accepted -> shipped -> delivered
// Rejected / cancelled are terminal off-ramps
export const ORDER_STATUS_FLOW = ['pending','paid','shipped','delivered']

export function nextStatusesFor(status, paymentStatus) {
  const s = (status || '').toLowerCase()
  const p = (paymentStatus || '').toLowerCase()
  // No accept/reject; ship only after paid
  if (s === 'pending') return p === 'paid' ? ['shipped'] : []
  if (s === 'paid') return ['shipped']
  if (s === 'shipped') return ['delivered']
  return []
}
