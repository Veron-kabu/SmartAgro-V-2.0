// Lightweight smoke test runner for CI
// Usage: node test/run-smoke.mjs

process.env.NODE_ENV = 'test'
import request from 'supertest'
import { execSync } from 'child_process'
import pkg from 'pg'
const { Client } = pkg

// If DATABASE_URL is set we should ensure the schema is applied before importing the app.
if (process.env.DATABASE_URL) {
  console.log('Applying DB schema (drizzle-kit push) before smoke run')
  // Run push and let failures surface (do not swallow) so CI logs show the reason
  execSync('npx drizzle-kit push --schema ./src/db/schema.js --url "' + process.env.DATABASE_URL + '" --dialect postgresql --force', { stdio: 'inherit' })

  // Quick verification that the products table exists
  try {
    const client = new Client({ connectionString: process.env.DATABASE_URL })
    await client.connect()
    const res = await client.query("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='products') as exists")
    await client.end()
    const exists = res.rows?.[0]?.exists
    if (!exists) {
      console.error('❌ products table does not exist after schema push — aborting smoke run')
      process.exit(2)
    } else {
      console.log('✅ products table exists')
    }
  } catch (e) {
    console.error('❌ Failed to verify products table presence:', e.message || e)
    process.exit(2)
  }
}

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
