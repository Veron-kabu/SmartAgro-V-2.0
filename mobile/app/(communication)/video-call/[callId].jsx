import React, { useEffect, useState, useCallback, useRef } from 'react'
import { View, Text, BackHandler, ActivityIndicator, TouchableOpacity } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useUser } from '@clerk/clerk-expo'
import { ZEGO_APP_ID, ZEGO_APP_SIGN, ensureZegoKeys } from '../../../config/zego'
import { useChat } from '../../../context/chat'
import SafeScreen from '../../../components/SafeScreen'
import { getLastRoute } from '../../../utils/navHistory'
import { COLORS } from '../../../constants/colors'
import { checkCallPermissions, requestCallPermissions } from '../../../utils/permissions'

// Lazy import to avoid impacting bundle until screen used
let ZegoUIKitPrebuiltCall
try {
  ZegoUIKitPrebuiltCall = require('@zegocloud/zego-uikit-prebuilt-call-rn').ZegoUIKitPrebuiltCall
} catch (e) {
  console.warn('[Zego] Prebuilt call package not resolved yet:', e?.message)
}

export default function InCallScreen() {
  const { callId, mode, callDocId, previousRoute, permsPreGranted } = useLocalSearchParams()
  const { user } = useUser()
  const { endCall, endCallById } = useChat()
  const router = useRouter()

  const missingKeys = (!ZEGO_APP_ID || !ZEGO_APP_SIGN)
  const [permissionsReady, setPermissionsReady] = useState(false)
  const [permissionError, setPermissionError] = useState(null)
  const [showCallUI, setShowCallUI] = useState(true)
  const [isEnding, setIsEnding] = useState(false)
  const forcedNavTimeout = useRef(null)
  const zegoRef = useRef(null)
  const navTimerCleanup = useCallback(() => {
    if (forcedNavTimeout.current) {
      try { clearTimeout(forcedNavTimeout.current) } catch {}
      forcedNavTimeout.current = null
    }
  }, [])

  // Extra safety: Android hardware back during call should end gracefully
  useEffect(() => {
    const onBack = () => {
      if (showCallUI && !isEnding) {
        handleHangUp()
        return true
      }
      return false
    }
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack)
    return () => sub.remove()
  }, [showCallUI, isEnding, handleHangUp])

  // Try to call SDK leave internally if exposed
  const safeLeaveRoom = useCallback(async () => {
    try {
      const inst = zegoRef.current
      // Some builds expose inner methods via _callController or similar
      const ctrl = inst && (inst._callController || inst._prebuilt || inst._instance)
      if (ctrl) {
        if (typeof ctrl.hangUp === 'function') await ctrl.hangUp()
        if (typeof ctrl.leaveRoom === 'function') await ctrl.leaveRoom()
      }
    } catch (_e) {
      // best effort
    }
  }, [])

  const resolvePrevious = useCallback(() => {
    return (typeof previousRoute === 'string' && previousRoute) || getLastRoute('lastNonCall') || getLastRoute('call') || '/home'
  }, [previousRoute])

  const finalizeNavigation = useCallback(() => {
    const target = resolvePrevious()
    try { router.dismissAll?.() } catch {}
    try { router.replace(String(target)) } catch {}
    // Ensure no pending retries that could cause visual flicker
    navTimerCleanup()
  }, [router, resolvePrevious, navTimerCleanup])

  const handleHangUp = useCallback(async () => {
    if (isEnding) return
    console.log('[CallScreen] handleHangUp invoked')
    setIsEnding(true)
    // Navigate away immediately for the user experience; cleanup happens in background
    try { setShowCallUI(false); console.log('[CallScreen] call UI hidden') } catch {}
    console.log('[CallScreen] calling finalizeNavigation (user ended)')
    finalizeNavigation()
    try {
      if (callDocId) {
        await endCallById?.(String(callDocId))
      } else {
        await endCall?.()
      }
    } catch (e) {
      console.warn('[CallScreen] end call error', e)
    }
    // Proactively ask SDK to leave, then unmount UI
    await safeLeaveRoom()
    console.log('[CallScreen] safeLeaveRoom completed')
  }, [isEnding, finalizeNavigation, callDocId, endCallById, endCall, safeLeaveRoom])

  // Request camera & mic permissions proactively before mounting call UI
  useEffect(() => {
    let mounted = true
    async function ensurePerms() {
      try {
        // If caller/callee already ensured permissions before navigation, skip re-request
        const pre = (permsPreGranted === '1' || permsPreGranted === 'true' || permsPreGranted === true)
        if (pre) {
          if (mounted) setPermissionsReady(true)
          return
        }
        const check = await checkCallPermissions()
        if (check.allGranted) {
          if (mounted) setPermissionsReady(true)
          return
        }
        const req = await requestCallPermissions()
        if (mounted) {
          setPermissionsReady(req.allGranted)
          if (!req.allGranted) setPermissionError('Camera/Microphone permission denied')
        }
      } catch (e) {
        if (mounted) setPermissionError(e?.message || 'Permission request failed')
      }
    }
    ensurePerms()
    return () => { mounted = false }
  }, [permsPreGranted])
  ensureZegoKeys()

  // Clear any pending timers when unmounting to prevent post-exit flicker
  useEffect(() => {
    return () => navTimerCleanup()
  }, [navTimerCleanup])

  // If we have a callDocId, listen for remote end/decline and auto-exit
  useEffect(() => {
    let unsub = null
    if (!callDocId) return
    (async () => {
      try {
        const { doc, onSnapshot } = await import('firebase/firestore')
        // We need database; reuse from ChatProvider via a lazy import (config holds singleton)
        const { database } = await import('../../../config/firestore')
        if (!database) return
        const ref = doc(database, 'calls', String(callDocId))
        unsub = onSnapshot(ref, (snap) => {
          if (!snap.exists()) return
          const data = snap.data()
          if (data?.status === 'ended' || data?.status === 'declined') {
            if (isEnding) return
            console.log('[CallScreen] remote end/decline detected, scheduling exit')
            setIsEnding(true)
            ;(async () => {
              try { setShowCallUI(false); console.log('[CallScreen] call UI hidden (remote)') } catch {}
              console.log('[CallScreen] calling finalizeNavigation (remote ended)')
              finalizeNavigation()
              await safeLeaveRoom()
              console.log('[CallScreen] safeLeaveRoom completed (remote)')
            })()
          }
        })
      } catch (e) {
        console.warn('[CallScreen] remote end listener error', e)
      }
    })()
    return () => { if (unsub) unsub() }
  }, [callDocId, isEnding, safeLeaveRoom, finalizeNavigation])

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

  if (!permissionsReady) {
    return (
      <SafeScreen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Text style={{ color: COLORS.receivedText, fontSize: 16, textAlign: 'center' }}>
            Requesting camera & microphone access...
          </Text>
          {permissionError && (
            <Text style={{ color: 'tomato', fontSize: 14, textAlign: 'center', marginTop: 8 }}>
              {permissionError}
            </Text>
          )}
        </View>
      </SafeScreen>
    )
  }

  const email = user?.emailAddresses?.[0]?.emailAddress
  const emailLocal = email ? email.split('@')[0] : undefined
  const userId = user?.id || emailLocal || 'user'
  const userName = user?.fullName || user?.firstName || emailLocal || userId

  return (
    <SafeScreen>
      <View style={{ flex: 1, backgroundColor: COLORS.chatDarkBg }}>
        {showCallUI && (
          <ZegoUIKitPrebuiltCall
          appID={ZEGO_APP_ID}
          appSign={ZEGO_APP_SIGN}
          userID={userId}
          userName={userName}
          callID={String(callId)}
          config={{
            scenario: (mode === 'group') ? 2 : 0,
            // Explicitly set camera/mic defaults as booleans
            turnOnCameraWhenJoining: true,
            turnOnMicrophoneWhenJoining: true,
            useSpeakerWhenJoining: true,
            // Try to hide built-in name labels to avoid duplication
            audioVideoViewConfig: { showUserNameOnView: false },
            onHangUp: handleHangUp,
            // Diagnostics: basic participant updates (if SDK forwards callbacks through config)
            onUserJoin: (users) => console.log('[CallScreen] users joined:', users?.map?.(u => u?.userID)),
            onUserLeave: (users) => console.log('[CallScreen] users left:', users?.map?.(u => u?.userID)),
          }}
            ref={(r) => { zegoRef.current = r }}
          />
        )}
        {/* Always-on-top End button to ensure our own end flow triggers even if SDK callback is skipped */}
        {showCallUI && !isEnding && (
          <View style={{ position: 'absolute', bottom: 60, alignSelf: 'center' }} pointerEvents="auto">
            <TouchableOpacity
              onPress={handleHangUp}
              style={{
                backgroundColor: '#d32f2f',
                width: 64,
                height: 64,
                borderRadius: 32,
                alignItems: 'center',
                justifyContent: 'center',
                elevation: 4,
                shadowColor: '#000',
                shadowOpacity: 0.2,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 2 }
              }}
            >
              <Ionicons name="call" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
        {/* Minimal self label overlay, only for the local user */}
        {showCallUI && (
          <View pointerEvents="none" style={{ position: 'absolute', top: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
            <Text style={{ color: '#fff', fontSize: 12 }}>{userName}</Text>
          </View>
        )}

        {/* Ending overlay disables touches and shows progress */}
        {isEnding && (
          <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' }} pointerEvents="auto">
            <ActivityIndicator size="large" color="#fff" />
            <Text style={{ marginTop: 12, color: '#fff' }}>Ending call...</Text>
          </View>
        )}
      </View>
    </SafeScreen>
  )
}
