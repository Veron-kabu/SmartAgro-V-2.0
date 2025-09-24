import { Stack } from 'expo-router'
import { Platform } from 'react-native'

export default function OrdersLayout() {
  return (
    <Stack
      screenOptions={{
        headerTitle: 'Orders',
        headerLargeTitle: Platform.OS === 'ios',
        headerShadowVisible: false,
      }}
    />
  )
}
