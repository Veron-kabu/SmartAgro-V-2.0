import { ENV } from "../config/env.js"
import crypto from "crypto"
import fs from "fs"
import path from "path"

const DARAJA_BASE = ENV.MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke'

const OAUTH_URL = `${DARAJA_BASE}/oauth/v1/generate?grant_type=client_credentials`
const STK_PROCESS_URL = `${DARAJA_BASE}/mpesa/stkpush/v1/processrequest`
const STK_QUERY_URL = `${DARAJA_BASE}/mpesa/stkpushquery/v1/query`
const B2C_URL = `${DARAJA_BASE}/mpesa/b2c/v1/paymentrequest`
const TRANS_STATUS_URL = `${DARAJA_BASE}/mpesa/transactionstatus/v1/query`
const ACCOUNT_BAL_URL = `${DARAJA_BASE}/mpesa/accountbalance/v1/query`
const REVERSAL_URL = `${DARAJA_BASE}/mpesa/reversal/v1/request`
const C2B_REGISTER_URL = `${DARAJA_BASE}/mpesa/c2b/v1/registerurl`

let tokenCache = { accessToken: null, expiresAt: 0 }

function base64(str) {
  return Buffer.from(str).toString('base64')
}

function getTimestamp() {
  const dt = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return (
    dt.getFullYear().toString() +
    pad(dt.getMonth() + 1) +
    pad(dt.getDate()) +
    pad(dt.getHours()) +
    pad(dt.getMinutes()) +
    pad(dt.getSeconds())
  )
}

function getCallbacks() {
  const base = ENV.MPESA_CALLBACK_BASE_URL || `${ENV.API_URL}/api/mpesa/callbacks`
  return {
    stk: `${base}/stk`,
    result: `${base}/result`,
    timeout: `${base}/timeout`,
    c2bConfirmation: `${base}/c2b/confirmation`,
    c2bValidation: `${base}/c2b/validation`,
  }
}

