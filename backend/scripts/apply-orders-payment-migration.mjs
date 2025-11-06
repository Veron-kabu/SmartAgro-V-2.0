import { readFile } from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"
import dotenv from "dotenv"
import { neon } from "@neondatabase/serverless"

dotenv.config({ path: path.resolve(process.cwd(), ".env") })

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function main() {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    console.error("DATABASE_URL is not set in .env")
    process.exit(1)
  }
  const sql = neon(dbUrl)

  const migrationPath = path.resolve(__dirname, "../src/db/migrations/0008_orders_payment.sql")
  const text = await readFile(migrationPath, "utf8")

  await sql.query(text)
  console.log("✅ Orders payment migration applied successfully.")
}

main().catch((err) => {
  console.error("❌ Orders payment migration failed:", err)
  process.exit(1)
})
