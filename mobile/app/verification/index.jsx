import React, { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
// Code issuance removed
import { getJSON } from '../../context/api'

export default function VerificationPreparation() {
  const router = useRouter()
  // simplified: no loading/error UI needed here
  const [status, setStatus] = useState(null)
  const [latestId, setLatestId] = useState(null)
  const [latestFlagged, setLatestFlagged] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
  // no loading state
        // Load current verification status and latest details first
        let st = null
        try { st = await getJSON('/api/verification/my-status') } catch {}
        let latest = null
        if (st?.status && st.status !== 'unverified') {
          try { latest = await getJSON('/api/verification/my-latest') } catch {}
        }
        if (mounted) {
          setStatus(st?.status || 'unverified')
          setLatestId(latest?.id || null)
          setLatestFlagged(latest?.status === 'flagged')
        }
  } catch (_e) {
        // ignore
      } finally {
        // no-op
      }
    })()
    return () => { mounted = false }
  }, [])

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Capture Farm Proof</Text>

        <View style={styles.callout}> 
          <Text style={styles.calloutStrong}>Essential</Text>
          <Text style={[styles.calloutText, { marginTop: 8 }]}>
            Upload a photo showing you and your farm.
          </Text>
          <Text style={[styles.calloutText, { marginTop: 8 }]}>
            Ensure you and your farm are clearly visible from different angles.
          </Text>
          <Text style={[styles.calloutText, { marginTop: 8 }]}>
            Upload a clear image of your national ID.
          </Text>
        </View>

        <View style={{ height: 5 }} />

        <View>
          {status == null ? (
            <Pressable style={[styles.btn, styles.btnDisabled]} disabled>
              <Text style={styles.btnText}>Checking status…</Text>
            </Pressable>
          ) : status === 'pending' && latestFlagged && latestId ? (
            <Pressable
              style={styles.btn}
              onPress={() => router.push({ pathname: '/verification/respond', params: { id: String(latestId) } })}
            >
              <Text style={styles.btnText}>Provide more info</Text>
            </Pressable>
          ) : status === 'pending' ? (
            <Pressable style={[styles.btn, styles.btnDisabled]} disabled>
              <Text style={styles.btnText}>Wait for approval</Text>
            </Pressable>
          ) : (
            <Pressable
              style={styles.btn}
              onPress={() => router.push({ pathname: '/verification/camera' })}
            >
              <Text style={styles.btnText}>Start Capture</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  scrollContent: { padding: 16, paddingBottom: 24 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  callout: { backgroundColor: '#fff7ed', borderColor: '#fdba74', borderWidth: 1, padding: 12, borderRadius: 10, marginBottom: 12 },
  calloutStrong: { color: '#9a3412', fontWeight: '800', marginBottom: 4, textTransform: 'uppercase', fontSize: 12, letterSpacing: 0.5 },
  calloutText: { color: '#7c2d12' },
  card: { backgroundColor: '#f1f5f9', padding: 16, borderRadius: 12, marginBottom: 16 },
  cardTitle: { fontWeight: '700', marginBottom: 6, color: '#0f172a' },
  item: { color: '#1f2937', marginTop: 2 },
  helper: { color: '#64748b', marginTop: 8, fontSize: 12 },
  codeBox: { backgroundColor: '#f3f4f6', padding: 16, borderRadius: 10, marginBottom: 16 },
  codeLabel: { color: '#666' },
  codeText: { fontSize: 24, fontWeight: '800', letterSpacing: 1 },
  exp: { marginTop: 6, color: '#555' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb', backgroundColor: 'white' },
  btn: { backgroundColor: '#0ea5e9', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: 'white', fontWeight: '700' },
  error: { color: '#b91c1c' },
})
