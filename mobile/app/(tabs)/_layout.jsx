"use client"

import { Tabs } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { View, Text } from 'react-native'
import { useFavorites } from '../../context/favorites'
import { ChatProvider } from '../../context/chat'

export default function TabsLayout() {
  // Show the number of FAVORITES on the Favorites tab (not cart items)
  const { favorites } = useFavorites()
  const favCount = Array.isArray(favorites) ? favorites.length : 0
  return (
    <ChatProvider>
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
            tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles" size={size} color={color} />,
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
                  <View style={{ position:'absolute', top:-4, right:-10, backgroundColor:'#ef4444', borderRadius:10, minWidth:18, paddingHorizontal:4, height:18, alignItems:'center', justifyContent:'center' }}>
                    <Text style={{ color:'#fff', fontSize:10, fontWeight:'700' }} numberOfLines={1}>{favCount > 99 ? '99+' : favCount}</Text>
                  </View>
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
    </ChatProvider>
  )
}
