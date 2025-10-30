import { COLORS } from '../../constants/colors'
import { View, Text, ActivityIndicator, ScrollView, TouchableOpacity, RefreshControl } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useProfile } from '../../context/profile'
import { useLogout } from '../../hooks/useLogout'
import { useCallback, useState } from 'react'
import { router } from 'expo-router'
import UserDashboard from './UserDashboard'
import { profileStyles as styles } from '../../assets/styles/(tabs)/profile.styles'

export default function AdminDashboard() {
  const { profile, loading: profileLoading, refresh: refreshProfile } = useProfile()
  const { signingOut, logout: confirmLogout } = useLogout()
  const [refreshing, setRefreshing] = useState(false)

  const name = profile?.fullName || profile?.username || 'User'


  const onRefresh = useCallback(async () => {
    setRefreshing(true)
  await Promise.all([refreshProfile()])
    setRefreshing(false)
  }, [refreshProfile])

  // Logout now handled by shared useLogout hook

  // No extra admin prefetch required now

  if (profileLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading profile…</Text>
      </View>
    )
  }

  // Relative time helper removed with Clerk section

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#f3f4f6' }}
      contentContainerStyle={{ paddingBottom: 48 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Mirror the user dashboard UI */}
      <UserDashboard expectedRole={profile?.role === 'farmer' ? 'farmer' : 'buyer'} fallbackName={name} />

      {/* Admin-only tools moved into System drawer */}

      {/* System Analytics entry */}
      <View style={[styles.sectionBlock, { paddingHorizontal: 16 }]}>        
        <TouchableOpacity
          style={styles.ordersButton}
          activeOpacity={0.9}
          onPress={() => router.push('/dashboard/system')}
          accessibilityLabel="System Analytics"
        >
          <Ionicons name={'stats-chart-outline'} size={18} color={COLORS.white} style={styles.ordersButtonIcon} />
          <Text style={styles.ordersButtonText}>System</Text>
        </TouchableOpacity>
        <Text style={styles.ordersButtonHint}>Open System Analytics Dashboard</Text>
      </View>

      {/* Verification Reviews and Reports have been integrated into the System drawer */}

      {/* Logout at bottom */}
      <View style={styles.logoutContainer}>
        <TouchableOpacity
          onPress={confirmLogout}
          disabled={signingOut}
          style={[styles.logoutButton, signingOut && styles.logoutButtonDisabled]}
          activeOpacity={0.85}
        >
          {signingOut ? (
            <View style={styles.logoutRow}>
              <ActivityIndicator size="small" color={COLORS.white} />
              <Text style={styles.logoutText}>Logging out…</Text>
            </View>
          ) : (
            <Text style={styles.logoutText}>Log Out</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

// Clerk Sync section removed; tools now live in System
