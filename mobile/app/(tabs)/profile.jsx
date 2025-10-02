"use client"

import { View, ActivityIndicator, Text } from "react-native"
import { useEffect } from 'react'
import { useProfile } from "../../context/profile"
import UserDashboard from "../dashboard/UserDashboard"
import { router } from 'expo-router'

export default function ProfileTab() {
  const { profile, loading } = useProfile()

  const isAdmin = profile?.role === 'admin'
  // Fire redirect effect early; runs every render but only triggers navigation when admin and not already there.
  useEffect(() => {
    if (!loading && isAdmin) {
      router.replace('/dashboard/admin')
    }
  }, [loading, isAdmin])

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading profile…</Text>
      </View>
    )
  }

  if (isAdmin) {
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center' }}>
        <ActivityIndicator />
        <Text style={{ marginTop:8 }}>Opening admin console…</Text>
      </View>
    )
  }

  const role = profile?.role === 'farmer' ? 'farmer' : 'buyer'
  const title = role === 'farmer' ? 'Farmer Profile' : 'Buyer Profile'
  const fallbackName = role === 'farmer' ? 'Farmer' : 'Buyer'

  return <UserDashboard expectedRole={role} title={title} fallbackName={fallbackName} />
}
