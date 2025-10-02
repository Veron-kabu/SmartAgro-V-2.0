import { Stack, usePathname, useRouter } from "expo-router"
import { useEffect, useRef } from "react"
import { AppState } from "react-native"
import { ClerkProvider, useAuth } from "@clerk/clerk-expo"
import { ProfileProvider } from "../context/profile"
import { FavoritesProvider } from "../context/favorites"
import { CartProvider, useCart } from "../context/cart"
import { ToastProvider, useToast } from "../context/toast"
import { getJSON } from '../context/api'
import { validateCartItems } from '../utils/cartValidation'
import * as SecureStore from "expo-secure-store"
import { startLocationHeartbeat } from "../utils/location"
import { track, flush } from "../utils/analytics"
import { ANALYTICS_EVENTS } from "../constants/analyticsEvents"

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

  // App lifecycle analytics + background flush
  useEffect(() => {
  track(ANALYTICS_EVENTS.APP_OPEN)
    const appState = AppState.currentState
    const prevState = { value: appState }
    const sub = AppState.addEventListener('change', (nextState) => {
      // foreground -> background/inactive
      if ((prevState.value === 'active') && (nextState === 'background' || nextState === 'inactive')) {
  track(ANALYTICS_EVENTS.APP_BACKGROUND)
        // Fire-and-forget flush so queued events attempt to persist server-side
        flush()
      } else if ((prevState.value === 'background' || prevState.value === 'inactive') && nextState === 'active') {
  track(ANALYTICS_EVENTS.APP_FOREGROUND)
      }
      prevState.value = nextState
    })
    return () => {
  track(ANALYTICS_EVENTS.APP_CLOSE)
      flush()
      sub.remove()
    }
  }, [])

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      tokenCache={tokenCache}
      telemetry={{ disabled: process.env.EXPO_PUBLIC_CLERK_TELEMETRY_DISABLED === 'true' }} // Re-enabled by default after upgrading Clerk; set EXPO_PUBLIC_CLERK_TELEMETRY_DISABLED=true to silence if issues reoccur
    >
      {/* Redirect from '/' based on auth state so we don't need a dedicated index route */}
      <ToastProvider>
        <InitialRedirect />
        <LocationHeartbeat />
        <ProfileProvider>
          <FavoritesProvider>
            <CartProvider>
              <ForegroundCartValidator />
              <Stack screenOptions={{ headerShown: false }} />
            </CartProvider>
          </FavoritesProvider>
        </ProfileProvider>
      </ToastProvider>
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

function InitialRedirect() {
  const { isLoaded, isSignedIn } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (!isLoaded) return
    // Handle app root and legacy '/page' redirect centrally
    if (!pathname || pathname === "/" || pathname === "/page") {
  router.replace(isSignedIn ? "/home" : "/(auth)/sign-up")
    }
  }, [isLoaded, isSignedIn, pathname, router])

  return null
}

// Revalidate cart & favorites when app returns to foreground
function ForegroundCartValidator() {
  const { items, removeItem, updateQuantity } = useCart()
  const { isSignedIn } = useAuth()
  const toast = useToast()
  const lastCheckRef = useRef(0)

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'active' && isSignedIn) {
        const now = Date.now()
        // throttle to avoid excessive calls if quick toggles
        if (now - lastCheckRef.current < 15000) return
        lastCheckRef.current = now
        try {
          // Cart revalidation
            if (items.length) {
              const { validated } = await validateCartItems(items, { updatePrices: false })
              const removedIds = validated.filter(v => v.removed).map(v => v.id)
              // Apply qty clamps
              validated.forEach(v => {
                if (!v.removed) {
                  const original = items.find(i => i.id === v.id)
                  if (original && original.quantity !== v.quantity) updateQuantity(v.id, v.quantity)
                }
              })
              removedIds.forEach(id => removeItem(id))
              if (removedIds.length) {
                toast.show(`${removedIds.length} cart item(s) removed (no longer available)`, { type: 'info' })
              }
            }
          // Favorites re-fetch to detect deletions (lightweight)
          try {
            const favs = await getJSON('/api/favorites')
            const deletedCount = Array.isArray(favs) ? favs.filter(f => f.productDeleted).length : 0
            if (deletedCount) {
              toast.show(`${deletedCount} favorite listing(s) were removed`, { type: 'info' })
            }
          } catch {}
        } catch (_err) {
          // Silent; could log
        }
      }
    })
    return () => sub.remove()
  }, [items, isSignedIn, removeItem, updateQuantity, toast])
  return null
}
