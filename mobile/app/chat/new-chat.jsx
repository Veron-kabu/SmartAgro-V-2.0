import React, { useState, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useChat } from '../../context/chat';
import { newChatStyles } from '../../assets/styles/chats/newChat.styles';
import { COLORS } from '../../constants/colors';

export default function NewChat() {
  const [email, setEmail] = useState('');
  const [chatName, setChatName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const { createChatRoom, setCurrentChatRoom, isFirebaseReady, getCurrentUser } = useChat();
  const router = useRouter();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: true,
      title: 'New Chat',
      headerStyle: {
        backgroundColor: COLORS.primary,
      },
      headerTintColor: COLORS.white,
      headerTitleStyle: {
        fontWeight: 'bold',
      },
    });
  }, [navigation]);

  const handleEmailChange = (text) => {
    setEmail(text);
    if (emailError && isValidEmail(text)) {
      setEmailError('');
    }
  };

  const handleCreateChat = async () => {
    if (!isFirebaseReady) {
      Alert.alert('Error', 'Chat service is not ready. Please try again.');
      return;
    }

    if (!email.trim()) {
      setEmailError('Please enter an email address');
      return;
    }

    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    setEmailError('');

    try {
      const roomName = chatName.trim() || `Chat with ${email}`;
      const chatRoomId = await createChatRoom(email.trim(), roomName);
      
      if (chatRoomId) {
        // Set the current chat room and navigate to conversation
        // Include participants for immediate correct header rendering
        const me = getCurrentUser();
        setCurrentChatRoom({ id: chatRoomId, name: roomName, participants: [me?._id || 'me', email.trim()] });
        router.replace('/chat/conversation');
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
    <SafeAreaView style={newChatStyles.container}>
      <View style={newChatStyles.content}>
        <View style={newChatStyles.formSection}>
          <Text style={newChatStyles.requiredLabel}>
            Email Address <Text style={newChatStyles.requiredAsterisk}>*</Text>
          </Text>
          <TextInput
            style={[
              newChatStyles.input,
              emailFocused && newChatStyles.inputFocused,
              emailError && newChatStyles.inputError,
            ]}
            value={email}
            onChangeText={handleEmailChange}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            placeholder="Enter user's email address"
            placeholderTextColor={COLORS.textLight}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isLoading}
          />
          {emailError && (
            <Text style={newChatStyles.errorText}>{emailError}</Text>
          )}
        </View>

        <View style={newChatStyles.formSection}>
          <Text style={newChatStyles.label}>Chat Name (Optional)</Text>
          <TextInput
            style={[
              newChatStyles.input,
              nameFocused && newChatStyles.inputFocused,
            ]}
            value={chatName}
            onChangeText={setChatName}
            onFocus={() => setNameFocused(true)}
            onBlur={() => setNameFocused(false)}
            placeholder="Enter chat name"
            placeholderTextColor={COLORS.textLight}
            autoCapitalize="words"
            editable={!isLoading}
          />
        </View>

        <TouchableOpacity
          style={[
            newChatStyles.createButton, 
            (isLoading || !isFirebaseReady) && newChatStyles.createButtonDisabled
          ]}
          onPress={handleCreateChat}
          disabled={isLoading || !isFirebaseReady}
          activeOpacity={0.8}
        >
          {isLoading && <ActivityIndicator size="small" color={COLORS.white} />}
          <Ionicons 
            name={isLoading ? "hourglass" : "chatbubble-ellipses"} 
            size={20} 
            color={COLORS.white} 
          />
          <Text style={newChatStyles.createButtonText}>
            {isLoading ? 'Creating...' : !isFirebaseReady ? 'Loading...' : 'Start Chat'}
          </Text>
        </TouchableOpacity>

        <View style={newChatStyles.instructionsSection}>
          <Text style={newChatStyles.instructionsTitle}>How it works</Text>
          <View style={newChatStyles.instructionsList}>
            <View style={newChatStyles.instructionItem}>
              <Text style={newChatStyles.instructionBullet}>•</Text>
              <Text style={newChatStyles.instructionText}>
                Enter the email address of the user you want to chat with
              </Text>
            </View>
            <View style={newChatStyles.instructionItem}>
              <Text style={newChatStyles.instructionBullet}>•</Text>
              <Text style={newChatStyles.instructionText}>
                They must have a SmartAgro account with this email
              </Text>
            </View>
            <View style={newChatStyles.instructionItem}>
              <Text style={newChatStyles.instructionBullet}>•</Text>
              <Text style={newChatStyles.instructionText}>
                A chat room will be created for both users
              </Text>
            </View>
          </View>
        </View>
      </View>

      {isLoading && (
        <View style={newChatStyles.loadingOverlay}>
          <View style={newChatStyles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={newChatStyles.loadingText}>Creating chat room...</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

