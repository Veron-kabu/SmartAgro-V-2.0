const dotenv = require('dotenv');
dotenv.config();

// Clean single-source dynamic config
module.exports = () => ({
  expo: {
    owner: 'smartagro',
    name: 'SmartAgro',
    slug: 'smartagro',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'mobile',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash/circle.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: { backgroundColor: '#000000' }
        }
      ],
      'expo-dev-client'
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.smartagro.simu',
      infoPlist: {
        NSCameraUsageDescription: 'This app requires access to your camera for video calls.',
        NSMicrophoneUsageDescription: 'This app requires access to your microphone for voice and video calls.'
      }
    },
    android: {
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      package: 'com.smartagro.simu',
      permissions: ['CAMERA', 'RECORD_AUDIO'],
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#2e7d32'
      }
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png'
    },
    experiments: {
      typedRoutes: true,
      reactCompiler: true
    },
    extra: {
      eas: {
        // Linked EAS project (@smartagro/smartagro)
        projectId: 'f9d7e298-d14e-4de2-ba7f-f044b6e08aed'
      },
      firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      firebaseDatabaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
      zegoAppId: process.env.EXPO_PUBLIC_ZEGO_APP_ID,
      zegoAppSign: process.env.EXPO_PUBLIC_ZEGO_APP_SIGN
    }
  }
});
