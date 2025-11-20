# Chat Integration Documentation

## Overview
This integration adds real-time chat functionality to the SmartAgro mobile app using Firebase Firestore and React Native Gifted Chat.

## Features
- Real-time messaging using Firebase Firestore
- User authentication integration with Clerk
- Chat rooms management
- Message history
- User avatars and names
- Responsive chat interface

## Setup Instructions

### 1. Firebase Configuration
1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Firestore Database
3. Enable Authentication (if not already enabled)
4. Get your Firebase configuration from Project Settings > General > Your apps > Firebase SDK snippet

### 2. Environment Variables
1. Copy `.env.example` to `.env`
2. Fill in your Firebase configuration values:
```
EXPO_PUBLIC_FIREBASE_API_KEY=your_api_key_here
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id_here
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id_here
EXPO_PUBLIC_FIREBASE_DATABASE_URL=https://your_project_id-default-rtdb.firebaseio.com/
```

### 3. Firestore Database Structure
The chat system uses the following Firestore collections:

```
chatRooms/
  {chatRoomId}/
    - name: string
    - participants: array[string] (email addresses)
    - createdAt: timestamp
    - lastMessage: string
    - lastMessageTime: timestamp
    
    messages/
      {messageId}/
        - text: string
        - createdAt: timestamp
        - user: object
          - _id: string (email)
          - name: string
          - avatar: string (URL)
```

### 4. Security Rules
Add these Firestore security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Chat rooms - users can only access rooms they participate in
    match /chatRooms/{roomId} {
      allow read, write: if request.auth != null && 
        request.auth.token.email in resource.data.participants;
      
      // Messages within chat rooms
      match /messages/{messageId} {
        allow read, write: if request.auth != null && 
          request.auth.token.email in get(/databases/$(database)/documents/chatRooms/$(roomId)).data.participants;
      }
    }
  }
}
```

## Navigation Structure
- Profile screen Messages button → `chat/index.jsx` (Chat rooms list)
- `chat/index.jsx` - Chat rooms list
- `chat/messages.jsx` - Individual chat conversation
- `chat/new-chat.jsx` - Create new chat screen
- `chat/_layout.jsx` - Chat stack navigation

## Context API
The `ChatProvider` manages:
- Chat rooms state
- Current chat room
- Messages for active chat
- Firebase authentication
- Message sending functionality

## Components Used
- **react-native-gifted-chat**: Modern chat UI components
- **@expo/vector-icons**: Icons for the interface
- **Firebase**: Real-time database and authentication

## Backend Integration (Optional)
For enhanced security, you can create a backend endpoint to generate Firebase custom tokens:

```javascript
// In your backend (Express.js example)
app.post('/api/firebase-token', requireAuth, async (req, res) => {
  const { userId } = req.auth; // From Clerk
  const user = await getUser(userId);
  
  const customToken = await admin.auth().createCustomToken(user.email, {
    name: user.fullName,
    email: user.email
  });
  
  res.json({ token: customToken });
});
```

## Troubleshooting

### Common Issues
1. **Firebase not connecting**: Check environment variables and Firebase config
2. **Messages not real-time**: Verify Firestore rules and authentication
3. **Chat rooms not loading**: Check user authentication and participant arrays

### Development Tips
- Use Firebase Console to monitor database activity
- Enable debug logging in development
- Test with multiple users/devices for real-time functionality

## File Structure
```
mobile/
├── app/
│   ├── chat/
│   │   ├── _layout.jsx
│   │   ├── index.jsx (Chat rooms list)
│   │   ├── messages.jsx (Chat interface)
│   │   └── new-chat.jsx (Create chat)
│   └── (tabs)/
│       └── _layout.jsx (Bottom tabs without a Messages tab)
├── config/
│   └── firebase.js (Firebase configuration)
├── context/
│   └── chat.js (Chat context provider)
├── utils/
└── .env.example (Environment template)
```

## Next Steps
1. Set up Firebase project and configure environment variables
2. Test chat functionality between multiple users
3. Customize chat appearance and features as needed
4. Implement push notifications for new messages (optional)
5. Add file/image sharing capabilities (optional)