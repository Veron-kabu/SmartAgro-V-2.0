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

## Location & Nearby (OSM + Nominatim + Leaflet)

We refactored the entire location system to use free, open-source components:
- OpenStreetMap (OSM) as tile/map + place data
- Nominatim for geocoding and reverse geocoding
- Leaflet.js in the mobile app via a WebView for interactive maps

### What’s included
- Save user live location with readable name: `PATCH /api/location`
- Nearby farmers: `GET /api/location/nearby/farmers`
- Nearby buyers: `GET /api/location/nearby/buyers`
- Nearby products: `GET /api/location/nearby/products`
- My saved location: `GET /api/location/me`
- Public geocode helpers: `GET /api/location/geocode`, `GET /api/location/reverse`

Normalized DB columns on `users` and `products`:
- `latitude` (numeric)
- `longitude` (numeric)
- `place_name` (text)
- `address_details` (jsonb)
(Legacy `location` jsonb kept for backward compatibility; new code should use normalized columns.)

### Backend setup
1) Ensure `.env` has your Neon Postgres URL:
	 - `DATABASE_URL=postgresql://...`
	 - Optional: `CONTACT_EMAIL=you@example.com` (included in Nominatim User-Agent)

2) Apply the location refactor migration. From the `backend` folder:
```pwsh
cd .\backend
node .\scripts\apply-location-refactor.mjs
```
Expected: `✅ Location refactor migration applied successfully.`

3) Start the API:
```pwsh
npm run dev
```

### API usage (auth required)
- Save your location (reverse geocoded automatically if `place_name` omitted):
	- `PATCH /api/location` body:
		```json
		{ "lat": -1.286389, "lng": 36.817223 }
		```
- Nearby (pass `lat`/`lng` or fallback to your saved location):
	- Buyer → farmers: `GET /api/location/nearby/farmers?radiusKm=25&limit=20`
	- Buyer → products: `GET /api/location/nearby/products?radiusKm=25&limit=30`
	- Farmer → buyers: `GET /api/location/nearby/buyers?radiusKm=25&limit=20`

- Product creation requires coordinates and accepts optional name/address:
	```json
	{
		"title": "Organic Tomatoes",
		"category": "vegetables",
		"price": 3.5,
		"unit": "kg",
		"quantity_available": 100,
		"latitude": -1.286389,
		"longitude": 36.817223,
		"place_name": "Nairobi, Nairobi County, Kenya",
		"address_details": { "city": "Nairobi", "country": "Kenya" },
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
SELECT id, username, role, latitude, longitude, place_name
FROM users
ORDER BY updated_at DESC
LIMIT 20;

SELECT id, title, latitude, longitude, place_name
FROM products
ORDER BY updated_at DESC
LIMIT 20;
```

### Performance notes (free)
- SQL bounding-box filter on latitude/longitude
- Final Haversine distance in Node for accuracy

If your Postgres host supports extensions (`CREATE EXTENSION`), consider PostGIS or `cube/earthdistance` for geo indexes. These are free but not always available on serverless providers.

### Troubleshooting
- 401 Unauthorized: make sure you’re authenticated (mobile app provides Clerk JWT automatically). For manual tests, include a valid `Authorization: Bearer <token>` header.
- Do not run `expo` installs in the backend folder; use the `mobile` folder.
- Migration can be re-run safely:
  ```pwsh
  cd .\backend
  node .\scripts\apply-location-refactor.mjs
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


