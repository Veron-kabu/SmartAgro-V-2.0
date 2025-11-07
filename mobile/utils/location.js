import * as ExpoLocation from "expo-location"
import { patchJSON } from "../context/api"
import { reverseGeocode } from "./geocoding"
// Auto-detection has been limited to signup/first profile completion only.
// Periodic heartbeat removed to comply with user request and avoid excess Nominatim calls.

export async function requestAndGetLatLng(options = { accuracy: ExpoLocation.Accuracy.Balanced }) {
  const { status } = await ExpoLocation.requestForegroundPermissionsAsync()
  if (status !== "granted") throw new Error("Location permission not granted")
  const { coords } = await ExpoLocation.getCurrentPositionAsync(options)
  return { lat: coords.latitude, lng: coords.longitude }
}

export async function pushMyLocation(extra = {}) {
  const { lat, lng } = await requestAndGetLatLng()
  // Resolve readable place name via Nominatim
  let place = null
  try { place = await reverseGeocode(lat, lng) } catch {}
  return patchJSON("/api/location", {
    lat,
    lng,
    place_name: place?.placeName,
    address_details: place?.address || null,
    ...extra,
  })
}

// Deprecated: retained as a no-op for backward compatibility with any stale imports
export function startLocationHeartbeat() {
  return () => {}
}

// Run a one-time location push ONLY if the profile lacks coordinates.
export async function pushInitialLocationIfMissing(profile) {
  try {
    if (!profile) return
    const hasLat = typeof profile.latitude !== 'undefined' && profile.latitude !== null
    const legacyHas = profile.location && typeof profile.location.lat === 'number'
    if (hasLat || legacyHas) return
    await pushMyLocation()
  } catch { /* ignore */ }
}
