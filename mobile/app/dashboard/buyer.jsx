import { View, Text } from 'react-native'
import { useEffect } from 'react'
import { useProfile } from '../../context/profile'
import RoleSwitcher from '../../components/RoleSwitcher'

// const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001'

export default function BuyerDashboard() {
  const { profile, refresh } = useProfile()
  useEffect(() => { if (!profile) refresh() }, [profile, refresh])

  const name = profile?.fullName || profile?.username || 'User'
  const role = profile?.role || 'buyer'

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 }}>
      <Text>Buyer Dashboard</Text>
      <Text style={{ marginTop: 8 }}>Welcome, {name}</Text>
      <Text style={{ marginTop: 4 }}>Role: {role}</Text>
      <View style={{ height: 16 }} />
      <Text>Switch Role</Text>
      <View style={{ marginTop: 8 }}>
        <RoleSwitcher />
      </View>
    </View>
  )
}
