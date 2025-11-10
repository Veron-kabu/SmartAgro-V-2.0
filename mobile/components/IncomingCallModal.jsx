import React from 'react'
import { Modal, View, Text, TouchableOpacity } from 'react-native'
import { useChat } from '../context/chat'
import { getLastRoute } from '../utils/navHistory'
import { useRouter } from 'expo-router'
import { COLORS } from '../constants/colors'
import { checkCallPermissions, requestCallPermissions } from '../utils/permissions'

export default function IncomingCallModal() {
  const { activeCall, acceptCall, declineCall, getCurrentUser } = useChat()
  const router = useRouter()

  const me = getCurrentUser?.()
  const myId = me?._id
  // Only show if this device/user is actually the callee and the call is initiating
  if (!activeCall || activeCall.status !== 'initiated' || !myId || String(activeCall.calleeId) !== String(myId)) return null

  const onAccept = async () => {
    try {
      // Snapshot values BEFORE we update status, because listeners may clear activeCall immediately
      const callDocId = activeCall?.id
      const callId = activeCall?.roomId
      const mode = activeCall?.mode || 'one-on-one'
      if (!callDocId || !callId) return
      // Ensure camera/mic permissions so we enter the call UI immediately
      const status = await checkCallPermissions()
      if (!status.allGranted) {
        await requestCallPermissions()
      }
      await acceptCall()
      const prev = getLastRoute('lastNonCall') || '/home'
  router.push({ pathname: '/video-call/[callId]', params: { callId, mode, callDocId, previousRoute: prev, permsPreGranted: '1' } })
    } catch (e) {
      console.warn('Accept call failed', e)
    }
  }

  const onDecline = async () => {
    try {
      await declineCall()
    } catch (e) {
      console.warn('Decline call failed', e)
    }
  }

  return (
    <Modal transparent visible animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <View style={{ width: '100%', maxWidth: 420, backgroundColor: COLORS.chatDarkBg, borderRadius: 16, padding: 20 }}>
          <Text style={{ color: COLORS.receivedText, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>Incoming Call</Text>
          <Text style={{ color: COLORS.messageInputPlaceholder, marginTop: 8, textAlign: 'center' }}>
            {activeCall?.callerId || 'Someone'} is calling you
          </Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 20 }}>
            <TouchableOpacity onPress={onDecline} style={{ backgroundColor: '#b00020', paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onAccept} style={{ backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12 }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  )
}
