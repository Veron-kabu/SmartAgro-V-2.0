import fs from 'fs'
import path from 'path'

// Mirrors required keys from src/config/env.js — safe to run in CI without revealing secrets
const required = [
  'DATABASE_URL',
  'CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'CLERK_WEBHOOK_SECRET'
]

console.log('Checking required environment variables (values not printed)')
let missing = []
for (const k of required) {
  if (!process.env[k]) missing.push(k)
}
if (missing.length === 0) {
  console.log('All required env vars are set')
  process.exit(0)
} else {
  console.log('Missing:', missing.join(', '))
  process.exit(2)
}
