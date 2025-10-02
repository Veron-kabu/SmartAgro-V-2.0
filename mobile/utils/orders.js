// Shared business logic for Orders screens (kept outside app/ to avoid expo-router route warnings)

export function formatCurrency(amount) {
  const n = Number(amount || 0)
  return `$${n.toFixed(2)}`
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
  if (['pending', 'in_progress', 'accepted', 'processing', 'shipped'].includes(s)) return { bg: '#dbeafe', fg: '#1d4ed8' }
  if (['completed', 'delivered'].includes(s)) return { bg: '#dcfce7', fg: '#16a34a' }
  if (['cancelled', 'rejected', 'failed'].includes(s)) return { bg: '#fee2e2', fg: '#b91c1c' }
  return { bg: '#e5e7eb', fg: '#374151' }
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
export const ORDER_STATUS_FLOW = ['pending','accepted','shipped','delivered']

export function nextStatusesFor(status) {
  const s = (status || '').toLowerCase()
  switch (s) {
    case 'pending': return ['accepted','rejected']
    case 'accepted': return ['shipped','cancelled']
    case 'shipped': return ['delivered']
    default: return []
  }
}
