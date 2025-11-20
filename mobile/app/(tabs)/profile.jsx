"use client"

import { View, ActivityIndicator, Text } from "react-native"
import { useProfile } from "../../context/profile"
import UserDashboard from "../dashboard/UserDashboard"
import AdminDashboard from "../dashboard/admin"
import { useFocusEffect } from "expo-router"
import { useCallback } from "react"
import { profileStyles as styles } from "../../assets/styles/(tabs)/profile.styles"
import { COLORS } from "../../constants/colors"

export default function ProfileTab() {
  const { profile, loading, refresh } = useProfile()
  
  // Refresh profile when tab comes into focus (e.g., after verification)
  useFocusEffect(
    useCallback(() => {
      refresh()
    }, [refresh])
  )

  const isAdmin = profile?.role === 'admin'
  // Admins previously navigated to a separate Admin screen which lives
  // outside the bottom Tabs layout. That hides the tab bar. To keep the
  // tabs visible for admins we render the admin dashboard inline here.
  // If you prefer a full-screen admin console without tabs, revert to
  // using `router.replace('/dashboard/admin')` instead.


  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </View>
    )
  }

  if (isAdmin) {
    // Render the Admin dashboard inside the Profile tab so the bottom
    // tab bar remains visible and admins keep the same navigation chrome.
    return <AdminDashboard />
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
