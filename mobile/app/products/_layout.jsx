import { Stack, usePathname } from 'expo-router'
import { Platform } from 'react-native'
import BackButton from '../../components/navigation/BackButton'
import { COLORS } from '../../constants/colors'
import { useEffect } from 'react'
import { setLastRoute } from '../../utils/navHistory'

export default function ProductsLayout() {
  const pathname = usePathname()
  useEffect(() => { if (pathname?.startsWith('/products')) setLastRoute('products', pathname) }, [pathname])
  return (
    <Stack
      screenOptions={{
        headerTitle: 'Products',
        headerLargeTitle: Platform.OS === 'ios',
        headerShadowVisible: false,
        headerLeft: () => (<BackButton color={COLORS.text} fallbackRoute="/home" stackKey="products" />),
      }}
    >
      {/* Product details page inherits the back button */}
      <Stack.Screen name="[id]" options={{ headerTitle: 'Product' }} />
    </Stack>
  )
}
