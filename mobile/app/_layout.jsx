import { Stack } from "expo-router"
import { useEffect } from "react"
import { ClerkProvider, useAuth } from "@clerk/clerk-expo"
import { ProfileProvider } from "../context/profile"
import { CartProvider } from "../context/cart"
import * as SecureStore from "expo-secure-store"
import { startLocationHeartbeat } from "../utils/location"

const tokenCache = {
  async getToken(key) {
    try {
      return await SecureStore.getItemAsync(key)
    } catch {
      return null
    }
  },
  async saveToken(key, value) {
    try {
      await SecureStore.setItemAsync(key, value)
    } catch {
      // ignore
    }
  },
}

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY

if (!publishableKey) {
  throw new Error("Missing Publishable Key. Please set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY in your .env")
}

export default function RootLayout() {
  // Disable Expo Keep Awake in development to avoid activation errors on some Android devices
  useEffect(() => {
    let cancelled = false
    async function disableKeepAwake() {
      try {
        if (__DEV__) {
          const mod = await import('expo-keep-awake')
          if (!cancelled && mod?.deactivateKeepAwake) {
            // Best-effort: turn off any auto-activated keep-awake from dev tooling
            mod.deactivateKeepAwake()
          }
        }
      } catch {
        // ignore: module may be unavailable in some environments
      }
    }
    disableKeepAwake()
    return () => { cancelled = true }
  }, [])

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <LocationHeartbeat />
      <ProfileProvider>
        <CartProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </CartProvider>
      </ProfileProvider>
    </ClerkProvider>
  )
}

function LocationHeartbeat() {
  const { isSignedIn } = useAuth()

  useEffect(() => {
    if (!isSignedIn) return
    // Allow configuration via EXPO_PUBLIC_LOCATION_HEARTBEAT_MS (milliseconds)
    // Defaults to 5 minutes if not set
    const fallback = 300000
    const envMs = Number(process.env.EXPO_PUBLIC_LOCATION_HEARTBEAT_MS || fallback)
    const intervalMs = Number.isFinite(envMs) && envMs > 0 ? envMs : fallback
    const stop = startLocationHeartbeat({ intervalMs })
    return () => stop()
  }, [isSignedIn])

  return null
}
