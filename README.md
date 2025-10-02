# Farmer Buyer System
open ngrok
create account
create domain and copy the domain url
add it to clerk endpoint under webhooks
if it does not work just run......ngrok http 5001 then add it to clerk ie 
https://6f76c4dfc52d.ngrok-free.app/apiwebhooks/clerk
## Role Immutability

User roles (buyer, farmer, admin) are assigned once at user record creation and cannot be switched via the API or mobile client. The former runtime role‑switch feature was removed to enforce clearer authorization boundaries and simplify analytics. Any legacy users with unexpected role values are normalized by migration `0001_lock_roles.sql` (roles outside the set [buyer, farmer, admin] are set to `buyer`).

Implications:
- No endpoint exists to toggle roles (removed `/api/users/role`).
- Client UI no longer shows role switching controls or prompts.
- Authorization logic should rely on the stable `role` column in `users`.
- To change a user’s role, perform a manual admin/database operation (or implement controlled admin tooling—currently not included).

If you introduce an admin panel later, ensure any role change flow includes audit logging and explicit confirmation.

## Location & Nearby Features

This project supports live user locations and "nearby" discovery for farmers, buyers, and listings — all implemented with free components (no paid services).

### What’s included
- Save user live location: `PATCH /api/location` (jsonb stored in Postgres)
- Nearby farmers for buyers: `GET /api/location/nearby/farmers`
- Nearby buyers for farmers: `GET /api/location/nearby/buyers`
- Nearby products (farmer listings): `GET /api/location/nearby/products`
- Get your saved location: `GET /api/location/me`
- Get any user’s location by id: `GET /api/location/user/:id` (auth required)
- Performance: free geocell prefilter + index, in-memory bounding box, Haversine distance

### Backend setup
1) Ensure `.env` has your Neon Postgres URL (already present):
	 - `DATABASE_URL=postgresql://...`

2) Apply the geocell migration (adds `geo_cell`, triggers, indexes, backfills). From the `backend` folder:
```pwsh
cd .\backend
npm run migrate:geocell
```
Expected: `✅ Geocell migration applied successfully.`

3) Start the API:
```pwsh
npm run dev
```

### API usage (auth required)
- Save your location:
	- `PATCH /api/location` body:
		```json
		{ "lat": 0.3476, "lng": 32.5825, "address": "Kampala", "country": "UG" }
		```

- Nearby (either pass `lat`/`lng` in query OR let the API fall back to your saved location):
	- Buyer → farmers: `GET /api/location/nearby/farmers?lat=0.3476&lng=32.5825&radiusKm=25&limit=20`
	- Buyer → products: `GET /api/location/nearby/products?lat=0.3476&lng=32.5825&radiusKm=25&limit=30`
	- Farmer → buyers: `GET /api/location/nearby/buyers?lat=0.3476&lng=32.5825&radiusKm=25&limit=20`

- Product creation includes `location` (jsonb) to place listings on the map:
	```json
	{
		"title": "Organic Tomatoes",
		"category": "Vegetables",
		"price": 3.5,
		"unit": "kg",
		"quantity_available": 100,
		"location": { "lat": 0.35, "lng": 32.58, "address": "Kampala" },
		"description": "Fresh from farm",
		"images": [],
		"is_organic": true
	}
	```

### Mobile app: automatic live location (Option A)
1) Install dependency in the mobile app (not backend):
```pwsh
cd .\mobile
npx expo install expo-location
```

2) The heartbeat is already wired in `mobile/app/_layout.jsx` and will start once the user is signed in. It updates every 5 minutes and on app foreground.
	 - Utility is in `mobile/utils/location.js`:
		 - `startLocationHeartbeat({ intervalMs: 300000 })`
		 - `pushMyLocation(extra?)`

	 - Change the interval: set `EXPO_PUBLIC_LOCATION_HEARTBEAT_MS` in `mobile` env (milliseconds). Example for 24 hours:
		 - Windows PowerShell transient (development):
			 ```pwsh
			 # From the mobile folder before starting Expo
			 $env:EXPO_PUBLIC_LOCATION_HEARTBEAT_MS = 86400000
			 npx expo start
			 ```
		 - Or add to an `.env` loaded by Expo (recommended) and restart the dev server:
			 ```env
			 EXPO_PUBLIC_LOCATION_HEARTBEAT_MS=86400000
			 ```

3) Permissions
	 - iOS prompts for “When In Use” permission automatically (customize copy in `app.json` if desired).
	 - Android permissions are auto-managed by Expo.

### Verifying data in Neon
Use the Neon SQL console:
```sql
SELECT id, username, role, geo_cell, location
FROM users
ORDER BY updated_at DESC
LIMIT 20;

SELECT id, title, geo_cell, location
FROM products
ORDER BY updated_at DESC
LIMIT 20;
```

