#!/usr/bin/env node
// Simple cron ping script used by Render Cron Jobs to verify backend health
// Exits 0 on success (healthy), non-zero on failure so Render marks the run accordingly.

const apiUrl = process.env.API_URL || process.env.PUBLIC_BASE_URL

if (!apiUrl) {
  console.error('❌ API_URL not set. Set API_URL in the environment for this cron job.')
  process.exit(2)
}

const url = apiUrl.endsWith('/') ? `${apiUrl}health` : `${apiUrl}/health`

try {
  const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' } })
  if (res.ok) {
    // Log a precise message expected to appear in Render cron logs every run
    console.log('✅ Backend-alive')
    process.exit(0)
  } else {
    console.error('❌ Backend health check returned status', res.status)
    process.exit(1)
  }
} catch (err) {
  console.error('❌ Error while performing health check:', err?.message || err)
  process.exit(1)
}
