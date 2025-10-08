import React, { useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useNavigation } from 'expo-router';
import { useChat } from '../../context/chat';

export default function NewChat() {
  const [email, setEmail] = useState('');
  const [chatName, setChatName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { createChatRoom, setCurrentChatRoom, isFirebaseReady } = useChat();
  const router = useRouter();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: 'New Chat',
      headerStyle: {
        backgroundColor: '#16a34a',
      },
      headerTintColor: '#fff',
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    });
  }, [navigation]);

  const handleCreateChat = async () => {
    if (!isFirebaseReady) {
      Alert.alert('Error', 'Chat service is not ready. Please try again.');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Error', 'Please enter an email address');
      return;
    }

    if (!isValidEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setIsLoading(true);

    try {
      const roomName = chatName.trim() || `Chat with ${email}`;
      const chatRoomId = await createChatRoom(email.trim(), roomName);
      
      if (chatRoomId) {
        // Set the current chat room and navigate to messages
        setCurrentChatRoom({ id: chatRoomId, name: roomName });
        router.replace('/chat/messages');
      } else {
        Alert.alert('Error', 'Failed to create chat room. Please try again.');
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      Alert.alert('Error', 'Failed to create chat room. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const isValidEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.label}>Email Address</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Enter user's email address"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <Text style={styles.label}>Chat Name (Optional)</Text>
        <TextInput
          style={styles.input}
          value={chatName}
          onChangeText={setChatName}
          placeholder="Enter chat name"
          autoCapitalize="words"
        />

        <TouchableOpacity
          style={[
            styles.createButton, 
            (isLoading || !isFirebaseReady) && styles.createButtonDisabled
          ]}
          onPress={handleCreateChat}
          disabled={isLoading || !isFirebaseReady}
        >
          <Text style={styles.createButtonText}>
            {isLoading ? 'Creating...' : !isFirebaseReady ? 'Loading...' : 'Start Chat'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.helpText}>
          Enter the email address of the user you want to chat with. 
          They must have a SmartAgro account (signed up with this email).
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
  createButton: {
    backgroundColor: '#16a34a',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 30,
  },
  createButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 20,
    textAlign: 'center',
    lineHeight: 20,
  },
});