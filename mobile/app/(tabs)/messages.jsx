import React, { useLayoutEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useChat } from '../../context/chat';
import { GiftedChat } from 'react-native-gifted-chat';

export default function MessagesTab() {
  const { chatRooms, setCurrentChatRoom, currentChatRoom, isFirebaseReady, messages, sendMessage, getCurrentUser } = useChat();
  const { isLoaded: authIsLoaded, isSignedIn } = useAuth();
  const { user, isLoaded: userIsLoaded } = useUser();
  const router = useRouter();
  const navigation = useNavigation();
  
  // Combined loading state
  const clerkIsLoaded = authIsLoaded && userIsLoaded;

  // Remove auto-navigation since we'll show chat interface within this tab
  // useEffect(() => {
  //   if (currentChatRoom && isFirebaseReady && clerkIsLoaded && isSignedIn) {
  //     const timer = setTimeout(() => {
  //       router.push('/chat/messages');
  //     }, 100);
  //     return () => clearTimeout(timer);
  //   }
  // }, [currentChatRoom, isFirebaseReady, clerkIsLoaded, isSignedIn, router]);

  const onSend = useCallback((messages = []) => {
    sendMessage(messages);
  }, [sendMessage]);

  const currentUser = getCurrentUser();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: currentChatRoom ? (currentChatRoom.name || 'Chat') : 'Messages',
      headerStyle: {
        backgroundColor: '#16a34a',
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
      headerLeft: currentChatRoom ? () => (
        <TouchableOpacity
          style={{ marginLeft: 15 }}
          onPress={() => setCurrentChatRoom(null)}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      ) : undefined,
      headerRight: !currentChatRoom ? () => (
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/chat/test')}
          >
            <Ionicons name="bug" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/chat/new-chat')}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : undefined,
    });
  }, [navigation, router, currentChatRoom, setCurrentChatRoom]);

  const handleChatRoomPress = (chatRoom) => {
    setCurrentChatRoom(chatRoom);
    // Don't navigate away - just set the chat room to show interface within this tab
  };

  const renderChatRoom = ({ item }) => (
    <TouchableOpacity
      style={styles.chatRoomItem}
      onPress={() => handleChatRoomPress(item)}
    >
      <View style={styles.avatarContainer}>
        <Ionicons name="person-circle" size={50} color="#16a34a" />
      </View>
      <View style={styles.chatRoomInfo}>
        <Text style={styles.chatRoomName}>{item.name}</Text>
        {item.lastMessage && (
          <Text style={styles.lastMessage} numberOfLines={1}>
            {item.lastMessage}
          </Text>
        )}
        {item.lastMessageTime && (
          <Text style={styles.timestamp}>
            {item.lastMessageTime.toDate?.()?.toLocaleDateString() || 
             new Date(item.lastMessageTime).toLocaleDateString()}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
    </TouchableOpacity>
  );

  if (!clerkIsLoaded || !isFirebaseReady) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.emptyText}>Loading...</Text>
          <Text style={styles.emptySubtext}>
            {!clerkIsLoaded ? 'Initializing authentication...' : 'Connecting to chat service...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isSignedIn || !user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Ionicons name="person-outline" size={80} color="#9ca3af" />
          <Text style={styles.emptyText}>Please sign in</Text>
          <Text style={styles.emptySubtext}>
            You need to be signed in to use the chat feature
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Show chat interface if currentChatRoom is set
  if (currentChatRoom) {
    if (!currentUser) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Loading chat...</Text>
          </View>
        </SafeAreaView>
      );
    }

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.chatContainer}>
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
      </SafeAreaView>
    );
  }

  // Show messages list if no currentChatRoom
  return (
    <SafeAreaView style={styles.container}>
      {chatRooms.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={80} color="#9ca3af" />
          <Text style={styles.emptyText}>No conversations yet</Text>
          <Text style={styles.emptySubtext}>
            Start a new conversation to connect with other users
          </Text>
          <TouchableOpacity
            style={styles.startChatButton}
            onPress={() => router.push('/chat/new-chat')}
          >
            <Text style={styles.startChatButtonText}>Start New Chat</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={chatRooms}
          renderItem={renderChatRoom}
          keyExtractor={(item) => item.id}
          style={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerButton: {
    marginRight: 15,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#fff',
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
  list: {
    flex: 1,
  },
  chatRoomItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  avatarContainer: {
    marginRight: 15,
  },
  chatRoomInfo: {
    flex: 1,
  },
  chatRoomName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  timestamp: {
    fontSize: 12,
    color: '#9ca3af',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 30,
  },
  startChatButton: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  startChatButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});