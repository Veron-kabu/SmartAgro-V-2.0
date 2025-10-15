import { Stack, usePathname } from 'expo-router'
import { Platform } from 'react-native'
import BackButton from '../../components/navigation/BackButton'
import { COLORS } from '../../constants/colors'
import { useEffect } from 'react'
import { setLastRoute } from '../../utils/navHistory'

export default function FundsLayout() {
  const pathname = usePathname()
  useEffect(() => { if (pathname?.startsWith('/funds')) setLastRoute('funds', pathname) }, [pathname])
  return (
    <Stack
      screenOptions={{
        headerTitle: 'Funds',
        headerLargeTitle: Platform.OS === 'ios',
        headerShadowVisible: false,
        headerLeft: () => (<BackButton color={COLORS.text} fallbackRoute="/funds" stackKey="funds" />),
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Funds', headerLeft: () => null, headerBackVisible: false }} />
      <Stack.Screen name="earnings" options={{ title: 'Earnings' }} />
      <Stack.Screen name="transactions" options={{ title: 'Transactions' }} />
  {/** Withdrawals removed */}
    </Stack>
  )
}
