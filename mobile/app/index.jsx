"use client"

import { useEffect } from "react"
import { useAuth } from "@clerk/clerk-expo"
import { router } from "expo-router"
import { View, Text, StyleSheet } from "react-native"

export default function IndexScreen() {
  const { isSignedIn, isLoaded } = useAuth()

  useEffect(() => {
    if (!isLoaded) return

    if (isSignedIn) {
      router.replace("/(tabs)")
    } else {
      router.replace("/(auth)/sign-up")
    }
  }, [isSignedIn, isLoaded])

  // Show loading while checking auth status
  return (
    <View style={styles.container}>
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  loadingText: {
    fontSize: 16,
    color: "#6b7280",
  },
})
