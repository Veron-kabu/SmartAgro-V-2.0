"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  RefreshControl,
  Alert,
} from "react-native"
import { useAuth } from "@clerk/clerk-expo"
import { Ionicons } from "@expo/vector-icons"
import { postJSON, getJSONCancelable } from "../../context/api"
import { useLocalSearchParams } from 'expo-router'
import { useProfile } from "../../context/profile"
// Base URL is centralized in the API client; pass only paths

export default function MessagesScreen() {
  const { isSignedIn } = useAuth()
  const params = useLocalSearchParams()
  const prefillTo = useMemo(() => {
    const raw = params?.to
    if (!raw) return null
    const n = Array.isArray(raw) ? raw[0] : raw
    const idNum = Number(n)
    return isNaN(idNum) ? null : idNum
  }, [params])
  // no-op
  const [conversations, setConversations] = useState([])
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState("")
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { profile, loading: profileLoading, refresh: refreshProfile } = useProfile()

  const fetchConversations = useCallback(async () => {
    try {
      const mockConversations = [
        {
          id: 1,
          otherUser: {
            id: 2,
            fullName: "John Farmer",
            profileImageUrl: "https://via.placeholder.com/50",
            role: "farmer",
          },
          lastMessage: "Hi, is the tomatoes still available?",
          lastMessageTime: new Date().toISOString(),
          unreadCount: 2,
          productId: 1,
          productTitle: "Fresh Tomatoes",
        },
        {
          id: 2,
          otherUser: {
            id: 3,
            fullName: "Sarah Buyer",
            profileImageUrl: "https://via.placeholder.com/50",
            role: "buyer",
          },
          lastMessage: "Thank you for the quick delivery!",
          lastMessageTime: new Date(Date.now() - 3600000).toISOString(),
          unreadCount: 0,
          productId: 2,
          productTitle: "Organic Carrots",
        },
      ]
      let list = mockConversations
      // If prefillTo is present and not already in list, create a stub conversation
      let abortController = new AbortController()
      if (prefillTo && !mockConversations.some(c => c.otherUser.id === prefillTo)) {
        // Attempt lightweight fetch of user profile with cancellation support
        let fetchedUser = null
        try { fetchedUser = await getJSONCancelable(`/api/users/${prefillTo}`, abortController.signal) } catch (e) { if (e?.name !== 'AbortError') {/* ignore */} }
        const stub = {
          id: Date.now(),
          otherUser: {
            id: prefillTo,
            fullName: fetchedUser?.full_name || fetchedUser?.fullName || `User #${prefillTo}`,
            profileImageUrl: fetchedUser?.profile_image_url || fetchedUser?.profileImageUrl || 'https://via.placeholder.com/50',
            role: fetchedUser?.role || 'farmer',
          },
          lastMessage: '',
          lastMessageTime: new Date().toISOString(),
          unreadCount: 0,
          productId: null,
          productTitle: '',
        }
        list = [stub, ...list]
      }
  setConversations(list)
      // Auto-open stub if prefill
      if (prefillTo) {
        const conv = list.find(c => c.otherUser.id === prefillTo)
        if (conv) {
          setSelectedConversation(conv)
          fetchMessages(conv.id)
        }
      }
    } catch (error) {
      console.error("Error fetching conversations:", error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [prefillTo, fetchMessages])

  const fetchMessages = useCallback(async (conversationId) => {
    try {
      const mockMessages = [
        {
          id: 1,
          senderId: 2,
          receiverId: profile?.id,
          message: "Hi, is the tomatoes still available?",
          createdAt: new Date(Date.now() - 7200000).toISOString(),
          senderName: "John Farmer",
        },
        {
          id: 2,
          senderId: profile?.id,
          receiverId: 2,
          message: "Yes, we have 50kg available. When do you need them?",
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          senderName: profile?.fullName,
        },
        {
          id: 3,
          senderId: 2,
          receiverId: profile?.id,
          message: "Perfect! I need them by tomorrow. Can you deliver to downtown?",
          createdAt: new Date(Date.now() - 1800000).toISOString(),
          senderName: "John Farmer",
        },
      ]
      setMessages(mockMessages)
    } catch (error) {
      console.error("Error fetching messages:", error)
    }
  }, [profile])

  useEffect(() => {
    if (isSignedIn) {
      if (!profile && !profileLoading) {
        // ensure profile is loaded/created
        refreshProfile().catch(() => {})
      }
      fetchConversations()
    }
  }, [isSignedIn, profileLoading, profile, refreshProfile, prefillTo, fetchConversations])

  // Cleanup (abort any pending user fetch if component unmounts quickly)
  useEffect(() => {
    return () => {
      // We used local AbortController inside fetchConversations; for a fuller implementation, refactor it to outer scope.
    }
  }, [])

  const onRefresh = () => {
    setRefreshing(true)
    fetchConversations()
  }

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return

    try {
      const messageData = {
        receiver_id: selectedConversation.otherUser.id,
        message: newMessage.trim(),
        order_id: selectedConversation.orderId || null,
      }

  await postJSON(`/api/messages`, messageData)

      // Add message to local state
      const newMsg = {
        id: Date.now(),
        senderId: profile?.id,
        receiverId: selectedConversation.otherUser.id,
        message: newMessage.trim(),
        createdAt: new Date().toISOString(),
        senderName: profile?.fullName,
      }

      setMessages((prev) => [...prev, newMsg])
      setNewMessage("")
    } catch (_error) {
      Alert.alert("Error", "Failed to send message")
    }
  }

  const formatTime = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now - date) / (1000 * 60 * 60)

    if (diffInHours < 1) {
      return "Just now"
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading messages...</Text>
      </View>
    )
  }

  // Conversation view
  if (selectedConversation) {
    return (
      <View style={styles.container}>
        {/* Chat Header */}
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setSelectedConversation(null)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>

          <Image source={{ uri: selectedConversation.otherUser.profileImageUrl }} style={styles.chatProfileImage} />

          <View style={styles.chatUserInfo}>
            <Text style={styles.chatUserName}>{selectedConversation.otherUser.fullName}</Text>
            <Text style={styles.chatUserRole}>{selectedConversation.otherUser.role}</Text>
          </View>

          <TouchableOpacity style={styles.callButton}>
            <Ionicons name="call" size={20} color="#16a34a" />
          </TouchableOpacity>
        </View>

        {/* Product Context */}
        {selectedConversation.productTitle && (
          <View style={styles.productContext}>
            <Ionicons name="leaf" size={16} color="#16a34a" />
            <Text style={styles.productContextText}>About: {selectedConversation.productTitle}</Text>
          </View>
        )}

        {/* Messages */}
        <ScrollView style={styles.messagesContainer}>
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageItem,
                message.senderId === profile?.id ? styles.sentMessage : styles.receivedMessage,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  message.senderId === profile?.id ? styles.sentMessageText : styles.receivedMessageText,
                ]}
              >
                {message.message}
              </Text>
              <Text
                style={[
                  styles.messageTime,
                  message.senderId === profile?.id ? styles.sentMessageTime : styles.receivedMessageTime,
                ]}
              >
                {formatTime(message.createdAt)}
              </Text>
            </View>
          ))}
        </ScrollView>

        {/* Message Input */}
        <View style={styles.messageInputContainer}>
          <TextInput
            style={styles.messageInput}
            placeholder="Type a message..."
            value={newMessage}
            onChangeText={setNewMessage}
            multiline
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage} disabled={!newMessage.trim()}>
            <Ionicons name="send" size={20} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  // Conversations list view
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
        <TouchableOpacity style={styles.newMessageButton}>
          <Ionicons name="create" size={24} color="#16a34a" />
        </TouchableOpacity>
      </View>

      {/* Conversations List */}
      <ScrollView
        style={styles.conversationsContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {conversations.map((conversation) => (
          <TouchableOpacity
            key={conversation.id}
            style={styles.conversationItem}
            onPress={() => {
              setSelectedConversation(conversation)
              fetchMessages(conversation.id)
            }}
          >
            <Image source={{ uri: conversation.otherUser.profileImageUrl }} style={styles.conversationImage} />

            <View style={styles.conversationInfo}>
              <View style={styles.conversationHeader}>
                <Text style={styles.conversationName}>{conversation.otherUser.fullName}</Text>
                <Text style={styles.conversationTime}>{formatTime(conversation.lastMessageTime)}</Text>
              </View>

              <Text style={styles.conversationLastMessage} numberOfLines={1}>
                {conversation.lastMessage}
              </Text>

              {conversation.productTitle && (
                <Text style={styles.conversationProduct} numberOfLines={1}>
                  📦 {conversation.productTitle}
                </Text>
              )}
            </View>

            {conversation.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>{conversation.unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}

        {conversations.length === 0 && (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyText}>Start a conversation by contacting farmers about their products</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9fafb",
  },
  loadingText: {
    fontSize: 16,
    color: "#6b7280",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    paddingTop: 60,
    backgroundColor: "#ffffff",
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111827",
  },
  newMessageButton: {
    padding: 8,
  },
  conversationsContainer: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  conversationImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  conversationInfo: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  conversationTime: {
    fontSize: 12,
    color: "#6b7280",
  },
  conversationLastMessage: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 4,
  },
  conversationProduct: {
    fontSize: 12,
    color: "#16a34a",
    fontStyle: "italic",
  },
  unreadBadge: {
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  unreadCount: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#ffffff",
  },
  // Chat view styles
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingTop: 60,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  backButton: {
    marginRight: 12,
  },
  chatProfileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  chatUserInfo: {
    flex: 1,
  },
  chatUserName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  chatUserRole: {
    fontSize: 12,
    color: "#6b7280",
    textTransform: "capitalize",
  },
  callButton: {
    padding: 8,
  },
  productContext: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#f0fdf4",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  productContextText: {
    fontSize: 14,
    color: "#16a34a",
    marginLeft: 8,
    fontWeight: "500",
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  messageItem: {
    marginBottom: 12,
    maxWidth: "80%",
  },
  sentMessage: {
    alignSelf: "flex-end",
  },
  receivedMessage: {
    alignSelf: "flex-start",
  },
  messageText: {
    fontSize: 16,
    padding: 12,
    borderRadius: 16,
  },
  sentMessageText: {
    backgroundColor: "#16a34a",
    color: "#ffffff",
  },
  receivedMessageText: {
    backgroundColor: "#ffffff",
    color: "#111827",
  },
  messageTime: {
    fontSize: 12,
    marginTop: 4,
    marginHorizontal: 12,
  },
  sentMessageTime: {
    color: "#6b7280",
    textAlign: "right",
  },
  receivedMessageTime: {
    color: "#6b7280",
    textAlign: "left",
  },
  messageInputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    padding: 16,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginRight: 12,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    backgroundColor: "#16a34a",
    borderRadius: 20,
    padding: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#111827",
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 40,
  },
})