export async function getAccessToken() {
  const now = Date.now()
  if (tokenCache.accessToken && now < tokenCache.expiresAt) return tokenCache.accessToken
  if (!ENV.MPESA_CONSUMER_KEY || !ENV.MPESA_CONSUMER_SECRET) {
    throw new Error('M-Pesa consumer key/secret missing in env')
  }
  const auth = base64(`${ENV.MPESA_CONSUMER_KEY}:${ENV.MPESA_CONSUMER_SECRET}`)
  const res = await fetch(OAUTH_URL, {
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Failed to get access token: ${res.status} ${res.statusText} ${text}`)
  }
  const data = await res.json()
  const ttl = Math.max(0, (data.expires_in || 3500) - 60) // seconds
  tokenCache = { accessToken: data.access_token, expiresAt: now + ttl * 1000 }
  return tokenCache.accessToken
}

export function encryptSecurityCredential(initiatorPassword = ENV.MPESA_INITIATOR_PASSWORD) {
  if (!initiatorPassword) throw new Error('MPESA_INITIATOR_PASSWORD missing')
  const certPath = path.resolve(ENV.MPESA_CERT_PATH)
  const cert = fs.readFileSync(certPath, 'utf8')
  const encrypted = crypto.publicEncrypt({ key: cert, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(initiatorPassword))
  return encrypted.toString('base64')
}

export async function stkPush({ phone, amount, accountReference = 'SmartAgro', transactionDesc = 'Payment', shortcode = ENV.MPESA_SHORTCODE }) {
  if (!ENV.MPESA_PASSKEY) throw new Error('MPESA_PASSKEY missing')
  if (!shortcode) throw new Error('MPESA_SHORTCODE missing')
  const token = await getAccessToken()
  const Timestamp = getTimestamp()
  const Password = base64(`${shortcode}${ENV.MPESA_PASSKEY}${Timestamp}`)
  const body = {
    BusinessShortCode: shortcode,
    Password,
    Timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Number(amount),
    PartyA: phone,
    PartyB: shortcode,
    PhoneNumber: phone,
    CallBackURL: getCallbacks().stk,
    AccountReference: accountReference,
    TransactionDesc: transactionDesc,
  }
  const res = await fetch(STK_PROCESS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { raw: text } }
  if (!res.ok) {
    const message = json?.errorMessage || res.statusText
    const err = new Error(`STK push failed: ${res.status} ${message}`)
    err.body = json
    throw err
  }
  return json
}

export async function stkQuery({ checkoutRequestID, shortcode = ENV.MPESA_SHORTCODE }) {
  const token = await getAccessToken()
  const Timestamp = getTimestamp()
  const Password = base64(`${shortcode}${ENV.MPESA_PASSKEY}${Timestamp}`)
  const body = {
    BusinessShortCode: shortcode,
    Password,
    Timestamp,
    CheckoutRequestID: checkoutRequestID,
  }
  const res = await fetch(STK_QUERY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(async () => ({ raw: await res.text() }))
  if (!res.ok) {
    const err = new Error(`STK query failed: ${res.status} ${res.statusText}`)
    err.body = data
    throw err
  }
  return data
}

export async function b2cPayment({ phone, amount, commandID = 'BusinessPayment', remarks = 'Payout', occasion = 'Payout', shortcode = ENV.MPESA_B2C_SHORTCODE }) {
  const token = await getAccessToken()
  const SecurityCredential = encryptSecurityCredential()
  const callbacks = getCallbacks()
  const body = {
    InitiatorName: ENV.MPESA_INITIATOR_NAME,
    SecurityCredential,
    CommandID: commandID,
    Amount: Number(amount),
    PartyA: shortcode,
    PartyB: phone,
    Remarks: remarks,
    QueueTimeOutURL: callbacks.timeout,
    ResultURL: callbacks.result,
    Occasion: occasion,
  }
  const res = await fetch(B2C_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(async () => ({ raw: await res.text() }))
  if (!res.ok) {
    const err = new Error(`B2C request failed: ${res.status} ${res.statusText}`)
    err.body = data
    throw err
  }
  return data
}

export async function transactionStatus({ transactionId, partyA = ENV.MPESA_SHORTCODE, identifierType = '4', remarks = 'OK', occasion = 'OK' }) {
  const token = await getAccessToken()
  const SecurityCredential = encryptSecurityCredential()
  const callbacks = getCallbacks()
  const body = {
    Initiator: ENV.MPESA_INITIATOR_NAME,
    SecurityCredential,
    CommandID: 'TransactionStatusQuery',
    TransactionID: transactionId,
    PartyA: partyA,
    IdentifierType: String(identifierType),
    ResultURL: callbacks.result,
    QueueTimeOutURL: callbacks.timeout,
    Remarks: remarks,
    Occasion: occasion,
  }
  const res = await fetch(TRANS_STATUS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(async () => ({ raw: await res.text() }))
  if (!res.ok) {
    const err = new Error(`Transaction status failed: ${res.status} ${res.statusText}`)
    err.body = data
    throw err
  }
  return data
}

export async function accountBalance({ partyA = ENV.MPESA_SHORTCODE, identifierType = '4', remarks = 'OK' } = {}) {
  const token = await getAccessToken()
  const SecurityCredential = encryptSecurityCredential()
  const callbacks = getCallbacks()
  const body = {
    Initiator: ENV.MPESA_INITIATOR_NAME,
    SecurityCredential,
    CommandID: 'AccountBalance',
    PartyA: partyA,
    IdentifierType: String(identifierType),
    Remarks: remarks,
    ResultURL: callbacks.result,
    QueueTimeOutURL: callbacks.timeout,
  }
  const res = await fetch(ACCOUNT_BAL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(async () => ({ raw: await res.text() }))
  if (!res.ok) {
    const err = new Error(`Account balance failed: ${res.status} ${res.statusText}`)
    err.body = data
    throw err
  }
  return data
}

export async function reversal({ transactionId, amount, receiverParty, receiverIdentifierType = '11', remarks = 'Reversal', occasion = 'Reversal', initiatorName = ENV.MPESA_INITIATOR_NAME }) {
  const token = await getAccessToken()
  const SecurityCredential = encryptSecurityCredential()
  const callbacks = getCallbacks()
  const body = {
    Initiator: initiatorName,
    SecurityCredential,
    CommandID: 'TransactionReversal',
    TransactionID: transactionId,
    Amount: Number(amount),
    ReceiverParty: receiverParty,
    RecieverIdentifierType: String(receiverIdentifierType),
    QueueTimeOutURL: callbacks.timeout,
    ResultURL: callbacks.result,
    Remarks: remarks,
    Occasion: occasion,
  }
  const res = await fetch(REVERSAL_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(async () => ({ raw: await res.text() }))
  if (!res.ok) {
    const err = new Error(`Reversal failed: ${res.status} ${res.statusText}`)
    err.body = data
    throw err
  }
  return data
}

export async function registerC2B({ shortCode = ENV.MPESA_SHORTCODE, responseType = 'Completed' } = {}) {
  const token = await getAccessToken()
  const callbacks = getCallbacks()
  const body = {
    ShortCode: shortCode,
    ResponseType: responseType,
    ConfirmationURL: callbacks.c2bConfirmation,
    ValidationURL: callbacks.c2bValidation,
  }
  const res = await fetch(C2B_REGISTER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(async () => ({ raw: await res.text() }))
  if (!res.ok) {
    const err = new Error(`C2B register failed: ${res.status} ${res.statusText}`)
    err.body = data
    throw err
  }
  return data
}
