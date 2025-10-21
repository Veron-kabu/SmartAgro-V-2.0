import React, { useLayoutEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  FlatList
} from 'react-native';
import { useRouter, useNavigation, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@clerk/clerk-expo';
import { useChat } from '../../context/chat';
import { BackButton } from '../../components/navigation';
import { COLORS } from '../../constants/colors';

export default function ChatConversation() {
  const { currentChatRoom, setCurrentChatRoom, messages, sendMessage } = useChat();
  const { user } = useUser();
  const router = useRouter();
  const navigation = useNavigation();
  const [newMessage, setNewMessage] = useState('');
  const flatListRef = useRef(null);

  // Debug: Log chat state
  console.log('Chat conversation state:', {
    hasCurrentChatRoom: !!currentChatRoom,
    currentChatRoomId: currentChatRoom?.id,
    messagesCount: messages?.length || 0,
    messages: messages,
    currentChatRoomParticipants: currentChatRoom?.participants,
    currentUserInfo: {
      userId: user?.id,
      userEmail: user?.emailAddresses?.[0]?.emailAddress
    }
  });

  // Check if we should redirect when the screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (!currentChatRoom) {
        // Use requestAnimationFrame to ensure navigation is ready
        const frame = requestAnimationFrame(() => {
          try {
            router.replace('/chat');
          } catch (_error) {
            // If navigation fails, try again after a short delay
            console.log('Chat navigation deferred, retrying...')
            setTimeout(() => {
              router.replace('/chat');
            }, 500);
          }
        });
        return () => cancelAnimationFrame(frame);
      }
    }, [currentChatRoom, router])
  );

  useLayoutEffect(() => {
    if (!currentChatRoom) {
      return;
    }

    // Header title should be the other participant based on current user
    let headerTitle = 'Chat';
    const currentUserEmail = user?.emailAddresses?.[0]?.emailAddress || user?.id;
    const otherParticipant = currentChatRoom.participants?.find(p => p !== currentUserEmail);
    if (otherParticipant) {
      headerTitle = otherParticipant.includes('@') ? otherParticipant.split('@')[0] : otherParticipant;
    } else if (currentChatRoom?.name) {
      const n = currentChatRoom.name.replace(/^Chat with\s+/i, '');
      headerTitle = n.includes('@') ? n.split('@')[0] : n;
    }

    navigation.setOptions({
      headerShown: true,
      title: headerTitle,
      headerStyle: {
        backgroundColor: COLORS.primary,
      },
      headerTintColor: COLORS.white,
      headerTitleStyle: {
        fontWeight: '600',
        fontSize: 18,
      },
      headerLeft: () => (
        <BackButton 
          onPress={() => {
            setCurrentChatRoom(null);
            router.back();
          }}
          color={COLORS.white}
          fallbackRoute="/chat"
        />
      ),
      headerRight: () => (
        <View style={{ flexDirection: 'row', marginRight: 10 }}>
          <TouchableOpacity style={{ marginRight: 15 }}>
            <Ionicons name="videocam" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <TouchableOpacity style={{ marginRight: 10 }}>
            <Ionicons name="call" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <TouchableOpacity>
            <Ionicons name="ellipsis-vertical" size={24} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      ),
    });

    // When opening this conversation, if the last message was from the other user, clear unread for this room
    (async () => {
      try {
        const currentUserId = user?.id || user?.emailAddresses?.[0]?.emailAddress
        const lastFromOther = currentChatRoom?.lastMessageUserId && String(currentChatRoom.lastMessageUserId) !== String(currentUserId)
        if (lastFromOther) {
          const { doc, updateDoc } = await import('firebase/firestore')
          const chatRoomRef = doc(currentChatRoom?._db || undefined, 'chatRooms', currentChatRoom.id)
          // If context doesn't hold db here, fallback no-op; ChatProvider listens and will update chatRooms
          if (chatRoomRef) {
            await updateDoc(chatRoomRef, { unreadCount: 0 })
          }
        }
      } catch (_e) {
        // best-effort; ignore
      }
    })()
  }, [navigation, router, currentChatRoom, setCurrentChatRoom, user]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    console.log('Attempting to send message:', {
      message: newMessage.trim(),
      currentChatRoom: currentChatRoom?.id,
      userInfo: {
        id: user?.id,
        email: user?.emailAddresses?.[0]?.emailAddress,
        name: user?.firstName
      }
    });
    
    try {
      const messageToSend = [{
        text: newMessage.trim(),
        createdAt: new Date(),
        user: {
          _id: user?.id || 'unknown',
          name: user?.firstName || 'User',
          email: user?.emailAddresses?.[0]?.emailAddress || '',
        },
      }];
      
      console.log('Calling sendMessage with:', messageToSend);
      await sendMessage(messageToSend);
      console.log('Message sent successfully');
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }) => {
    // Match the same logic used in chat context sendMessage
  const currentUserId = user?.id || user?.emailAddresses?.[0]?.emailAddress;
    const isMyMessage = item.user?._id === currentUserId;
    
    console.log('Rendering message:', {
      text: item.text,
      isMyMessage,
      currentUserId,
      messageUserId: item.user?._id,
      comparison: `${item.user?._id} === ${currentUserId}`
    });
    
    return (
      <View style={[
        chatStyles.messageContainer,
        isMyMessage ? chatStyles.myMessageContainer : chatStyles.otherMessageContainer
      ]}>
        <View style={[
          chatStyles.messageBubble,
          isMyMessage ? chatStyles.myMessageBubble : chatStyles.otherMessageBubble
        ]}>
          <Text style={[
            chatStyles.messageText,
            isMyMessage ? chatStyles.myMessageText : chatStyles.otherMessageText
          ]}>
            {item.text}
          </Text>
          <View style={chatStyles.messageFooter}>
            <Text style={[
              chatStyles.messageTime,
              isMyMessage ? chatStyles.myMessageTime : chatStyles.otherMessageTime
            ]}>
              {formatMessageTime(item.createdAt)}
            </Text>
            {isMyMessage && (
              <Ionicons 
                name="checkmark-done" 
                size={16} 
                color={COLORS.sentText} 
                style={{ marginLeft: 4 }} 
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  // Redirect if no chat room is selected
  if (!currentChatRoom) {
    return null;
  }

  // Handle case where messages might be undefined
  const chatMessages = messages || [];
  
  console.log('Display logic:', {
    chatMessagesLength: chatMessages.length,
    willShowSampleMessages: chatMessages.length === 0,
    firstMessage: chatMessages[0],
    actualMessagesExist: chatMessages.length > 0
  });
  
  // Show real messages if they exist, otherwise show helpful placeholder
  const displayMessages = chatMessages.length > 0 ? chatMessages : [];

  return (
    <View style={chatStyles.container}>
      <View style={chatStyles.messagesContainer}>
        {/* Messages List */}
        {displayMessages.length > 0 ? (
          <FlatList
            ref={flatListRef}
            data={displayMessages}
            renderItem={renderMessage}
            keyExtractor={(item, index) => item._id || index.toString()}
            style={chatStyles.messagesList}
            contentContainerStyle={chatStyles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => {
              // Scroll to bottom when content changes (new messages)
              if (flatListRef.current && displayMessages.length > 0) {
                flatListRef.current.scrollToEnd({ animated: true });
              }
            }}
            onLayout={() => {
              // Scroll to bottom when layout changes (keyboard)
              if (flatListRef.current && displayMessages.length > 0) {
                flatListRef.current.scrollToEnd({ animated: false });
              }
            }}
          />
        ) : (
          <View style={chatStyles.emptyStateContainer}>
            <View style={chatStyles.emptyStateContent}>
              <Ionicons name="chatbubbles-outline" size={80} color={COLORS.messageInputPlaceholder} />
              <Text style={chatStyles.emptyStateTitle}>Start the conversation!</Text>
              <Text style={chatStyles.emptyStateSubtitle}>
                Send a message to begin chatting with {currentChatRoom?.name?.replace('Chat with ', '') || 'this contact'}
              </Text>
            </View>
          </View>
        )}
      </View>
      
      {/* Message Input - Fixed at bottom */}
      <View style={chatStyles.inputContainer}>
        <View style={chatStyles.inputWrapper}>
          <TextInput
            style={chatStyles.textInput}
            value={newMessage}
            onChangeText={setNewMessage}
            placeholder="Message"
            placeholderTextColor={COLORS.messageInputPlaceholder}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity style={chatStyles.attachButton}>
            <Ionicons name="attach" size={24} color={COLORS.messageInputPlaceholder} />
          </TouchableOpacity>
          <TouchableOpacity style={chatStyles.cameraButton}>
            <Ionicons name="camera" size={24} color={COLORS.messageInputPlaceholder} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[
            chatStyles.sendButton,
            newMessage.trim() ? chatStyles.sendButtonActive : null
          ]}
          onPress={newMessage.trim() ? handleSendMessage : null}
        >
          <Ionicons 
            name={newMessage.trim() ? "send" : "mic"} 
            size={20} 
            color={COLORS.white} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Chat-specific styles
const chatStyles = {
  container: {
    flex: 1,
    backgroundColor: COLORS.chatDarkBg,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: COLORS.chatDarkBg,
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 12,
    backgroundColor: COLORS.chatDarkBg,
  },
  messagesContent: {
    flexGrow: 1,
    paddingVertical: 10,
  },
  messageContainer: {
    marginVertical: 2,
    maxWidth: '100%',
  },
  myMessageContainer: {
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
    width: '100%',
  },
  otherMessageContainer: {
    alignItems: 'flex-start',
    alignSelf: 'flex-start',
    width: '100%',
  },
  messageBubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    marginHorizontal: 4,
  },
  myMessageBubble: {
    backgroundColor: COLORS.sentBubble,
    borderBottomRightRadius: 4,
    alignSelf: 'flex-end',
  },
  otherMessageBubble: {
    backgroundColor: COLORS.receivedBubble,
    borderBottomLeftRadius: 4,
    alignSelf: 'flex-start',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: COLORS.sentText,
  },
  otherMessageText: {
    color: COLORS.receivedText,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 12,
  },
  myMessageTime: {
    color: COLORS.sentText,
    opacity: 0.7,
  },
  otherMessageTime: {
    color: COLORS.receivedText,
    opacity: 0.7,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: 24,
    backgroundColor: COLORS.chatDarkBg,
    borderTopWidth: 1,
    borderTopColor: COLORS.receivedBubble,
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: COLORS.messageInputBg,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 48,
    maxHeight: 120,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.messageInputText,
    maxHeight: 100,
    paddingVertical: 8,
    textAlignVertical: 'top',
  },
  attachButton: {
    marginLeft: 8,
    marginRight: 4,
    padding: 4,
  },
  cameraButton: {
    marginLeft: 4,
    padding: 4,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.sendButtonBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    backgroundColor: COLORS.primary,
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: COLORS.chatDarkBg,
  },
  emptyStateContent: {
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.receivedText,
    marginTop: 20,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 16,
    color: COLORS.messageInputPlaceholder,
    textAlign: 'center',
    lineHeight: 22,
  },
};