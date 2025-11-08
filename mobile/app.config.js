const dotenv = require('dotenv');
dotenv.config();

// Base configuration that was previously in app.json
const base = {
  expo: {
    name: "SmartAgro",
    slug: "smartagro",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "mobile",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#2e7d32"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false
    },
    web: {
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#000000"
          }
        }
      ]
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true
    }
  }
};

// Build plugins array: start with base plugins and ensure expo-dev-client and our splash config exist
const buildPlugins = (basePluginsFromConfig = []) => {
  const plugins = Array.isArray(basePluginsFromConfig) ? JSON.parse(JSON.stringify(basePluginsFromConfig)) : [];
  if (!plugins.some(p => (typeof p === 'string' && p === 'expo-dev-client') || (Array.isArray(p) && p[0] === 'expo-dev-client'))) {
    plugins.push('expo-dev-client');
  }
  const splashConfig = [
    'expo-splash-screen',
    {
      image: './assets/images/splash/circle.png',
      imageWidth: 200,
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
      dark: { backgroundColor: '#000000' }
    }
  ];
  const splashIdx = plugins.findIndex(p => (typeof p === 'string' && p === 'expo-splash-screen') || (Array.isArray(p) && p[0] === 'expo-splash-screen'));
  if (splashIdx !== -1) plugins[splashIdx] = splashConfig; else plugins.push(splashConfig);
  return plugins;
};

module.exports = ({ config } = {}) => {
  const inputExpo = (config && config.expo) || {};
  const baseExpo = base.expo || {};

  const merged = {
    // start with app.json values, allow the incoming config (if any) to override, then apply our required overrides
    ...baseExpo,
    ...inputExpo,
    ios: {
      ...(baseExpo.ios || {}),
      ...(inputExpo.ios || {}),
      supportsTablet: true,
      bundleIdentifier: 'com.smartagro.simu',
      infoPlist: {
        ...(baseExpo.ios?.infoPlist || {}),
        ...(inputExpo.ios?.infoPlist || {}),
        NSCameraUsageDescription: 'This app requires access to your camera for video calls.',
        NSMicrophoneUsageDescription: 'This app requires access to your microphone for voice and video calls.'
      }
    },
    android: {
      ...(baseExpo.android || {}),
      ...(inputExpo.android || {}),
      package: 'com.smartagro.simu',
      adaptiveIcon: {
        ...(baseExpo.android?.adaptiveIcon || {}),
        ...(inputExpo.android?.adaptiveIcon || {}),
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#2e7d32'
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: (inputExpo.android?.permissions || baseExpo.android?.permissions || []).concat(['CAMERA', 'RECORD_AUDIO']).filter((v, i, a) => a.indexOf(v) === i)
    },
    web: {
      ...(baseExpo.web || {}),
      ...(inputExpo.web || {}),
      output: 'static',
      favicon: './assets/images/favicon.png'
    },
    plugins: buildPlugins(baseExpo.plugins || inputExpo.plugins),
    experiments: {
      ...(baseExpo.experiments || {}),
      ...(inputExpo.experiments || {}),
      typedRoutes: true,
      reactCompiler: true
    },
    extra: {
      eas: {
        projectId: '18cc9330-a9ba-4141-9794-ba7e282e6745'
      },
      firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
      firebaseDatabaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
      zegoAppId: process.env.EXPO_PUBLIC_ZEGO_APP_ID,
      zegoAppSign: process.env.EXPO_PUBLIC_ZEGO_APP_SIGN,
      ...(inputExpo.extra || {}),
    }
  };

  return { expo: merged };
};
