import { Stack } from 'expo-router'
import { Platform } from 'react-native'

export default function FundsLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitle: 'Funds',
        headerLargeTitle: Platform.OS === 'ios',
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Funds' }} />
      <Stack.Screen name="earnings" options={{ title: 'Earnings' }} />
      <Stack.Screen name="transactions" options={{ title: 'Transactions' }} />
      <Stack.Screen name="withdrawals" options={{ title: 'Withdrawals' }} />
    </Stack>
  )
}
