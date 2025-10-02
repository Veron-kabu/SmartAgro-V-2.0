// Simple analytics abstraction; swap implementation later.
// Usage: import { track } from '../utils/analytics'

import { resolveUrl } from '../context/api'
import AsyncStorage from '@react-native-async-storage/async-storage'

const listeners = new Set()
let buffer = []
let flushTimer = null
const BATCH_SIZE = 20
const FLUSH_INTERVAL = 5000
const STORAGE_KEY = 'analytics:pending'
let restoring = false

async function restorePending() {
  if (restoring) return
  restoring = true
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.length) buffer.push(...arr)
    }
  } catch {}
  restoring = false
}
restorePending()

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => { flushTimer = null; flush() }, FLUSH_INTERVAL)
}

export function track(event, payload = {}) {
  const evt = { event, payload, ts: Date.now() }
  buffer.push(evt)
  listeners.forEach(cb => { try { cb(event, payload) } catch {} })
  if (buffer.length >= BATCH_SIZE) flush()
  else scheduleFlush()
  persist()
}

async function persist() {
  try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(buffer.slice(-200))) } catch {}
}

export async function flush() {
  if (!buffer.length) return
  const batch = buffer.splice(0, BATCH_SIZE)
  persist()
  try {
    await fetch(resolveUrl('/api/analytics/events'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch })
    })
  } catch {
    // put back on failure
    buffer = [...batch, ...buffer]
    persist()
  }
}

export function onTrack(callback) {
  listeners.add(callback)
  return () => listeners.delete(callback)
}
