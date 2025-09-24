"use client"

import { View, ActivityIndicator, Text } from "react-native"
import { useProfile } from "../../context/profile"
import UserDashboard from "../dashboard/UserDashboard"

export default function ProfileTab() {
  const { profile, loading } = useProfile()

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading profile…</Text>
      </View>
    )
  }

  const role = profile?.role === 'farmer' ? 'farmer' : 'buyer'
  const title = role === 'farmer' ? 'Farmer Profile' : 'Buyer Profile'
  const fallbackName = role === 'farmer' ? 'Farmer' : 'Buyer'

  return <UserDashboard expectedRole={role} title={title} fallbackName={fallbackName} />
}
