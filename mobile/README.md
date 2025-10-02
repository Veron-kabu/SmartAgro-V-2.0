MOBILE
npx install expo
npm expo

Mobile App (Expo)
=================

Overview
--------
This is the React Native / Expo client for the Farmer‑Buyer system (iOS / Android). It integrates with the backend for authentication, product discovery, ordering, messaging, and optimized media loading with Blurhash placeholders.

Key Technologies
----------------
- Expo (managed workflow)
- React / React Native
- expo-image (with Blurhash placeholder support)
- expo-image-picker & expo-image-manipulator (media selection + cropping)
- Clerk (auth token; integrated via token getter)
- Custom hooks (useDashboardMedia, useDashboardStats)
- Lightweight toast notifications

Project Structure (selected)
---------------------------
- app/  Route segments: tabs, auth, dashboard, orders
- components/  Reusable UI (BlurhashImage, Toast)
- context/  API abstraction (api.js), cart, profile
- constants/  Shared constants (roles)
- assets/  Static images/icons
- utils/  Helpers (orders etc.)

Environment Configuration
-------------------------
API URL resolution order (in context/api.js):
1. EXPO_PUBLIC_API_URL (explicit)
2. Metro bundle host (dev) + port 5001
3. Expo Constants hostUri + port 5001
4. Android emulator fallback http://10.0.2.2:5001
5. Default http://localhost:5001

Set EXPO_PUBLIC_API_URL for production/staging (e.g. https://your-api.example.com).

Blurhash Image Pipeline (Client)
--------------------------------
BlurhashImage props:
- uri: final image URL
- blurhash: optional hash string placeholder
- transition: fade duration (ms, default 400)
- Fallback hash ensures consistent layout if none provided.

Upload + Hash Flow:
1. User picks/crops image (banner 16:9) via expo-image-manipulator.
2. Upload to S3 via presigned URL.
3. Optionally call /api/utils/blurhash then PATCH profile with hash fields OR rely on backend cron.
4. Product blurhashes generated async after creation (first 6 images) and appear on subsequent fetch.

Signed URL Refresh
------------------
Private S3 objects get re-signed periodically (hooks refresh before 5‑min TTL expires) so UI stays valid.

Search & Listings
-----------------
Market grid & search results both use BlurhashImage (first product image + blurhash) for faster perceived loading.

Commands
--------
Install deps:
	npm install
Start dev:
	npx expo start
Clear cache:
	npx expo start -c
EAS build examples:
	eas build --platform android
	eas build --platform ios

Auth Integration Snippet
------------------------
setAuthTokenGetter(async () => {
	// return await clerkInstance.getToken()
})

Troubleshooting
---------------
Images stuck blurred:
- Confirm EXPO_PUBLIC_API_URL is reachable.
- Ensure device & backend share network (LAN dev).
No blurhash for new upload:
- Client may have skipped hash call; wait for hourly cron.
Missing product blurhash:
- Asynchronous generation; refresh after a moment.

Future Enhancements
-------------------
- Offline caching (AsyncStorage)
- Accessibility labels for images
- Skeleton loaders for non-image content
- Prefetch & priority image queue

License
-------
Internal project; update as needed.