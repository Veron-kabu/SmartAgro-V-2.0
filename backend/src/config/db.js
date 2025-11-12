import { ENV } from "./env.js";
import * as schema from "../db/schema.js";

// Support both Neon (serverless HTTP) and a local Postgres connection.
// If the DATABASE_URL looks like a Neon-hosted URL (ep-... or contains "neon"),
// use the Neon HTTP driver. Otherwise fall back to node-postgres (Pool).
function looksLikeNeon(url) {
	if (!url) return false;
	return /neon|ep-.*\.neon|neondatabase|neon.tech/i.test(url);
}

let db;

if (looksLikeNeon(ENV.DATABASE_URL)) {
	// Neon serverless HTTP driver
	const { drizzle } = await import("drizzle-orm/neon-http");
	const { neon } = await import("@neondatabase/serverless");
	const sql = neon(ENV.DATABASE_URL);
	db = drizzle(sql, { schema });
} else {
	// Local Postgres via node-postgres
	const { drizzle } = await import("drizzle-orm/node-postgres");
	const { Pool } = await import("pg");
	const pool = new Pool({ connectionString: ENV.DATABASE_URL });
	db = drizzle(pool, { schema });
}

export { db };
