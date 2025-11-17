import { Drawer } from 'expo-router/drawer'
import { Ionicons } from '@expo/vector-icons'
import { View, Text, TouchableOpacity } from 'react-native'
import { COLORS } from '../../../constants/colors'
import useAnomalies from '../../../hooks/useAnomalies'
import { useToast } from '../../../context/toast'
import { router } from 'expo-router'
import { DrawerToggleButton } from '@react-navigation/drawer'

export default function SystemDrawerLayout() {
  const toast = useToast()
  const { unread, markRead } = useAnomalies({
    intervalMs: 15000,
    onNew: (item) => {
      const title = item?.title || 'Suspicious activity detected'
      // Map to a warning toast
      try { toast.show(title, { type: 'error' }) } catch {}
    }
  })
  return (
    <Drawer
      screenOptions={{
        headerShown: true,
        headerTitle: 'System Analytics',
        headerTintColor: COLORS.white,
        headerStyle: { backgroundColor: COLORS.primary },
        drawerActiveTintColor: COLORS.primary,
        drawerType: 'front',
        swipeEdgeWidth: 60,
        swipeEnabled: true,
        headerLeft: () => (
          <View style={{ marginLeft: 4, flexDirection:'row', alignItems:'center' }}>
            {/* Far-left hamburger menu to open the drawer on any System page */}
            <DrawerToggleButton tintColor="#fff" />
            {/* Optional inline back button next to menu */}
            <TouchableOpacity
              accessibilityLabel="Back"
              onPress={() => {
                try {
                  if (router.canGoBack?.()) router.back()
                  else router.replace('/dashboard/admin')
                } catch {
                  router.replace('/dashboard/admin')
                }
              }}
              style={{ marginLeft: 6 }}
            >
              <Ionicons name="arrow-back-outline" color="#fff" size={22} />
            </TouchableOpacity>
          </View>
        ),
        headerRight: () => (
          <View style={{ marginRight: 12 }}>
            <TouchableOpacity onPress={markRead} accessibilityLabel="Anomalies">
              <View style={{ position:'relative' }}>
                <Ionicons name="warning-outline" color="#fff" size={20} />
                {unread>0 && (
                  <View style={{ position:'absolute', right:-6, top:-6, backgroundColor:'#ef4444', borderRadius:999, paddingHorizontal:5, paddingVertical:1 }}>
                    <Text style={{ color:'#fff', fontSize:10, fontWeight:'800' }}>{unread}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>
        ),
      }}
    >
      <Drawer.Screen
        name="index"
        options={{
          title: 'Overview',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="users"
        options={{
          title: 'Users',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="listings"
        options={{
          title: 'Listings',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Removed marketplace-insights and transactions screens (files deleted) */}
      {/* Removed system-health, engagement, admin-tools and clerk-sync screens (files deleted) */}
      <Drawer.Screen
        name="verification-reviews"
        options={{
          title: 'Verification Reviews',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark-outline" size={size} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="reports"
        options={{
          title: 'Reports Queue',
          drawerIcon: ({ color, size }) => (
            <Ionicons name="flag-outline" size={size} color={color} />
          ),
        }}
      />
    </Drawer>
  )
}
