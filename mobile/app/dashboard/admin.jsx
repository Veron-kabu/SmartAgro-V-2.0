import { View, Text } from 'react-native'
import { useEffect, useState } from 'react'
import { getJSON } from '../../context/api'

const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001'

export default function AdminDashboard() {
  const [profile, setProfile] = useState(null)
  useEffect(() => {
    let mounted = true
    getJSON(`${apiUrl}/api/users/profile`).then((p) => {
      if (mounted) setProfile(p)
    }).catch(() => {})
    return () => { mounted = false }
  }, [])

  const name = profile?.fullName || profile?.username || 'User'
  const role = profile?.role || 'admin'

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text>Admin Dashboard</Text>
      <Text style={{ marginTop: 8 }}>Welcome, {name}</Text>
      <Text style={{ marginTop: 4 }}>Role: {role}</Text>
    </View>
  )
}
