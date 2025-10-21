import React from 'react'
import { Stack } from 'expo-router'

export default function VerificationLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: 'Farm Verification' }} />
      <Stack.Screen name="camera" options={{ title: 'Capture Photos' }} />
      <Stack.Screen name="submit" options={{ title: 'Submit Verification' }} />
    </Stack>
  )
}
