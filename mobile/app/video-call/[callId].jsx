import React from 'react'
import { View, Text } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useUser } from '@clerk/clerk-expo'
import { ZEGO_APP_ID, ZEGO_APP_SIGN, ensureZegoKeys } from '../../config/zego'
import SafeScreen from '../../components/SafeScreen'
import { COLORS } from '../../constants/colors'

// Lazy import to avoid impacting bundle until screen used
let ZegoUIKitPrebuiltCall
try {
  ZegoUIKitPrebuiltCall = require('@zegocloud/zego-uikit-prebuilt-call-rn').ZegoUIKitPrebuiltCall
} catch (e) {
  console.warn('[Zego] Prebuilt call package not resolved yet:', e?.message)
}

export default function InCallScreen() {
  const { callId, mode } = useLocalSearchParams()
  const { user } = useUser()
  const router = useRouter()

  const missingKeys = (!ZEGO_APP_ID || !ZEGO_APP_SIGN)
  ensureZegoKeys()

  if (!ZegoUIKitPrebuiltCall || missingKeys) {
    return (
      <SafeScreen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: COLORS.receivedText, fontSize: 16, textAlign: 'center' }}>
            Video calling isn’t ready yet.
          </Text>
          <Text style={{ color: COLORS.messageInputPlaceholder, fontSize: 14, textAlign: 'center', marginTop: 8 }}>
            Please set EXPO_PUBLIC_ZEGO_APP_ID and EXPO_PUBLIC_ZEGO_APP_SIGN in your .env and rebuild the dev client.
          </Text>
        </View>
      </SafeScreen>
    )
  }

  const userId = user?.id || (user?.emailAddresses?.[0]?.emailAddress?.split('@')[0]) || 'user'
  const userName = user?.fullName || user?.firstName || 'Guest'

  return (
    <SafeScreen>
      <View style={{ flex: 1, backgroundColor: COLORS.chatDarkBg }}>
        <ZegoUIKitPrebuiltCall
          appID={ZEGO_APP_ID}
          appSign={ZEGO_APP_SIGN}
          userID={userId}
          userName={userName}
          callID={String(callId)}
          config={{
            // one-on-one or group
            scenario: (mode === 'group') ? 2 : 0, // 0: one-on-one 2: group video per SDK docs
            onHangUp: () => router.back(),
          }}
        />
      </View>
    </SafeScreen>
  )
}
