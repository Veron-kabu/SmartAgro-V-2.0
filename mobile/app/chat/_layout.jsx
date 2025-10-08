import { Stack } from 'expo-router';
import React from 'react';
import { ChatProvider } from '../../context/chat';

export default function ChatLayout() {
  return (
    <ChatProvider>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="messages" />
        <Stack.Screen name="new-chat" />
        <Stack.Screen name="test" />
      </Stack>
    </ChatProvider>
  );
}