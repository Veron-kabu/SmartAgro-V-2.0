import cron from "cron"
import https from "https"
import http from "http"
import { ENV } from "./env.js"

const job = new cron.CronJob("*/14 * * * *", () => {
  const apiUrl = ENV.API_URL

  if (!apiUrl) {
    console.warn("API_URL not configured, skipping keep-alive ping")
    return
  }

  const client = apiUrl.startsWith("https://") ? https : http

  client
    .get(apiUrl + "/health", (res) => {
      if (res.statusCode === 200) {
        console.log("✅ Keep-alive ping sent successfully")
      } else {
        console.log("⚠️ Keep-alive ping failed with status:", res.statusCode)
      }
    })
    .on("error", (e) => {
      console.error("❌ Error while sending keep-alive ping:", e.message)
    })
})

export default job

// CRON JOB EXPLANATION:
// Cron jobs are scheduled tasks that run periodically at fixed intervals
// we want to send 1 GET request for every 14 minutes so that our api never gets inactive on Render.com

// How to define a "Schedule"?
// You define a schedule using a cron expression, which consists of 5 fields representing:

// MINUTE, HOUR, DAY OF THE MONTH, MONTH, DAY OF THE WEEK

// EXAMPLES && EXPLANATION:
// 14 * * * * - Every 14 minutes
// 0 0 * * 0 - At midnight on every Sunday
// 30 3 15 * * - At 3:30 AM, on the 15th of every month
// 0 0 1 1 * - At midnight, on January 1st
// 0 * * * * - Every hour
