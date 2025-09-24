import { View, Text, ActivityIndicator } from 'react-native'
import { useProfile } from '../../context/profile'
// Base URL is centralized in the API client; pass only paths

export default function AdminDashboard() {
  const { profile, loading } = useProfile()

  const name = profile?.fullName || profile?.username || 'User'
  const role = profile?.role || 'admin'
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading…</Text>
      </View>
    )
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Admin Dashboard</Text>
      <Text style={{ marginTop: 8 }}>Welcome, {name}</Text>
      <Text style={{ marginTop: 4 }}>Role: {role}</Text>
    </View>
  )
}
