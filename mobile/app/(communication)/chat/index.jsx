import React, { useLayoutEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useChat } from '../../../context/chat';
import { messagesTabStyles as styles, COLORS } from '../../../assets/styles/chats/messages.tab.styles';
import EmptyState from '../../../components/EmptyState';
import CountBadge from '../../../components/CountBadge';

export default function ChatIndex() {
  const { chatRooms, setCurrentChatRoom, isFirebaseReady } = useChat();
  const { isLoaded: authIsLoaded, isSignedIn } = useAuth();
  const { user, isLoaded: userIsLoaded } = useUser();
  const router = useRouter();
  const navigation = useNavigation();
  
  // Combined loading state
  const clerkIsLoaded = authIsLoaded && userIsLoaded;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false, // Use custom header
    });
  }, [navigation]);

  const handleChatRoomPress = (chatRoom) => {
    setCurrentChatRoom(chatRoom);
    router.push('/chat/conversation');
  };

  const renderDivider = () => (
    <View style={styles.divider} />
  );

  const renderChatRoom = ({ item }) => {
    // Compute display name: prefer the other participant relative to current user
    const currentUserEmail = user?.emailAddresses?.[0]?.emailAddress || user?.id;
    const otherParticipant = item.participants?.find(p => p !== currentUserEmail);
    let displayName = '';
    if (otherParticipant) {
      displayName = otherParticipant.includes('@') ? otherParticipant.split('@')[0] : otherParticipant;
    } else if (item.name) {
      // Fallback to room name, stripping common prefixes and email domains if present
      const n = item.name.replace(/^Chat with\s+/i, '');
      displayName = n.includes('@') ? n.split('@')[0] : n;
    } else {
      displayName = 'Chat';
    }
    
    // Get first letter of display name for avatar
    const avatarLetter = displayName ? displayName.charAt(0).toUpperCase() : 'U';
    
    // Format timestamp for WhatsApp-like display
    const formatTime = (timestamp) => {
      if (!timestamp) return '';
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const now = new Date();
      const diffInHours = Math.abs(now - date) / 36e5;
      
      if (diffInHours < 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } else if (diffInHours < 168) { // Less than a week
        return date.toLocaleDateString([], { weekday: 'short' });
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      }
    };

    // Simulate online status (you can replace this with real data)
    const isOnline = Math.random() > 0.5; // Random for demo

    return (
      <TouchableOpacity
        style={styles.chatRoomItem}
        onPress={() => handleChatRoomPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          <View style={styles.profileImage}>
            <Text style={styles.avatarText}>{avatarLetter}</Text>
          </View>
          {isOnline && <View style={styles.onlineIndicator} />}
        </View>
        <View style={styles.chatRoomInfo}>
          <Text style={styles.chatRoomName}>{displayName}</Text>
          {item.lastMessage ? (
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage}
            </Text>
          ) : (
            <Text style={styles.noMessageText} numberOfLines={1}>
              No messages yet
            </Text>
          )}
        </View>
        <View style={styles.chatRoomMeta}>
          {item.lastMessageTime && (
            <Text style={styles.timestamp}>
              {formatTime(item.lastMessageTime)}
            </Text>
          )}
          {Number(item?.unreadCount) > 0 && (
            <CountBadge count={Number(item.unreadCount)} max={99} style={{ marginTop: 6 }} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 
        LOADING STATE SECTION
        - Shows when app is still initializing
        - Displays spinner and loading text
        - Waits for Clerk auth and Firebase to be ready
      */}
      {(!clerkIsLoaded || !isFirebaseReady) && (
        <View style={styles.emptyContainer}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.loadingColor} />
            <Text style={styles.loadingText}>Loading...</Text>
            <Text style={styles.loadingSubtext}>
              {!clerkIsLoaded ? 'Initializing authentication...' : 'Connecting to chat service...'}
            </Text>
          </View>
        </View>
      )}

      {/* 
        NOT SIGNED IN STATE SECTION
        - Shows when user is not authenticated
        - Displays sign-in prompt with person icon
        - Explains they need to sign in to use chat
      */}
      {clerkIsLoaded && isFirebaseReady && (!isSignedIn || !user) && (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <Ionicons name="person-outline" size={64} color={COLORS.emptyStateIconColor} />
          </View>
          <Text style={styles.emptyText}>Please sign in</Text>
          <Text style={styles.emptySubtext}>
            You need to be signed in to use the chat feature and connect with farmers and buyers
          </Text>
        </View>
      )}

      {/* 
        MESSAGES LIST SECTION (Main Chat Screen)
        - Shows list of all chat conversations
        - Includes custom header with "Messages" title and action buttons
        - Shows empty state if no chats exist, or FlatList of chat rooms
      */}
      {clerkIsLoaded && isFirebaseReady && isSignedIn && user && (
        <>
          {/* Custom Header with title and action buttons */}
          <View style={styles.header}>
            <Text style={styles.title}>Messages</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => router.push('/chat/test')}
              >
                <Ionicons name="bug" size={20} color={COLORS.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => router.push('/chat/new-chat')}
              >
                <Ionicons name="add" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Chat Rooms List or Empty State */}
          {chatRooms.length === 0 ? (
            <View style={styles.emptyContainer}>
              <EmptyState
                context="messages"
                title="No chats yet"
                actionLabel="New Chat"
                actionIcon="add"
                onAction={() => router.push('/chat/new-chat')}
              />
            </View>
          ) : (
            // List of existing chat rooms
            <FlatList
              data={chatRooms}
              renderItem={renderChatRoom}
              keyExtractor={(item) => item.id}
              style={styles.list}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={renderDivider}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

