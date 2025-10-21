"use client"

import { Tabs } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { View } from 'react-native'
import CountBadge from '../../components/CountBadge'
import { useFavorites } from '../../context/favorites'
import { useChat } from '../../context/chat'
import { useUser } from '@clerk/clerk-expo'

export default function TabsLayout() {
  // Show the number of FAVORITES on the Favorites tab (not cart items)
  const { favorites } = useFavorites()
  const { chatRooms } = useChat()
  const { user } = useUser()
  const favCount = Array.isArray(favorites) ? favorites.length : 0
  const myId = user?.emailAddresses?.[0]?.emailAddress || user?.id || null
  const unreadTotal = Array.isArray(chatRooms)
    ? chatRooms.reduce((sum, r) => {
        const count = Number(r?.unreadCount) || 0
        if (!count) return sum
        // Only count if last message appears to be from someone else when that data is available
        const lastFromOther = r?.lastMessageUserId ? (String(r.lastMessageUserId) !== String(myId)) : true
        return sum + (lastFromOther ? count : 0)
      }, 0)
    : 0
  return (
      <Tabs
        initialRouteName="home"
        screenOptions={{
          tabBarActiveTintColor: "#16a34a",
          tabBarInactiveTintColor: "#6b7280",
          tabBarStyle: {
            backgroundColor: "#ffffff",
            borderTopWidth: 1,
            borderTopColor: "#e5e7eb",
            paddingBottom: 5,
            paddingTop: 5,
            height: 60,
          },
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="home"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="search"
          options={{
            title: "Search",
            tabBarIcon: ({ color, size }) => <Ionicons name="search" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: "Messages",
            tabBarIcon: ({ color, size }) => (
              <View>
                <Ionicons name="chatbubbles" size={size} color={color} />
                {unreadTotal > 0 && (
                  <CountBadge
                    count={unreadTotal}
                    max={99}
                    style={{ position: 'absolute', top: -6, right: -12 }}
                  />
                )}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="favourites"
          options={{
            title: "Favourites",
            tabBarIcon: ({ color, size }) => (
              <View>
                <Ionicons name="heart" size={size} color={color} />
                {favCount > 0 && (
                  <CountBadge
                    count={favCount}
                    max={99}
                    style={{ position: 'absolute', top: -6, right: -12 }}
                  />
                )}
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }) => <Ionicons name="person" size={size} color={color} />,
          }}
        />
      </Tabs>
  )
}
