import { Stack, usePathname, useRouter } from 'expo-router'
import { useAuth, useUser } from '@clerk/clerk-expo'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, View, Text } from 'react-native'
import { useProfile } from '../../context/profile'
// Role will be derived from profile context; avoid direct API calls that may 404 during auto-create

export default function DashboardLayout() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const pathname = usePathname()
  const router = useRouter()
  const { profile, loading: profileLoading } = useProfile()
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  // Derive role from profile context; fallback to Clerk metadata
  useEffect(() => {
    if (!isSignedIn) {
      setRole(null)
      setLoading(false)
      router.replace('/(auth)/sign-in')
      return
    }
    // while profile is loading (auto-create may be in progress), keep loading
    if (profileLoading) {
      setLoading(true)
      return
    }
    const nextRole = profile?.role || user?.unsafeMetadata?.role || null
    setRole(nextRole)
    setLoading(false)
  }, [isSignedIn, profile?.role, user?.unsafeMetadata?.role, profileLoading, router])

  const targetRoute = useMemo(() => {
    if (!role) return null
    if (role === 'farmer') return '/dashboard/farmer'
    if (role === 'buyer') return '/dashboard/buyer'
    if (role === 'admin') return '/dashboard/admin'
    return null
  }, [role])

  useEffect(() => {
    if (!loading && targetRoute) {
      const onRolePath = pathname && pathname.startsWith(targetRoute)
      if (!onRolePath) {
        router.replace(targetRoute)
      }
    }
  }, [loading, targetRoute, pathname, router])

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Loading dashboard…</Text>
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="farmer" />
      <Stack.Screen name="buyer" />
      <Stack.Screen name="admin" />
    </Stack>
  )
}
