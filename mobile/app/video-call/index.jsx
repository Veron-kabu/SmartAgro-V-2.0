import React, { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import SafeScreen from '../../components/SafeScreen'
import { COLORS } from '../../constants/colors'

export default function VideoCallHome() {
  const [callId, setCallId] = useState('')
  const router = useRouter()

  return (
    <SafeScreen>
      <View style={styles.container}>
        <Text style={styles.title}>Start a Video Call</Text>
        <TextInput
          value={callId}
          onChangeText={setCallId}
          placeholder="Enter Call ID (e.g., chat room id)"
          placeholderTextColor={COLORS.messageInputPlaceholder}
          style={styles.input}
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={[styles.button, callId.trim() ? styles.buttonActive : null]}
          disabled={!callId.trim()}
          onPress={() => router.push({ pathname: '/video-call/[callId]', params: { callId: callId.trim(), mode: 'one-on-one' } })}
        >
          <Text style={styles.buttonText}>Start Call</Text>
        </TouchableOpacity>
      </View>
    </SafeScreen>
  )
}

const styles = {
  container: { flex: 1, padding: 24, gap: 16, justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.receivedText, textAlign: 'center', marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.receivedBubble,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.messageInputText,
    backgroundColor: COLORS.messageInputBg
  },
  button: { backgroundColor: COLORS.sendButtonBg, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  buttonActive: { backgroundColor: COLORS.primary },
  buttonText: { color: COLORS.white, fontWeight: '600' }
}
