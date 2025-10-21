import React, { useMemo, useState } from 'react'
import { View, Text, Image, StyleSheet, Pressable, ActivityIndicator, ScrollView } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { getUploadToken, uploadToPresignedUrl, directUploadToBackend, submitVerification, enqueueVerification } from '../../utils/verification'
import { getJSON, postJSON } from '../../context/api'
import { useToast } from '../../context/toast'
import { COLORS } from '../../constants/colors'

export default function VerificationSubmit() {
  const { payload } = useLocalSearchParams()
  const router = useRouter()
  const toast = useToast()
  const captures = useMemo(() => {
    try { return JSON.parse(payload) } catch { return [] }
  }, [payload])
  const [busy, setBusy] = useState(false)
  const [verifying, setVerifying] = useState(false)

  const doSubmit = async () => {
    if (!captures || captures.length < 1) return
    try {
      setBusy(true)
      toast.show('Uploading photos…', { type: 'info', duration: 1200 })
      // Upload all photos in parallel (max 3). This reduces total wait time noticeably over mobile networks.
      const uploaded = await Promise.all(captures.map(async (item, i) => {
        const filename = `capture_${Date.now()}_${i+1}.jpg`
        const contentType = 'image/jpeg'
        let uploadKey = null
        let publicUrl = null
        const token = await getUploadToken(filename, contentType)
        if (token?.uploadUrl) {
          let uploadedOk = false
          try {
            await uploadToPresignedUrl(token.uploadUrl, item.uri, token.contentType || contentType)
            uploadedOk = true
          } catch (e) {
            // Best-effort logging (optional)
            try { await postJSON('/api/uploads/log-incident', { key: token.uploadKey, status: e?.message || 'error', message: e?.body || '', originUrl: token.originUrl }) } catch {}
            // Probe existence a few times in case of uploader false negatives
            try {
              setVerifying(true)
              const MAX_TRIES = 3
              for (let attempt = 1; attempt <= MAX_TRIES && !uploadedOk; attempt++) {
                try {
                  const exists = await getJSON(`/api/uploads/exists?key=${encodeURIComponent(token.uploadKey)}`)
                  if (exists?.ok) { uploadedOk = true; break }
                } catch {}
                await new Promise(r => setTimeout(r, 200 * attempt))
              }
            } finally {
              setVerifying(false)
            }
            if (!uploadedOk) throw e
          }
          uploadKey = token.uploadKey
          publicUrl = token.publicUrl || null
        } else {
          const res = await directUploadToBackend(item.uri)
          uploadKey = res.uploadKey || res.key || res.url || filename
          publicUrl = res.url || null
        }
        return { uploadKey, lat: item.meta.lat, lng: item.meta.lng, accuracy: item.meta.accuracy, altitude: item.meta.altitude, altitude_accuracy: item.meta.altitude_accuracy, timestamp: item.meta.timestamp_utc, photo_index: item.meta.photo_index, url: publicUrl }
      }))
    const device_info = captures[0]?.meta?.device_info || null
    // Optional attestation token could be included if available in future
    const resp = await submitVerification({ images: uploaded, device_info })
  toast.show(`Submitted — status: ${resp?.status || 'pending'}`, { type: 'success', duration: 1500 })
      router.replace('/(tabs)/profile')
    } catch (e) {
      // Graceful fallback: queue for retry and notify softly
      try {
        const device_info = captures[0]?.meta?.device_info || null
        const uploaded = captures.map((c, idx) => ({ uri: c.uri, meta: c.meta, photo_index: idx + 1 }))
  await enqueueVerification({ images: uploaded, device_info, reason: e?.message || 'unknown' })
        toast.show('Saved offline. We’ll retry shortly.', { type: 'info', duration: 1800 })
        router.replace('/(tabs)/profile')
      } catch {
        toast.show(e?.message || 'Submission failed', { type: 'error', duration: 2000 })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Review & Submit</Text>
        <View style={styles.row}>
          {captures.map((c, i) => (
            <Image key={i} source={{ uri: c.uri }} style={styles.thumb} />
          ))}
        </View>
  <Text style={styles.p}>Each photo includes GPS and timestamp metadata.</Text>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable style={[styles.btn, (busy || verifying || (captures?.length || 0) < 1) && styles.btnBusy]} disabled={busy || verifying || (captures?.length || 0) < 1} onPress={doSubmit}>
          {(busy && !verifying) ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.btnText}>{verifying ? 'Verifying…' : `Submit (${captures.length}/3 photos)`}</Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 24 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 10, color: COLORS.text },
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  thumb: { width: 96, height: 96, borderRadius: 8 },
  p: { color: COLORS.text, marginBottom: 8 },
  code: { fontWeight: '800' },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.white },
  btn: { backgroundColor: COLORS.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  btnBusy: { opacity: 0.7 },
  btnText: { color: COLORS.white, fontWeight: '700' },
})
