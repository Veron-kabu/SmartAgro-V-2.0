import { Stack, usePathname } from 'expo-router'
import { Platform } from 'react-native'
import BackButton from '../../components/navigation/BackButton'
import { COLORS } from '../../constants/colors'
import { useEffect } from 'react'
import { setLastRoute } from '../../utils/navHistory'

export default function OrdersLayout() {
  // Record last visited Orders route for smarter fallbacks
  const pathname = usePathname()
  useEffect(() => { if (pathname?.startsWith('/orders')) setLastRoute('orders', pathname) }, [pathname])
  return (
    <Stack
      screenOptions={{
        headerTitle: 'Orders',
        headerLargeTitle: Platform.OS === 'ios',
        headerShadowVisible: false,
        // Always render a robust back button with a fallback to the last Orders route or the Orders hub
        headerLeft: () => (<BackButton color={COLORS.text} fallbackRoute="/orders" stackKey="orders" />),
      }}
    >
      {/* Orders hub (root): no back button */}
      <Stack.Screen name="index" options={{ headerLeft: () => null, headerBackVisible: false }} />
      {/* Other screens inherit the BackButton with fallback to /orders */}
  <Stack.Screen name="buyerorders" options={{ headerTitle: 'Orders' }} />
  {/* Use a neutral title here; the screen itself will present the specific section title (Incoming vs Fulfilled) */}
  <Stack.Screen name="farmerorders" options={{ headerTitle: 'Orders' }} />
      <Stack.Screen name="new" options={{ headerTitle: 'New Order' }} />
      <Stack.Screen name="checkout" options={{ headerTitle: 'Checkout' }} />
      <Stack.Screen name="order-details" options={{ headerTitle: 'Order Details' }} />
    </Stack>
  )
}
