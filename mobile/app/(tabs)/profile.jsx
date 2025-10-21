"use client"

import { View, ActivityIndicator, Text } from "react-native"
import { useEffect } from 'react'
import { useProfile } from "../../context/profile"
import UserDashboard from "../dashboard/UserDashboard"
import { router } from 'expo-router'
import { profileStyles as styles } from "../../assets/styles/(tabs)/profile.styles"
import { COLORS } from "../../constants/colors"

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
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    )
  }

  if (isAdmin) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Opening admin console…</Text>
      </View>
    )
  }

  const role = profile?.role === 'farmer' ? 'farmer' : 'buyer'
  const title = role === 'farmer' ? 'Farmer Profile' : 'Buyer Profile'
  const fallbackName = role === 'farmer' ? 'Farmer' : 'Buyer'

  return (
    <>
      <UserDashboard expectedRole={role} title={title} fallbackName={fallbackName} />
    </>
  )
}
