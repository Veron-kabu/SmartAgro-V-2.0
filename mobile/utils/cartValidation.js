import { getJSON } from '../context/api'

// validateCartItems performs bulk fetch (if possible) and returns { adjustments, validated, total }
// adjustments: array describing changes
// validated: array of { id, price, quantity, removed }
export async function validateCartItems(items, { updatePrices = false } = {}) {
  if (!items.length) return { adjustments: [], validated: [], total: 0 }
  const ids = items.map(i => i.id).filter(Boolean)
  let products = []
  try {
    const bulk = await getJSON(`/api/products/bulk?ids=${ids.join(',')}`)
    if (Array.isArray(bulk)) products = bulk
  } catch {
    // fallback: per-item fetch (optional improvement)
    for (const id of ids) {
      try { const p = await getJSON(`/api/products/${id}`); if (p) products.push(p) } catch {}
    }
  }
  const map = new Map(products.map(p => [p.id, p]))
  const adjustments = []
  const validated = []
  let total = 0
  for (const it of items) {
    const fresh = map.get(it.id)
    if (!fresh) {
      adjustments.push({ id: it.id, type: 'removed', reason: 'No longer available', code: 'deleted' })
      validated.push({ ...it, removed: true, removalCode: 'deleted' })
      continue
    }
    if (fresh.status !== 'active') {
      adjustments.push({ id: it.id, type: 'removed', reason: 'Listing inactive', code: 'inactive' })
      validated.push({ ...it, removed: true, removalCode: 'inactive' })
      continue
    }
    let qty = it.quantity
    if (fresh.quantityAvailable <= 0) {
      adjustments.push({ id: it.id, type: 'removed', reason: 'Out of stock', code: 'out_of_stock' })
      validated.push({ ...it, removed: true, removalCode: 'out_of_stock' })
      continue
    }
    if (qty > fresh.quantityAvailable) {
      qty = fresh.quantityAvailable
      adjustments.push({ id: it.id, type: 'quantity', newQuantity: qty, reason: 'Clamped to stock', code: 'quantity_clamp' })
    }
    const freshPrice = Number(fresh.price) || 0
    let price = it.price
    if (freshPrice !== it.price) {
      adjustments.push({ id: it.id, type: 'price', oldPrice: it.price, newPrice: freshPrice, code: 'price_change' })
      if (updatePrices) price = freshPrice
    }
    total += (updatePrices ? freshPrice : price) * qty
    validated.push({ ...it, price: updatePrices ? freshPrice : price, quantity: qty })
  }
  return { adjustments, validated, total }
}
