# Location System (OSM + Nominatim)

This backend uses OpenStreetMap (OSM) data via the public Nominatim API for geocoding and reverse geocoding, and stores normalized location fields for users and products.

## Data model

Tables `users` and `products` now include:
- latitude NUMERIC(10,7)
- longitude NUMERIC(10,7)
- place_name VARCHAR(255)
- address_details JSONB (Nominatim `address` object)

A legacy `location` JSONB remains for backward compatibility. New code should prefer the normalized columns.

## Endpoints

- PATCH /api/location
  - Body: { lat: number, lng: number, place_name?: string, address_details?: object }
  - Reverse geocodes via Nominatim when `place_name` is not provided. Saves both coordinates and readable name.

- GET /api/location/me
  - Returns the authenticated user's stored location.

- GET /api/location/geocode?q=search
  - Forward geocoding helper returning up to 10 results from Nominatim.

- GET /api/location/reverse?lat=..&lng=..
  - Reverse geocoding helper.

- GET /api/location/nearby/farmers|buyers|products?lat=..&lng=..&radiusKm=25&limit=20
  - Finds nearby entities using a bounding-box filter in SQL followed by Haversine distance refinement.

## Nominatim usage

- Uses the public endpoint https://nominatim.openstreetmap.org
- Requests are throttled in-process to ~1 req/sec.
- A descriptive `User-Agent` is sent. Optionally set CONTACT_EMAIL in `.env`.

## Migration

Run once to migrate schema and backfill from legacy blobs:

- scripts/apply-location-refactor.mjs

This will:
- Add normalized columns to `users` and `products`
- Backfill from legacy `location` JSON when present
- Drop deprecated `geo_cell` columns
- Create simple indexes on latitude/longitude

## Notes

- Prefer using PATCH /api/location to set a user's location so the backend can ensure the place name is resolved and stored consistently.
- Product creation now requires latitude/longitude and accepts optional place_name/address_details.
