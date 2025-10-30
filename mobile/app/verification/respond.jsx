import React, { useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, StyleSheet, Pressable, Image, Alert, ActivityIndicator, TextInput, ScrollView } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Location from 'expo-location'
import { COLORS, BACKDROP } from '../../constants/colors'
import { Ionicons } from '@expo/vector-icons'
import { getUploadToken, uploadToPresignedUrl } from '../../utils/verification'
import { getJSON, postJSON } from '../../context/api'
import { useToast } from '../../context/toast'
// ImageLightbox removed with per-image guidance

export default function VerificationRespond() {
  const { id } = useLocalSearchParams()
  const submissionId = useMemo(() => Number(id), [id])
  const router = useRouter()
  const toast = useToast()
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef(null)
  const [locGranted, setLocGranted] = useState(false)
  const [captures, setCaptures] = useState([])
  const [busy, setBusy] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [notes, setNotes] = useState([])
  const [userNote, setUserNote] = useState('')
  // Per-image guidance removed
  // Lightbox state removed
  const [panelCollapsed, setPanelCollapsed] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        if (!permission?.granted) {
          const res = await requestPermission()
          if (!res.granted) Alert.alert('Camera permission required')
        }
      } finally {
        const { status } = await Location.requestForegroundPermissionsAsync()
        setLocGranted(status === 'granted')
      }
    })()
  }, [requestPermission, permission?.granted])

  // Load reviewer notes so the user knows what to improve
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const latest = await getJSON('/api/verification/my-latest')
        if (!mounted) return
        const comments = Array.isArray(latest?.adminComments) ? latest.adminComments.filter(c => c.visibleToUser) : []
        setNotes(comments)
        // Prefer the reviewer-selected needs-correction image if present; fall back to last rejected image
  // setNeedsCorrectionImage(latest?.needsCorrectionImage || null)
  // setRejectedImage(latest?.rejectedImage || null)
      } catch { setNotes([]) }
    })()
    return () => { mounted = false }
  }, [])

  const takePhoto = async () => {
    if (busy || captures.length >= 3) return
    try {
      setBusy(true)
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, skipProcessing: true })
      const insertIndex = captures.length
      const baseMeta = {
        lat: null,
        lng: null,
        accuracy: null,
        altitude: null,
        altitude_accuracy: null,
        timestamp: new Date().toISOString(),
        photo_index: insertIndex + 1,
      }
      setCaptures(prev => [...prev, { uri: photo?.uri, meta: baseMeta }])
      setBusy(false)
      try {
        let position = await Location.getLastKnownPositionAsync()
        if (!position) {
          position = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise(resolve => setTimeout(() => resolve(null), 1500)),
          ])
        }
        if (position?.coords) {
          const { latitude, longitude, accuracy, altitude, altitudeAccuracy } = position.coords
          setCaptures(prev => {
            const next = [...prev]
            if (next[insertIndex] && next[insertIndex].meta) {
              next[insertIndex] = {
                ...next[insertIndex],
                meta: { ...next[insertIndex].meta, lat: latitude, lng: longitude, accuracy: accuracy ?? next[insertIndex].meta.accuracy, altitude: altitude ?? next[insertIndex].meta.altitude, altitude_accuracy: altitudeAccuracy ?? next[insertIndex].meta.altitude_accuracy },
              }
            }
            return next
          })
        }
      } catch {}
    } catch (e) {
      setBusy(false)
      Alert.alert('Capture failed', e?.message || String(e))
    }
  }

  const renumberCaptures = (list) => list.map((it, idx) => ({ ...it, meta: { ...it.meta, photo_index: idx + 1 } }))
  const deleteCapture = (idx) => setCaptures(prev => renumberCaptures(prev.filter((_, i) => i !== idx)))
  const clearAll = () => setCaptures([])

  const submitResponse = async () => {
    if (!submissionId) return
    if (captures.length !== 3) {
      toast.show('Please capture exactly 3 photos before submitting.', { type: 'error' })
      return
    }
    try {
      setSubmitting(true)
      toast.show('Uploading…', { type: 'info', duration: 1200 })
      const uploaded = await Promise.all(captures.map(async (item, i) => {
        const filename = `respond_${submissionId}_${Date.now()}_${i+1}.jpg`
        const token = await getUploadToken(filename, 'image/jpeg', { noAcl: true })
        if (!token?.uploadUrl) throw new Error('Upload not available')
        await uploadToPresignedUrl(token.uploadUrl, item.uri, token.contentType || 'image/jpeg')
        return {
          uploadKey: token.uploadKey,
          url: token.publicUrl || null,
          lat: item.meta.lat,
          lng: item.meta.lng,
          accuracy: item.meta.accuracy,
          altitude: item.meta.altitude,
          altitude_accuracy: item.meta.altitude_accuracy,
          timestamp: item.meta.timestamp,
          photo_index: item.meta.photo_index,
        }
      }))
  await postJSON(`/api/verification/${submissionId}/respond-more`, { images: uploaded, note: userNote?.trim() || undefined })
  toast.show('Submitted. We\'ll review shortly.', { type: 'success' })
  router.replace('/profile')
    } catch (e) {
      toast.show(e?.message || 'Failed to submit', { type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {!permission?.granted ? (
        <View style={styles.center}><Text style={{ color: COLORS.text }}>Camera permission required</Text></View>
      ) : (
        <View style={{ flex: 1 }}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
          {/* Top overlay panel to avoid overlapping UI elements */}
          <View style={[styles.overlayPanel, panelCollapsed && styles.overlayPanelCollapsed]} pointerEvents="box-none">
            {/* Handle / header */}
            <Pressable style={styles.overlayHandle} onPress={() => setPanelCollapsed(v => !v)} accessibilityRole="button" accessibilityLabel={panelCollapsed ? 'Expand guidance panel' : 'Collapse guidance panel'}>
              <Ionicons name={panelCollapsed ? 'chevron-down' : 'chevron-up'} size={18} color={COLORS.text} />
              <Text style={styles.handleText}>{panelCollapsed ? 'Show guidance' : 'Hide guidance'}</Text>
            </Pressable>
            {!panelCollapsed && (
            <ScrollView contentContainerStyle={styles.overlayContent}>
              {notes.length > 0 && (
                <View style={styles.panelSection}>
                  <Text style={styles.panelTitle}>Reviewer notes</Text>
                  {notes.map((n, i) => (
                    <Text key={i} style={styles.noteText}>• {n.text}</Text>
                  ))}
                </View>
              )}
                  {/* Per-image reference removed */}
              <View style={styles.panelSection}>
                <Text style={styles.noteLabel}>Add a short note (optional)</Text>
                <TextInput
                  style={styles.noteInput}
                  placeholder="e.g., Closer photo of the farm sign"
                  placeholderTextColor="#9CA3AF"
                  value={userNote}
                  onChangeText={setUserNote}
                  maxLength={160}
                />
              </View>
            </ScrollView>
            )}
          </View>
          {captures.length > 0 && (
            <View style={styles.thumbRow}>
              {captures.map((c, i) => (
                <View key={i} style={styles.thumbWrap}>
                  <Image source={{ uri: c.uri }} style={styles.thumb} />
                  <Pressable onPress={() => deleteCapture(i)} style={styles.removeBtn} accessibilityLabel={`Remove photo ${i+1}`}>
                    <Ionicons name="close" size={14} color={COLORS.white} />
                  </Pressable>
                  {(c?.meta?.lat != null && c?.meta?.lng != null) && (
                    <View style={styles.gpsBadge}><Ionicons name="location-sharp" size={12} color={COLORS.white} /></View>
                  )}
                </View>
              ))}
            </View>
          )}
          <View style={styles.footer}>
            <Pressable
              style={[styles.shutterLarge, (busy || captures.length >= 3) && styles.disabled]}
              onPress={takePhoto}
              disabled={busy || captures.length >= 3}
              accessibilityLabel="Capture photo">
              <Ionicons name="camera" size={22} color={COLORS.text} />
            </Pressable>

            <Pressable
              style={[styles.nextFull, (submitting || captures.length !== 3) && styles.disabled]}
              onPress={submitResponse}
              disabled={submitting || captures.length !== 3}
              accessibilityLabel="Submit response">
              {submitting ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.nextText}>Submit {captures.length > 0 ? `${captures.length}/${3}` : ''}</Text>
              )}
            </Pressable>

            {captures.length > 0 && (
              <Pressable style={styles.clearBtn} onPress={clearAll} accessibilityLabel="Clear all photos">
                <Text style={styles.clearText}>Clear all</Text>
              </Pressable>
            )}
          </View>
          {!locGranted && (
            <View style={styles.warn}><Text style={styles.warnText}>Location permission denied. GPS will be missing.</Text></View>
          )}
        </View>
      )}
      {/* Zoomable fullscreen preview for the rejected image */}
      {/* Per-image reference viewer removed */}
    </View>
  )
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: BACKDROP.dark, gap: 12 },
  shutterLarge: { backgroundColor: COLORS.white, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 24, flex: 1, alignItems: 'center' },
  nextFull: { backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, flex: 1, alignItems: 'center' },
  nextText: { color: COLORS.white, fontWeight: '700' },
  disabled: { opacity: 0.6 },
  thumbRow: { flexDirection: 'row', gap: 8, padding: 8, backgroundColor: BACKDROP.medium },
  thumbWrap: { position: 'relative' },
  thumb: { width: 64, height: 64, borderRadius: 6 },
  removeBtn: { position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.error, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  gpsBadge: { position: 'absolute', bottom: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  warn: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: COLORS.error, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
  warnText: { color: COLORS.white },
  clearBtn: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' },
  clearText: { color: COLORS.white, fontWeight: '700' },
  overlayPanel: { position: 'absolute', top: 10, left: 10, right: 10, zIndex: 10, backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', padding: 8, maxHeight: 260 },
  overlayPanelCollapsed: { paddingBottom: 6, maxHeight: 44 },
  overlayHandle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 },
  handleText: { color: COLORS.text, fontSize: 12, fontWeight: '600' },
  overlayContent: { paddingBottom: 4 },
  panelSection: { marginBottom: 8 },
  panelTitle: { fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  notesCard: { display: 'none' },
  notesTitle: { fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  noteText: { color: COLORS.text },
  noteOverlay: { display: 'none' },
  noteLabel: { color: COLORS.text, fontSize: 12, marginBottom: 4 },
  noteInput: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB', borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: COLORS.text },
  rejectedCard: { display: 'none' },
  rejectedThumb: { width: 96, height: 96, borderRadius: 8, marginTop: 6 },
})
