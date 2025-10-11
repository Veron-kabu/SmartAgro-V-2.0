import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { testStyles } from '../../assets/styles/chats/test.styles';
import { COLORS } from '../../constants/colors';

export default function FirebaseTest() {
  const [firebaseStatus, setFirebaseStatus] = useState('Checking...');
  const [firestoreStatus, setFirestoreStatus] = useState('Checking...');
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState([]);
  const { user } = useAuth();

  useEffect(() => {
    testFirebaseConnection();
  }, []);

  const testFirebaseConnection = async () => {
    setIsLoading(true);
    try {
      console.log('Testing Firestore connection...');
      const { database } = await import('../../config/firestore');
      
      if (!database) {
        setFirebaseStatus('❌ Firestore not initialized');
        setFirestoreStatus('❌ Firestore error');
        return;
      }
      
      setFirebaseStatus('✅ Firestore initialized');
      
      // Test Firestore connection
      const { collection, getDocs } = await import('firebase/firestore');
      
      // Try to read from a test collection
      const testCollection = collection(database, 'test');
      const snapshot = await getDocs(testCollection);
      
      setFirestoreStatus(`✅ Firestore connected (${snapshot.size} docs in test collection)`);
      
      // Add to test results
      setTestResults(prev => [...prev, {
        id: Date.now(),
        type: 'success',
        message: `Connection test passed at ${new Date().toLocaleTimeString()}`
      }]);
      
    } catch (error) {
      console.error('Firestore test error:', error);
      setFirebaseStatus('❌ Firestore error: ' + error.message);
      setFirestoreStatus('❌ Firestore connection failed');
      
      setTestResults(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        message: `Connection failed: ${error.message}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const createTestChatRoom = async () => {
    if (!user) {
      Alert.alert('Error', 'Please sign in first');
      return;
    }

    setIsLoading(true);
    try {
      const { database } = await import('../../config/firestore');
      
      if (!database) {
        Alert.alert('Error', 'Firestore not available');
        return;
      }
      
      const { collection, addDoc } = await import('firebase/firestore');
      
      const chatRoomsRef = collection(database, 'chatRooms');
      const userEmail = user.emailAddresses[0]?.emailAddress || user.id;
      
      const docRef = await addDoc(chatRoomsRef, {
        name: 'Test Chat Room',
        participants: [userEmail, 'test@example.com'],
        createdAt: new Date(),
        lastMessage: 'Hello, this is a test!',
        lastMessageTime: new Date()
      });

      Alert.alert('Success', `Test chat room created with ID: ${docRef.id}`);
      
      setTestResults(prev => [...prev, {
        id: Date.now(),
        type: 'success',
        message: `Test chat room created: ${docRef.id}`
      }]);
      
      testFirebaseConnection(); // Refresh status
    } catch (error) {
      console.error('Error creating test chat room:', error);
      Alert.alert('Error', 'Failed to create test chat room: ' + error.message);
      
      setTestResults(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        message: `Failed to create chat room: ${error.message}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    if (status.includes('✅')) return 'checkmark-circle';
    if (status.includes('❌')) return 'close-circle';
    return 'time';
  };

  const getStatusColor = (status) => {
    if (status.includes('✅')) return '#059669';
    if (status.includes('❌')) return '#dc2626';
    return COLORS.textLight;
  };

  return (
    <SafeAreaView style={testStyles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={testStyles.title}>Firebase Connection Test</Text>
        
        <View style={testStyles.statusContainer}>
          <View style={testStyles.statusCard}>
            <View style={testStyles.testResultItem}>
              <Ionicons 
                name={getStatusIcon(firebaseStatus)} 
                size={20} 
                color={getStatusColor(firebaseStatus)}
                style={testStyles.testResultIcon}
              />
              <Text style={testStyles.statusText}>
                Firebase: <Text style={{ color: getStatusColor(firebaseStatus) }}>{firebaseStatus}</Text>
              </Text>
            </View>
          </View>

          <View style={testStyles.statusCard}>
            <View style={testStyles.testResultItem}>
              <Ionicons 
                name={getStatusIcon(firestoreStatus)} 
                size={20} 
                color={getStatusColor(firestoreStatus)}
                style={testStyles.testResultIcon}
              />
              <Text style={testStyles.statusText}>
                Firestore: <Text style={{ color: getStatusColor(firestoreStatus) }}>{firestoreStatus}</Text>
              </Text>
            </View>
          </View>

          <View style={testStyles.statusCard}>
            <View style={testStyles.testResultItem}>
              <Ionicons 
                name={user ? 'person-circle' : 'person-circle-outline'} 
                size={20} 
                color={user ? '#059669' : '#dc2626'}
                style={testStyles.testResultIcon}
              />
              <Text style={testStyles.statusText}>
                User: <Text style={{ color: user ? '#059669' : '#dc2626' }}>
                  {user ? `✅ Signed in as ${user.emailAddresses[0]?.emailAddress || 'Unknown'}` : '❌ Not signed in'}
                </Text>
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={[testStyles.button, isLoading && testStyles.buttonSecondary]} 
          onPress={testFirebaseConnection}
          disabled={isLoading}
        >
          {isLoading && <ActivityIndicator size="small" color={COLORS.white} />}
          <Ionicons name="refresh" size={20} color={COLORS.white} />
          <Text style={testStyles.buttonText}>
            {isLoading ? 'Testing...' : 'Retest Connection'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[testStyles.button, isLoading && testStyles.buttonSecondary]} 
          onPress={createTestChatRoom}
          disabled={isLoading}
        >
          {isLoading && <ActivityIndicator size="small" color={COLORS.white} />}
          <Ionicons name="chatbubble-ellipses" size={20} color={COLORS.white} />
          <Text style={testStyles.buttonText}>
            {isLoading ? 'Creating...' : 'Create Test Chat Room'}
          </Text>
        </TouchableOpacity>

        {testResults.length > 0 && (
          <View style={testStyles.testResultContainer}>
            <Text style={testStyles.testResultTitle}>Test Results</Text>
            {testResults.slice(-5).map((result) => (
              <View key={result.id} style={testStyles.testResultItem}>
                <Ionicons 
                  name={result.type === 'success' ? 'checkmark-circle' : 'close-circle'} 
                  size={16} 
                  color={result.type === 'success' ? '#059669' : '#dc2626'}
                  style={testStyles.testResultIcon}
                />
                <Text style={testStyles.testResultText}>{result.message}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={testStyles.warningBox}>
          <Text style={testStyles.warningTitle}>⚠️ Development Tool</Text>
          <Text style={testStyles.warningText}>
            This is a development and testing tool. Use it to verify your Firebase 
            configuration and debug connection issues.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

