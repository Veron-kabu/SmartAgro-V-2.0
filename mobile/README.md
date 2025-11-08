MOBILE
npm install
npx install expo
npm install dotenv
npx expo

Mobile App (Expo)
=================

Overview
--------
This is the React Native / Expo client for the Farmer‑Buyer system (iOS / Android). It integrates with the backend for authentication, product discovery, ordering, and optimized media loading with Blurhash placeholders.

Key Technologies
----------------
- Expo (managed workflow)
- React / React Native
- expo-image (with Blurhash placeholder support)
- expo-image-picker & expo-image-manipulator (media selection + cropping)
- Clerk (auth token; integrated via token getter)
- Custom hooks (useDashboardMedia, useDashboardStats)
- Lightweight toast notifications
 - Leaflet.js via WebView (OpenStreetMap tiles) for location picker

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
Map not showing in location picker:
- Install the WebView dependency: `npx expo install react-native-webview` (already in package.json).
- Ensure device has internet to load OSM tiles.

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
 - Native map alternative with UrlTile if WebView is undesirable

Video Calling (Zego Integration)
--------------------------------
Added experimental one-on-one / group video calling using ZegoCloud Prebuilt Call UI.

Setup:
1. Obtain a Zego AppID and AppSign from the ZegoCloud console.
2. Add the following to your `.env` (these are public for client usage but treat AppSign with care; rotate if leaked):
	EXPO_PUBLIC_ZEGO_APP_ID=123456789
	EXPO_PUBLIC_ZEGO_APP_SIGN=your_app_sign_here
3. Rebuild the dev client (permissions & native modules):
	npx expo prebuild --clean && npx expo run:android
	npx expo run:ios
	(Or use EAS build for production.)

Usage:
- From a chat conversation, tap the video camera icon to launch a call using the chat room ID as the callID.
- Or navigate to /video-call and enter a custom call ID.

Notes:
- iOS Info.plist now includes Camera & Microphone usage descriptions.
- Android manifest permissions (CAMERA, RECORD_AUDIO) added via app.config.js.
- Ensure network quality; WebRTC can degrade on poor connections.
- Group vs one-on-one decided from participant count (>2 => group mode).

Potential Next Steps:
- Backend token generation for secure authentication (instead of exposing AppSign directly) using Zego's server-side token mechanism.
- Call invitations / ringing UI.
- Persist call history and durations.
- In-call chat overlay.

License
-------
Internal project; update as needed.