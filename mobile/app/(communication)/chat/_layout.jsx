import { Stack } from 'expo-router';
import React from 'react';

export default function ChatLayout() {
  return (
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="conversation" />
        <Stack.Screen name="new-chat" />
        <Stack.Screen name="test" />
      </Stack>
  );
}