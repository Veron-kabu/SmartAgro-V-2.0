# Deploying SmartAgro backend to Render (step-by-step)

This guide walks you through deploying the `backend/` service to Render using Docker, adding CI/CD, health checks, and basic monitoring. I picked Render because it provides a straightforward container workflow, managed Postgres, cron jobs, and easy GitHub integration — a good balance between simplicity and production features for your Express/Drizzle app.

Contents
- Preconditions & checklist
- Prepare the repo (Dockerfile, health route)
- Create Render services (Web Service, Managed Postgres)
- Environment variables & secrets
- CI/CD with GitHub Actions (already scaffolded)
- Optional extras (Redis, S3, Cron jobs, Metrics)
- Post-deploy smoke tests & monitoring

---

Prerequisites
1. A Render account (https://render.com) and GitHub repo connected.
2. Admin access to the repository and ability to add secrets.
3. DNS control (if you want a custom domain) and an S3 bucket with credentials.
4. Ensure environment variables used by the app are available (see `backend/src/config/env.js`).

Quick checklist (what this guide will do)
- [x] Add a Dockerfile (already in `backend/Dockerfile`)
- [x] Add a `/health` route (done in `backend/src/server.js`)
- [x] Add GitHub Actions CI that builds Docker and runs smoke tests (`.github/workflows/backend-ci.yml`)
- [ ] Provision Render service + Managed Postgres (manual steps below)
- [ ] Add secrets & connect Render to GitHub
- [ ] Configure deploy/rollbacks and monitoring

Section A — Prepare your repo (you can skip if already done)
1. Dockerfile: `backend/Dockerfile` is added. It builds a production image and runs `node src/server.js`.
   - If you prefer a multi-stage build with native modules, ensure `sharp` and `libvips` are handled (Render supports buildpacks too).
2. Health route: `GET /health` pings the database; Render will use this for readiness checks in the platform UI.
3. Validate `package.json` scripts — `start`, `dev` exist. `start` uses `node src/server.js`.

Section B — Provision Managed Postgres on Render
1. In Render dashboard, click "New" → "Postgres" → choose plan.
2. Select the region closest to your users. For Kenya, choose a region with low latency (e.g., Europe or West Africa if available). Render's nearest region is often US/EU; consider Fly if you need per-country placement.
3. Once provisioned, copy the DATABASE_URL (connection string). You will add this to Render service env vars.

Section C — Create the Web Service on Render
1. New → Web Service.
2. Connect to your GitHub repo and pick the `backend` folder as the root (or point to Dockerfile). Choose "Docker" as the environment.
3. Configure build and start commands (Docker will handle building). Set the "Dockerfile Path" to `backend/Dockerfile`.
4. Set Environment:
   - PORT: 3000 (or use Render's default)
   - DATABASE_URL: <from managed Postgres>
   - Other envs from `backend/src/config/env.js` (CLERK keys, S3 keys, SMTP, etc.)
   - NODE_ENV=production
5. Set health check path to `/health` and interval (30s) with a 5s timeout.
6. Enable auto deploy from the main branch (or whichever branch you use).

Section D — Environment variables (required keys)
Check `backend/src/config/env.js` for required variables. Common ones you'll need:
- DATABASE_URL (Postgres connection string)
- CLERK_API_KEY / CLERK_PUBLISHABLE_KEY / CLERK_SECRET (if using Clerk)
- S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET, S3_REGION
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (for nodemailer)
- NODE_ENV (production)
- ALLOWED_ORIGINS (comma-separated allowed CORS origins)
- OTHER keys: CLOUD_FRONT_DOMAIN, DISABLE_AUTO_VERIFY (optional)

Tip: Add sensitive values in the Render dashboard under Environment → "Environment Variables".

Section E — CI/CD (GitHub Actions)
1. The workflow `.github/workflows/backend-ci.yml` builds a Docker image, runs it in CI, verifies `/health`, and hits `/api/products` as a smoke test.
2. When you push to main, GitHub will run the CI. Render will auto-deploy after a successful push (if configured).
3. You can extend the workflow to push the Docker image to a container registry if you prefer (ECR/GCR/Render's private registry).

Section F — Deploying and validating
1. Merge your branch to `main`. Render will build using the Dockerfile and deploy.
2. Watch Render build logs for any native module errors (e.g., `sharp` requires libvips). If build fails on Alpine, consider switching to `node:20-bullseye-slim` or using Render buildpacks.
3. After deployment, visit `https://<your-render-url>/health` — should return { status: 'ok' }.
4. Run smoke tests: `/api/products`, `/api/users/:id`, `/api/uploads/resolve-avatar-url?url=...` to validate core endpoints.

Section G — Optional additions & hardening
- Keep minimum instances to 1–2 to avoid cold starts.
- Setup Redis (Render add-on or Upstash) to cache frequent reads, rate-limits, and session data.
- Configure Sentry for error monitoring and Datadog or Logflare for logs/metrics.
- Create Render cron jobs (Background Workers) for scheduled tasks like blurhash backfill and auto-verification.

Section H — Rollbacks & recovery
- Render allows you to promote previous deploys. Keep DB backups enabled. Set up daily backups for Postgres.

What I can do for you
- I can add the Dockerfile and health route (already added).
- I can create GitHub Actions (already scaffolded) and extend it with test suites if you provide tests or want me to add a minimal supertest-based smoke test.
- I can prepare a Render `render.yaml` manifest if you prefer infra-as-code (I can scaffold it next).

---

If you'd like I can now:
- Scaffold a minimal `render.yaml` manifest for the service + cron jobs.
- Add a small Node-based smoke-test script in `backend/test/smoke.js` and wire it into CI.
- Replace the Dockerfile base image with `node:20-bullseye-slim` if you hit `sharp` build issues on Alpine.

Which of these should I do next? If you want me to proceed with manifest + smoke tests, say "Proceed with render manifest and smoke tests" and I'll add them to the repo.
