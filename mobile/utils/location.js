import * as ExpoLocation from "expo-location"
import { AppState } from "react-native"
import { patchJSON } from "../context/api"

export async function requestAndGetLatLng(options = { accuracy: ExpoLocation.Accuracy.Balanced }) {
  const { status } = await ExpoLocation.requestForegroundPermissionsAsync()
  if (status !== "granted") throw new Error("Location permission not granted")
  const { coords } = await ExpoLocation.getCurrentPositionAsync(options)
  return { lat: coords.latitude, lng: coords.longitude }
}

export async function pushMyLocation(extra = {}) {
  const { lat, lng } = await requestAndGetLatLng()
  return patchJSON("/api/location", { lat, lng, ...extra })
}

// Periodically update location; also triggers when app returns to foreground
export function startLocationHeartbeat({ intervalMs = 300000, includeAddress = false } = {}) {
  let timer = null
  let appState = AppState.currentState

  const doUpdate = async () => {
    try {
      const opts = includeAddress ? { accuracy: ExpoLocation.Accuracy.Balanced } : undefined
      const { lat, lng } = await requestAndGetLatLng(opts)
      await patchJSON("/api/location", { lat, lng })
    } catch (_e) {
      // Silently ignore permission/network issues
    }
  }

  const startTimer = () => {
    if (timer) clearInterval(timer)
    timer = setInterval(doUpdate, intervalMs)
  }

  const handleAppStateChange = (nextState) => {
    if (appState.match(/inactive|background/) && nextState === "active") {
      // App came to foreground, push a quick update
      doUpdate()
    }
    appState = nextState
  }

  // Initial immediate update and schedule next ones
  doUpdate()
  startTimer()
  const sub = AppState.addEventListener("change", handleAppStateChange)

  return () => {
    if (timer) clearInterval(timer)
    if (sub?.remove) sub.remove()
  }
}
