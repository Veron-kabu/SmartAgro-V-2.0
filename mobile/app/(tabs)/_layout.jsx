"use client"

import { Tabs } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { View, Text } from 'react-native'
import { useCart } from '../../context/cart'

export default function TabsLayout() {
  const { items: cartItems } = useCart()
  const cartCount = cartItems.reduce((n,i)=> n + (i.quantity||0), 0)
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
      {/* Messages tab removed; accessed via Profile -> Chat section */}
      <Tabs.Screen
        name="favourites"
        options={{
          title: "Favourites",
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="heart" size={size} color={color} />
              {cartCount > 0 && (
                <View style={{ position:'absolute', top:-4, right:-10, backgroundColor:'#ef4444', borderRadius:10, minWidth:18, paddingHorizontal:4, height:18, alignItems:'center', justifyContent:'center' }}>
                  <Text style={{ color:'#fff', fontSize:10, fontWeight:'700' }} numberOfLines={1}>{cartCount > 99 ? '99+' : cartCount}</Text>
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
  )
}
