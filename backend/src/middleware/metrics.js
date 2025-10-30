// middleware/metrics.js
// Request duration telemetry: measures response time and stores in request_metrics
import { db } from "../config/db.js"
import { requestMetricsTable } from "../db/schema.js"

function shouldSkip(req) {
  // Skip preflight, favicon, and health checks if any
  if (req.method === "OPTIONS") return true
  const p = req.path || ""
  if (p === "/favicon.ico") return true
  return false
}

function resolveRouteLabel(req) {
  // Prefer the Express route pattern when available (e.g., /api/orders/:id)
  const routePath = req.route?.path
  const base = req.baseUrl || ""
  if (routePath) return `${base}${routePath}`
  // Fallback to originalUrl without query string
  const url = (req.originalUrl || req.url || "").split("?")[0]
  return url
}

export function requestMetrics() {
  return function metricsMiddleware(req, res, next) {
    if (shouldSkip(req)) return next()

    const start = process.hrtime.bigint()

    res.on("finish", async () => {
      try {
        const end = process.hrtime.bigint()
        const durationNs = end - start
        const durationMs = Number(durationNs / 1000000n)
        const method = req.method || "GET"
        const status = res.statusCode || 0
        const route = resolveRouteLabel(req)
        // Guard: avoid absurd values and ensure positive
        const safeDuration = Math.max(0, Math.min(durationMs, 60 * 1000)) // clamp to 60s
        await db.insert(requestMetricsTable).values({
          route,
          method,
          status,
          durationMs: safeDuration,
        })
      } catch (e) {
        // Non-fatal: never block responses due to telemetry errors
        if (process.env.LOG_TELEMETRY_ERRORS === "true") {
          console.error("[metrics] insert failed:", e?.message || e)
        }
      }
    })

    next()
  }
}

export default requestMetrics
