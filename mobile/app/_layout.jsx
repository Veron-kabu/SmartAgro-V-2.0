import { Stack } from "expo-router"
import { ClerkProvider } from "@clerk/clerk-expo"
import { ProfileProvider } from "../context/profile"
import { CartProvider } from "../context/cart"
import * as SecureStore from "expo-secure-store"

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
  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <ProfileProvider>
        <CartProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </CartProvider>
      </ProfileProvider>
    </ClerkProvider>
  )
}
