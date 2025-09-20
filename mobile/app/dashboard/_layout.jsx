import { Stack, usePathname, useRouter } from 'expo-router'
import { useAuth, useUser } from '@clerk/clerk-expo'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, View, Text } from 'react-native'
import { getJSON } from '../../context/api'

const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001'

export default function DashboardLayout() {
  const { isSignedIn } = useAuth()
  const { user } = useUser()
  const pathname = usePathname()
  const router = useRouter()
  const [role, setRole] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch role from backend; fallback to Clerk unsafeMetadata.role
  useEffect(() => {
    let mounted = true
    async function run() {
      if (!isSignedIn) {
        setRole(null)
        setLoading(false)
        router.replace('/(auth)/sign-in')
        return
      }
      try {
        const profile = await getJSON(`${apiUrl}/api/users/profile`)
        if (mounted) setRole(profile?.role || null)
  } catch (_e) {
        // Fallback to Clerk metadata if DB profile not found yet
        if (mounted) setRole(user?.unsafeMetadata?.role || null)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    return () => {
      mounted = false
    }
  }, [isSignedIn, user?.unsafeMetadata?.role, router])

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
