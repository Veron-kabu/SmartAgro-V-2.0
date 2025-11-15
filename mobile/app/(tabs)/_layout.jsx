"use client"

import { Tabs } from "expo-router"
import { Ionicons } from "@expo/vector-icons"
import { View } from 'react-native'
import CountBadge from '../../components/CountBadge'
import { useFavorites } from '../../context/favorites'
import { useCart } from '../../context/cart'

export default function TabsLayout() {
  // Show the number of FAVORITES on the Favorites tab (not cart items)
  const { favorites } = useFavorites()
  const favCount = Array.isArray(favorites) ? favorites.length : 0
  const { items: cartItems } = useCart()
  const cartCount = Array.isArray(cartItems) ? cartItems.length : 0
  return (
      <Tabs
        initialRouteName="home"
        screenOptions={{
          tabBarActiveTintColor: "#16a34a",
          tabBarInactiveTintColor: "#6b7280",
          tabBarStyle: {
            backgroundColor: "#ab0a0aff",
            borderTopWidth: 1,
            borderTopColor: "#0b5af8ff",
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
        {/** Messages tab removed; access messages via Profile -> Messages button */}
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
          name="cart"
          options={{
            title: "Cart",
            tabBarIcon: ({ color, size }) => (
              <View>
                <Ionicons name="cart" size={size} color={color} />
                {cartCount > 0 && (
                  <CountBadge
                    count={cartCount}
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
