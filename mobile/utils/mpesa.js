import { postJSON, getJSON } from "../context/api"

// Initiate STK Push from mobile
export async function initiateStkPush({ phone, amount, orderId, accountReference = 'SmartAgro', transactionDesc = 'Payment' }) {
  return postJSON('/api/mpesa/stkpush', { phone, amount, orderId, accountReference, transactionDesc })
}

// Query STK Push status
export async function getStkStatus(checkoutRequestID) {
  return getJSON(`/api/mpesa/stk-status/${encodeURIComponent(checkoutRequestID)}`)
}

// Request B2C cashout (if allowed from mobile)
export async function requestCashout({ phone, amount, commandID = 'BusinessPayment', remarks = 'Payout', occasion = 'Payout' }) {
  return postJSON('/api/mpesa/b2c', { phone, amount, commandID, remarks, occasion })
}

// Query transaction status by TransactionID (Mpesa Receipt)
export async function getTransactionStatus(transactionId) {
  return getJSON(`/api/mpesa/transaction-status/${encodeURIComponent(transactionId)}`)
}

// High-level helper to pay for an order and optionally poll for status
// Params:
// - order: { id, totalAmount }
// - options: { phone, onProgress?: (msg) => void, poll?: boolean, intervalMs?: number, maxAttempts?: number }
// Returns: { status: 'success'|'failed'|'pending', checkoutRequestID, result?: any }
export async function payForOrder(order, options = {}) {
  const { phone, onProgress, poll = true, intervalMs = 3000, maxAttempts = 30 } = options
  const amount = Number(order?.totalAmount || 0)
  if (!order?.id || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid order payload for payment')
  }
  if (!phone) throw new Error('Missing phone number')
  onProgress?.('Sending STK push…')
  const resp = await initiateStkPush({ phone, amount, orderId: order.id, accountReference: 'SmartAgro', transactionDesc: `Order #${order.id}` })
  const checkoutRequestID = resp?.checkoutRequestID || resp?.CheckoutRequestID
  if (!checkoutRequestID) throw Object.assign(new Error('Failed to initiate payment'), { body: resp })
  if (!poll) return { status: 'pending', checkoutRequestID }
  onProgress?.('Check your phone and enter M-Pesa PIN…')
  let attempts = 0
  while (attempts < maxAttempts) {
    attempts += 1
    try {
      const q = await getStkStatus(checkoutRequestID)
      const code = String(q?.ResultCode ?? q?.resultCode ?? '')
      if (code === '0') return { status: 'success', checkoutRequestID, result: q }
      if (['1032','1037','1','2001','2002'].includes(code)) return { status: 'failed', checkoutRequestID, result: q }
    } catch {}
    await new Promise(r => setTimeout(r, intervalMs))
  }
  return { status: 'pending', checkoutRequestID }
}
