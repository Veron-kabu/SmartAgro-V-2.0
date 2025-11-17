import { COLORS } from '../../constants/colors'
import { View, Text, ActivityIndicator, ScrollView, TouchableOpacity, RefreshControl } from 'react-native'
import { useProfile } from '../../context/profile'
import { useLogout } from '../../hooks/useLogout'
import { useCallback, useState } from 'react'
// Removed unused imports: Ionicons, router
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

      {/* System Analytics moved into Services grid in UserDashboard */}

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
