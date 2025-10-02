import { ENV } from "./src/config/env.js"

export default {
  schema: "./src/db/schema.js",
  // Use existing migrations directory that already has meta/_journal.json
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: ENV.DATABASE_URL,
  },
  verbose: true,
  //strict: true,
}
