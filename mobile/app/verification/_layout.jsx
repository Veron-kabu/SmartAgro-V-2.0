import { Stack } from 'expo-router'

export default function VerificationLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" options={{ title: 'Farm Verification' }} />
      <Stack.Screen name="camera" options={{ title: 'Capture Photos' }} />
      <Stack.Screen name="submit" options={{ title: 'Submit Verification' }} />
      <Stack.Screen name="verification-reviews" options={{ title: 'Verification Reviews' }} />
      <Stack.Screen name="verification-reviews/[id]" />
    </Stack>
  )
}