### Performance notes (free)
- Geocell prefilter (0.1° cells) using `users.geo_cell` and `products.geo_cell` + indexes
- In-memory bounding-box check before Haversine distance
- Final Haversine distance in Node for accuracy

If your Postgres host supports extensions (`CREATE EXTENSION`), you can switch to PostGIS or `cube/earthdistance` for SQL-native KNN and geo indexes. These are free, but many serverless hosts restrict extensions.

### What is `geo_cell` and why do we use it?
`geo_cell` is a coarse, string-based geospatial bucket that we compute from a point’s latitude/longitude and store in the database for fast, free prefiltering.

- How it’s computed
	- We quantize each coordinate at a fixed resolution (default `res = 10`, i.e. 0.1° increments):
		- `cell_lat = floor(lat * res)`
		- `cell_lng = floor(lng * res)`
	- The stored value is `"<cell_lat>:<cell_lng>"`, e.g. `"3:325"`.
	- A Postgres trigger updates `users.geo_cell` and `products.geo_cell` whenever `location` changes.

- Why it helps
	- Nearby searches only need to scan a small set of adjacent cells instead of the whole table.
	- We added a regular B-Tree index on `geo_cell`, so lookups like `WHERE geo_cell IN (...)` are fast—no PostGIS required.
	- It’s free and works on serverless Postgres providers that don’t allow extensions.

- Caveats / notes
	- `geo_cell` is approximate; it narrows candidates. We still run a precise Haversine distance check on the filtered rows.
	- Resolution trade-off:
		- Higher `res` (smaller cells) = fewer candidates but more neighbor cells to check.
		- Lower `res` (larger cells) = more candidates but fewer neighbor cells.
	- We currently use `res = 10` (~0.1° ≈ ~11 km latitude). You can change the function/trigger if needed.

	#### Tuning via environment
	- App-side geocell resolution: set `GEO_CELL_RES` (default 10) in `backend/.env`.
		- Bounds: 1–100; larger = finer grid.
		- Note: The DB trigger currently uses `res = 10`. If you change `GEO_CELL_RES`, consider updating the SQL trigger default to match for tighter prefiltering.

### Troubleshooting
- 401 Unauthorized: make sure you’re authenticated (mobile app provides Clerk JWT automatically). For manual tests, include a valid `Authorization: Bearer <token>` header.
- Do not run `expo` installs in the backend folder; use the `mobile` folder.
- Migration can be re-run safely:
	```pwsh
	cd .\backend
	npm run migrate:geocell
	```

### Drizzle Migrations (Important)

All Drizzle migrations (and the required `meta/_journal.json`) are stored under `backend/src/db/migrations`.

Configuration:
- The Drizzle config (`backend/drizzle.config.js`) must have `out: "./src/db/migrations"`.
- Do NOT point `out` to a different folder (e.g. `./db/migrations`) unless you also move the existing `meta` directory. If Drizzle cannot find `meta/_journal.json`, `drizzle-kit migrate` will fail with: `Can't find meta/_journal.json file`.

If you accidentally generated a migration in the wrong folder:
1. Delete the stray file (e.g. `backend/db/migrations/XXXX_some_migration.sql`).
2. Ensure `out` is restored to `./src/db/migrations`.
3. Re‑run: `npx drizzle-kit generate` (or your existing migration script) so the migration appears alongside `meta/`.
4. Apply migrations: `npx drizzle-kit migrate`.

Adding the Clerk sync runs table (example):
- Migration file added: `src/db/migrations/0006_add_clerk_sync_runs.sql`.
- After generating, apply with `npx drizzle-kit migrate` and then the mobile Admin Console sync panel will stop showing 500 errors.

Tip: Commit the `meta/_journal.json` so teammates maintain a consistent migration state.


### Quick Start (just sign in)
- You don’t need to run any manual location commands if you’re using the mobile app.
- Steps:
	1) Start the backend: `npm run dev` in `backend`.
	2) Start the mobile app: `npx expo start` in `mobile`.
	3) Sign in with your Clerk account. Email “verified” is not required for location saving—being signed in is enough.
	4) When prompted, allow location permissions.
	5) That’s it. The app saves your location automatically every few minutes and when coming back to the foreground.

- Nearby usage after sign-in:
	- Buyer → nearby farmers: `GET /api/location/nearby/farmers?radiusKm=25&limit=20`
	- Buyer → nearby listings: `GET /api/location/nearby/products?radiusKm=25&limit=30`
	- Farmer → nearby buyers: `GET /api/location/nearby/buyers?radiusKm=25&limit=20`
	- Passing `lat`/`lng` in the query is optional; if omitted, your saved (auto-updated) location is used.


