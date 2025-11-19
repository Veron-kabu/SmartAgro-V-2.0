import React from 'react'
import { Stack, router } from 'expo-router'
import { TouchableOpacity, Text } from 'react-native'

export default function VerificationLayout() {
  return (
    <Stack screenOptions={{ headerShown: true }}>
      <Stack.Screen name="index" options={{ title: 'Farm Verification' }} />
      <Stack.Screen name="camera" options={{ title: 'Capture Photos' }} />
      <Stack.Screen name="submit" options={{ title: 'Submit Verification' }} />
      <Stack.Screen name="verification-reviews" options={{ title: 'Verification Reviews' }} />
      <Stack.Screen
        name="verification-reviews/[id]"
        options={{
          title: 'Verification Detail',
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => {
                try {
                  if (router.canGoBack?.()) router.back()
                  else router.replace('/verification/verification-reviews')
                } catch {
                  router.replace('/verification/verification-reviews')
                }
              }}
              style={{ paddingHorizontal: 12, paddingVertical: 6 }}
              hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
            >
              <Text style={{ color: '#2563eb', fontSize: 16, fontWeight: '600' }}>Back</Text>
            </TouchableOpacity>
          ),
        }}
      />
    </Stack>
  )
}
