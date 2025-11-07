#!/usr/bin/env node
import fs from 'node:fs/promises'
import path from 'node:path'
import { Client } from '@neondatabase/serverless'
import 'dotenv/config'

async function run() {
  const sqlPath = path.resolve(process.cwd(), 'src', 'db', 'migrations', '0003_drop_geocell_triggers.sql')
  const sql = await fs.readFile(sqlPath, 'utf8')

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL is not set in environment')
    process.exit(1)
  }

  const client = new Client(databaseUrl)
  await client.connect()

  try {
    // Send as a single script; contains its own transaction
    await client.query(sql)
    console.log('Applied 0003_drop_geocell_triggers.sql successfully')
  } finally {
    await client.end()
  }
}

run().catch((err) => {
  console.error('Failed to apply drop-geocell-triggers migration')
  console.error(err)
  process.exit(1)
})
