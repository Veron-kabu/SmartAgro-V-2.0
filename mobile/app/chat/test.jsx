import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';

export default function FirebaseTest() {
  const [firebaseStatus, setFirebaseStatus] = useState('Checking...');
  const [firestoreStatus, setFirestoreStatus] = useState('Checking...');
  const { user } = useAuth();

  useEffect(() => {
    testFirebaseConnection();
  }, []);

  const testFirebaseConnection = async () => {
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
      const { collection, addDoc, getDocs } = await import('firebase/firestore');
      
      // Try to read from a test collection
      const testCollection = collection(database, 'test');
      const snapshot = await getDocs(testCollection);
      
      setFirestoreStatus(`✅ Firestore connected (${snapshot.size} docs in test collection)`);
      
    } catch (error) {
      console.error('Firestore test error:', error);
      setFirebaseStatus('❌ Firestore error: ' + error.message);
      setFirestoreStatus('❌ Firestore connection failed');
    }
  };

  const createTestChatRoom = async () => {
    if (!user) {
      Alert.alert('Error', 'Please sign in first');
      return;
    }

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
      testFirebaseConnection(); // Refresh status
    } catch (error) {
      console.error('Error creating test chat room:', error);
      Alert.alert('Error', 'Failed to create test chat room: ' + error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Firebase Connection Test</Text>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>Firebase: {firebaseStatus}</Text>
        <Text style={styles.statusText}>Firestore: {firestoreStatus}</Text>
        <Text style={styles.statusText}>User: {user ? '✅ Signed in as ' + (user.emailAddresses[0]?.emailAddress || 'Unknown') : '❌ Not signed in'}</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={testFirebaseConnection}>
        <Text style={styles.buttonText}>Retest Connection</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.button} onPress={createTestChatRoom}>
        <Text style={styles.buttonText}>Create Test Chat Room</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
  },
  statusContainer: {
    marginBottom: 30,
  },
  statusText: {
    fontSize: 16,
    marginBottom: 10,
    padding: 10,
    backgroundColor: '#f5f5f5',
    borderRadius: 5,
  },
  button: {
    backgroundColor: '#16a34a',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
  },
});