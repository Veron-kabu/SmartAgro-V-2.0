import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth, useUser } from '@clerk/clerk-expo';

const ChatContext = createContext();

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
};

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [chatRooms, setChatRooms] = useState([]);
  const [currentChatRoom, setCurrentChatRoom] = useState(null);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);
  const [firebaseDatabase, setFirebaseDatabase] = useState(null);
  
  // Use both useAuth and useUser to get complete user information
  const { isLoaded: authIsLoaded, isSignedIn } = useAuth();
  const { user: clerkUser, isLoaded: userIsLoaded } = useUser();
  
  // Combined loading state
  const clerkIsLoaded = authIsLoaded && userIsLoaded;

  // Debug logging for Clerk auth state
  useEffect(() => {
    console.log('ChatProvider: Clerk auth state:', {
      authIsLoaded,
      userIsLoaded,
      clerkIsLoaded,
      isSignedIn,
      hasUser: !!clerkUser,
      userEmail: clerkUser?.emailAddresses?.[0]?.emailAddress || 'none',
      userId: clerkUser?.id || 'none'
    });
  }, [authIsLoaded, userIsLoaded, clerkIsLoaded, isSignedIn, clerkUser]);

  // Initialize Firestore when component mounts
  useEffect(() => {
    const initializeFirestore = async () => {
      try {
        console.log('ChatProvider: Initializing Firestore...');
        // Use the simplified Firestore-only config
        const { database } = await import('../config/firestore');
        
        if (!database) {
          console.error('ChatProvider: Firestore not available');
          setIsFirebaseReady(false);
          return;
        }
        
        setFirebaseDatabase(database);
        setIsFirebaseReady(true);
        console.log('ChatProvider: Firestore initialized successfully');
      } catch (error) {
        console.error('ChatProvider: Firestore initialization error:', error);
        setIsFirebaseReady(false);
      }
    };

    // Add a small delay to ensure config is loaded
    const timer = setTimeout(initializeFirestore, 100);
    return () => clearTimeout(timer);
  }, []);

  // Load chat rooms for the current user
  useEffect(() => {
    // Wait for both Firestore and Clerk to be ready
    if (!isFirebaseReady || !firebaseDatabase || !clerkIsLoaded) {
      console.log('ChatProvider: Not ready for chat rooms:', { 
        isFirebaseReady, 
        hasDatabase: !!firebaseDatabase,
        clerkIsLoaded,
        isSignedIn,
        hasUser: !!clerkUser
      });
      return;
    }

    // If Clerk is loaded but user is not signed in, clear chat rooms
    if (!isSignedIn || !clerkUser) {
      console.log('ChatProvider: User not signed in, clearing chat rooms');
      setChatRooms([]);
      return;
    }

    const loadChatRooms = async () => {
      try {
        const userEmail = clerkUser.emailAddresses[0]?.emailAddress || clerkUser.id;
        console.log('ChatProvider: Loading chat rooms for user:', userEmail);
        
        const { collection, query, where, onSnapshot } = await import('firebase/firestore');
        
        const chatRoomsRef = collection(firebaseDatabase, 'chatRooms');
        const q = query(
          chatRoomsRef,
          where('participants', 'array-contains', userEmail)
        );
        
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
          console.log('ChatProvider: Chat rooms query result:', querySnapshot.size, 'rooms');
          const rooms = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setChatRooms(rooms);
        }, (error) => {
          console.error('ChatProvider: Error in chat rooms listener:', error);
        });

        return unsubscribe;
      } catch (error) {
        console.error('ChatProvider: Error loading chat rooms:', error);
      }
    };

    loadChatRooms();
  }, [isFirebaseReady, firebaseDatabase, clerkIsLoaded, isSignedIn, clerkUser]);

  // Load messages for current chat room
  useEffect(() => {
    if (!currentChatRoom || !isFirebaseReady || !firebaseDatabase) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      try {
        console.log('Loading messages for chat room:', currentChatRoom.id);
        const { collection, query, orderBy, onSnapshot } = await import('firebase/firestore');
        
        const messagesRef = collection(firebaseDatabase, 'chatRooms', currentChatRoom.id, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'asc')); // Changed to 'asc' for oldest first

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
          console.log('Messages query result:', querySnapshot.size, 'messages');
          const chatMessages = querySnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              _id: doc.id,
              text: data.text,
              createdAt: data.createdAt?.toDate() || new Date(),
              user: data.user
            };
          });
          setMessages(chatMessages);
        }, (error) => {
          console.error('Error in messages listener:', error);
        });

        return unsubscribe;
      } catch (error) {
        console.error('Error loading messages:', error);
      }
    };

    loadMessages();
  }, [currentChatRoom, isFirebaseReady, firebaseDatabase]);

  const sendMessage = async (messages = []) => {
    if (!currentChatRoom || !clerkUser || !isFirebaseReady || !firebaseDatabase) return;

    const { text } = messages[0];
    
    try {
      console.log('Sending message:', text);
  const { collection, addDoc, doc, updateDoc } = await import('firebase/firestore');
      
      const messagesRef = collection(firebaseDatabase, 'chatRooms', currentChatRoom.id, 'messages');
      await addDoc(messagesRef, {
        text,
        createdAt: new Date(),
        user: {
          // Use Clerk user id as stable identifier; include email for display
          _id: clerkUser.id,
          email: clerkUser.emailAddresses[0]?.emailAddress || '',
          name: clerkUser.fullName || clerkUser.firstName || 'User',
          avatar: clerkUser.imageUrl || 'https://i.pravatar.cc/300'
        }
      });

      // Update chat room with last message info
      const chatRoomRef = doc(firebaseDatabase, 'chatRooms', currentChatRoom.id);
      await updateDoc(chatRoomRef, {
        lastMessage: text,
        lastMessageTime: new Date(),
        lastMessageUserId: clerkUser.id
      });

      console.log('Message sent successfully');
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const createOrFindChatRoom = async (participantEmail, roomName) => {
    console.log('ChatProvider: createOrFindChatRoom called with:', { participantEmail, roomName });
    
    if (!clerkIsLoaded || !isSignedIn || !clerkUser || !isFirebaseReady || !firebaseDatabase) {
      console.error('ChatProvider: Prerequisites not met for chat room creation/finding');
      return null;
    }

    try {
      const currentUserEmail = clerkUser.emailAddresses[0]?.emailAddress || clerkUser.id;
      console.log('ChatProvider: Looking for existing chat room between:', currentUserEmail, 'and', participantEmail);
      
      const { collection, query, where, getDocs, addDoc } = await import('firebase/firestore');
      
      // First, check if a chat room already exists between these two users
      const chatRoomsRef = collection(firebaseDatabase, 'chatRooms');
      
      // Query for chat rooms that contain both users
      const existingRoomQuery = query(
        chatRoomsRef,
        where('participants', 'array-contains', currentUserEmail)
      );
      
      const querySnapshot = await getDocs(existingRoomQuery);
      
      // Check if any of the returned rooms also contains the target participant
      let existingRoom = null;
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.participants && data.participants.includes(participantEmail)) {
          existingRoom = { id: doc.id, ...data };
        }
      });
      
      if (existingRoom) {
        console.log('ChatProvider: Found existing chat room:', existingRoom.id);
        return existingRoom;
      }
      
      // No existing room found, create a new one
      console.log('ChatProvider: Creating new chat room');
      const docRef = await addDoc(chatRoomsRef, {
        name: roomName || `Chat with ${participantEmail}`,
        participants: [currentUserEmail, participantEmail],
        createdAt: new Date(),
        lastMessage: null,
        lastMessageTime: new Date()
      });

      const newRoom = {
        id: docRef.id,
        name: roomName || `Chat with ${participantEmail}`,
        participants: [currentUserEmail, participantEmail],
        createdAt: new Date(),
        lastMessage: null,
        lastMessageTime: new Date()
      };

      console.log('ChatProvider: New chat room created with ID:', docRef.id);
      return newRoom;
    } catch (error) {
      console.error('ChatProvider: Error creating/finding chat room:', error);
      return null;
    }
  };

  const createChatRoom = async (participantEmail, roomName) => {
    console.log('ChatProvider: createChatRoom called with:', { participantEmail, roomName });
    console.log('ChatProvider: Current state:', {
      authIsLoaded,
      userIsLoaded,
      clerkIsLoaded,
      isSignedIn,
      hasClerkUser: !!clerkUser,
      userEmail: clerkUser?.emailAddresses?.[0]?.emailAddress,
      userId: clerkUser?.id,
      isFirebaseReady,
      hasDatabase: !!firebaseDatabase
    });

    if (!clerkIsLoaded) {
      console.error('ChatProvider: Clerk not fully loaded yet');
      return null;
    }

    if (!isSignedIn) {
      console.error('ChatProvider: User not signed in');
      return null;
    }

    if (!clerkUser) {
      console.error('ChatProvider: No Clerk user available');
      return null;
    }

    if (!isFirebaseReady) {
      console.error('ChatProvider: Firebase not ready');
      return null;
    }

    if (!firebaseDatabase) {
      console.error('ChatProvider: No database available');
      return null;
    }

    try {
      console.log('ChatProvider: Creating chat room with:', participantEmail);
      const { collection, addDoc } = await import('firebase/firestore');
      
      const chatRoomsRef = collection(firebaseDatabase, 'chatRooms');
      const currentUserEmail = clerkUser.emailAddresses[0]?.emailAddress || clerkUser.id;
      
      console.log('ChatProvider: Current user email:', currentUserEmail);
      console.log('ChatProvider: Adding document to Firestore...');
      
      const docRef = await addDoc(chatRoomsRef, {
        name: roomName || `Chat with ${participantEmail}`,
        participants: [currentUserEmail, participantEmail],
        createdAt: new Date(),
        lastMessage: null,
        lastMessageTime: new Date()
      });

      console.log('ChatProvider: Chat room created with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('ChatProvider: Error creating chat room:', error);
      console.error('ChatProvider: Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      return null;
    }
  };

  const getCurrentUser = () => {
    if (!clerkUser) return null;
    
    return {
      _id: clerkUser.emailAddresses[0]?.emailAddress || clerkUser.id,
      name: clerkUser.fullName || clerkUser.firstName || 'User',
      avatar: clerkUser.imageUrl || 'https://i.pravatar.cc/300'
    };
  };

  // --- Simple Call Signaling (Firestore) ---
  const [activeCall, setActiveCall] = useState(null) // { id, roomId, callerId, calleeId, status }
  const currentUserEmail = clerkUser?.emailAddresses?.[0]?.emailAddress || clerkUser?.id
  const CALL_EXPIRATION_MS = 45000 // auto-expire initiated calls after 45s

  const isCallStale = useCallback((data) => {
    const created = data?.createdAt
    if (!created) return false
    const t = created?.toDate ? created.toDate().getTime() : (created?.getTime?.() || 0)
    return (Date.now() - t) > CALL_EXPIRATION_MS
  }, [])

  // Listen for incoming call invitations addressed to current user
  // Avoid composite index requirement by not ordering server-side; pick latest on client
  useEffect(() => {
    if (!isFirebaseReady || !firebaseDatabase || !currentUserEmail) return
    let unsubscribe = () => {}
    ;(async () => {
      try {
        const { collection, query, where, onSnapshot } = await import('firebase/firestore')
        const callsRef = collection(firebaseDatabase, 'calls')
        const q = query(
          callsRef,
          where('calleeId', '==', currentUserEmail),
          where('status', '==', 'initiated')
        )
        unsubscribe = onSnapshot(q, (snap) => {
          if (snap.empty) { setActiveCall(null); return }
          // Choose the most recent by createdAt on client
          let latestDoc = snap.docs[0]
          for (const d of snap.docs) {
            const a = d.data()?.createdAt
            const b = latestDoc.data()?.createdAt
            const aTime = a?.toDate ? a.toDate().getTime() : (a?.getTime?.() || 0)
            const bTime = b?.toDate ? b.toDate().getTime() : (b?.getTime?.() || 0)
            if (aTime > bTime) latestDoc = d
          }
          const data = latestDoc.data()
          // Ignore or auto-clear stale initiated calls
          if (isCallStale(data)) {
            ;(async () => {
              try {
                const { doc, updateDoc } = await import('firebase/firestore')
                const ref = doc(firebaseDatabase, 'calls', latestDoc.id)
                await updateDoc(ref, { status: 'ended', endedAt: new Date(), autoExpired: true })
              } catch (_e) { /* ignore */ }
            })()
            setActiveCall(null)
            return
          }
          setActiveCall({ id: latestDoc.id, ...data })
        }, (error) => {
          console.warn('[CallSignal] listener error', error)
        })
      } catch (e) {
        console.warn('[CallSignal] listener setup failed', e)
      }
    })()
    return () => unsubscribe()
  }, [isFirebaseReady, firebaseDatabase, currentUserEmail, isCallStale])

  // Additionally, when we have an active incoming call, also watch that specific call doc
  // so that if the caller cancels (status changes or doc removed), we clear the modal immediately.
  useEffect(() => {
    if (!isFirebaseReady || !firebaseDatabase) return
    if (!activeCall?.id) return
    let unsub = null
    ;(async () => {
      try {
        const { doc, onSnapshot } = await import('firebase/firestore')
        const ref = doc(firebaseDatabase, 'calls', String(activeCall.id))
        unsub = onSnapshot(ref, (snap) => {
          if (!snap.exists()) {
            setActiveCall(null)
            return
          }
          const data = snap.data()
          // Keep only while initiated for the callee; any other status dismisses the modal
          if (data?.status !== 'initiated' || isCallStale(data)) {
            if (data?.status === 'initiated' && isCallStale(data)) {
              ;(async () => {
                try {
                  const { doc, updateDoc } = await import('firebase/firestore')
                  const ref2 = doc(firebaseDatabase, 'calls', String(activeCall.id))
                  await updateDoc(ref2, { status: 'ended', endedAt: new Date(), autoExpired: true })
                } catch (_e) { /* ignore */ }
              })()
            }
            setActiveCall(null)
          } else {
            // Update fields like mode/caller info if they changed
            setActiveCall((c) => c ? { ...c, ...data } : { id: activeCall.id, ...data })
          }
        })
      } catch (e) {
        console.warn('[CallSignal] doc listener error', e)
      }
    })()
    return () => { if (unsub) unsub() }
  }, [isFirebaseReady, firebaseDatabase, activeCall?.id, isCallStale])

  const startCall = useCallback(async ({ roomId, calleeId, mode = 'one-on-one' }) => {
    if (!isFirebaseReady || !firebaseDatabase || !currentUserEmail || !roomId || !calleeId) return null
    try {
      const { collection, addDoc, query, where, getDocs, updateDoc, doc } = await import('firebase/firestore')
      const callsRef = collection(firebaseDatabase, 'calls')
      // End any stale initiated call between same participants before creating a new one
      const existingQ = query(callsRef,
        where('callerId', '==', currentUserEmail),
        where('calleeId', '==', calleeId),
        where('status', '==', 'initiated')
      )
      const existingSnap = await getDocs(existingQ)
      for (const d of existingSnap.docs) {
        const data = d.data()
        if (isCallStale(data)) {
          try { await updateDoc(doc(firebaseDatabase, 'calls', d.id), { status: 'ended', endedAt: new Date(), autoExpired: true }) } catch {}
        }
      }
      const docRef = await addDoc(callsRef, {
        roomId,
        callerId: currentUserEmail,
        calleeId,
        mode,
        status: 'initiated', // initiated | accepted | declined | ended
        createdAt: new Date()
      })
      return docRef.id
    } catch (e) {
      console.warn('[CallSignal] startCall failed', e)
      return null
    }
  }, [isFirebaseReady, firebaseDatabase, currentUserEmail, isCallStale])

  const acceptCall = useCallback(async () => {
    if (!activeCall || !firebaseDatabase) return
    try {
      const { doc, updateDoc } = await import('firebase/firestore')
      const ref = doc(firebaseDatabase, 'calls', activeCall.id)
      await updateDoc(ref, { status: 'accepted', acceptedAt: new Date() })
      setActiveCall((c) => c ? { ...c, status: 'accepted', acceptedAt: new Date() } : c)
    } catch (e) {
      console.warn('[CallSignal] acceptCall failed', e)
    }
  }, [activeCall, firebaseDatabase])

  const declineCall = useCallback(async () => {
    if (!activeCall || !firebaseDatabase) return
    try {
      const { doc, updateDoc } = await import('firebase/firestore')
      const ref = doc(firebaseDatabase, 'calls', activeCall.id)
      await updateDoc(ref, { status: 'declined', declinedAt: new Date() })
      setActiveCall(null)
    } catch (e) {
      console.warn('[CallSignal] declineCall failed', e)
    }
  }, [activeCall, firebaseDatabase])

  const endCall = useCallback(async () => {
    if (!activeCall || !firebaseDatabase) return
    try {
      const { doc, updateDoc } = await import('firebase/firestore')
      const ref = doc(firebaseDatabase, 'calls', activeCall.id)
      await updateDoc(ref, { status: 'ended', endedAt: new Date() })
      setActiveCall(null)
    } catch (e) {
      console.warn('[CallSignal] endCall failed', e)
    }
  }, [activeCall, firebaseDatabase])

  // Allow ending a call by explicit document id (so caller can end too)
  const endCallById = useCallback(async (callDocId) => {
    if (!callDocId || !firebaseDatabase) return
    try {
      const { doc, updateDoc, getDoc } = await import('firebase/firestore')
      const ref = doc(firebaseDatabase, 'calls', callDocId)
      const snap = await getDoc(ref)
      if (snap.exists()) {
        await updateDoc(ref, { status: 'ended', endedAt: new Date() })
      }
      // Only clear local activeCall if it was this one
      setActiveCall((c) => (c && c.id === callDocId ? null : c))
    } catch (e) {
      console.warn('[CallSignal] endCallById failed', e)
    }
  }, [firebaseDatabase])

  const value = {
    messages,
    chatRooms,
    currentChatRoom,
    setCurrentChatRoom,
    sendMessage,
    createChatRoom,
    createOrFindChatRoom,
    getCurrentUser,
    isFirebaseReady,
    // call signaling
    activeCall,
    startCall,
    acceptCall,
    declineCall,
    endCall
    , endCallById
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};