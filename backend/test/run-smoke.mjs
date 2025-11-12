// Lightweight smoke test runner for CI
// Usage: node test/run-smoke.mjs

process.env.NODE_ENV = 'test'
import request from 'supertest'
import app from '../src/server.js'

async function run() {
  const errors = []
  const hasDb = !!process.env.DATABASE_URL
  console.log('Smoke runner starting — DB present?', hasDb)

  try {
    // 1) Health endpoint — give more time in CI environments
    const h = await request(app).get('/health').timeout({ response: 5000, deadline: 15000 })
    if (h.status !== 200) {
      errors.push(`/health returned ${h.status} - body: ${JSON.stringify(h.body)}`)
    }
  } catch (e) {
    errors.push(`/health error: ${e.message || e}`)
  }

  if (hasDb) {
    try {
      // 2) Public products list (only if DB is available)
      const p = await request(app).get('/api/products').timeout({ response: 5000, deadline: 15000 })
      if (p.status !== 200) {
        errors.push(`/api/products returned ${p.status}`)
      }
    } catch (e) {
      errors.push(`/api/products error: ${e.message || e}`)
    }
  } else {
    console.log('Skipping /api/products check because DATABASE_URL is not set (use docker-compose to run a test DB)')
  }

  if (errors.length > 0) {
    console.error('Smoke tests failed:')
    for (const err of errors) console.error('-', err)
    process.exit(1)
  }
  console.log('Smoke tests passed')
  process.exit(0)
}

run()
