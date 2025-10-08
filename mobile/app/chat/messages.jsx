import React, { useLayoutEffect, useCallback } from 'react';
import { useNavigation } from 'expo-router';
import { GiftedChat } from 'react-native-gifted-chat';
import { View, StyleSheet, Text } from 'react-native';
import { useChat } from '../../context/chat';

export default function ChatMessages() {
  const { messages, sendMessage, getCurrentUser, currentChatRoom, isFirebaseReady } = useChat();
  const navigation = useNavigation();
  const currentUser = getCurrentUser();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: currentChatRoom?.name || 'Chat',
      headerStyle: {
        backgroundColor: '#16a34a',
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    });
  }, [navigation, currentChatRoom]);

  const onSend = useCallback((messages = []) => {
    sendMessage(messages);
  }, [sendMessage]);

  if (!isFirebaseReady) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text>Loading chat...</Text>
      </View>
    );
  }

  if (!currentUser) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text>Please sign in to use chat</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <GiftedChat
        messages={messages}
        onSend={onSend}
        user={currentUser}
        showAvatarForEveryMessage={false}
        showUserAvatar={true}
        messagesContainerStyle={styles.messagesContainer}
        textInputStyle={styles.textInput}
        renderTime={() => null}
        placeholder="Type a message..."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  messagesContainer: {
    backgroundColor: '#f9fafb',
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 15,
    paddingVertical: 10,
    marginHorizontal: 10,
    marginBottom: 45,
  },
});