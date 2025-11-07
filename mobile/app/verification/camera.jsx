import React, { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, StyleSheet, Image, Alert } from 'react-native'
import ImageLightbox from '../../components/ImageLightbox'
import { useRouter } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Location from 'expo-location'
import { reverseGeocode } from '../../utils/geocoding'
import CameraOverlay from '../../components/CameraOverlay'
import { buildDeviceInfo } from '../../utils/verification'
import { COLORS, BACKDROP } from '../../constants/colors'
import { Ionicons } from '@expo/vector-icons'

export default function VerificationCamera() {
  const router = useRouter()
  const cameraRef = useRef(null)
  const [permission, requestPermission] = useCameraPermissions()
  const [locGranted, setLocGranted] = useState(false)
  const [captures, setCaptures] = useState([]) // [{uri, meta}]
  const [busy, setBusy] = useState(false)
  const [previewIndex, setPreviewIndex] = useState(null) // full-screen preview index

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

  const takePhoto = async () => {
    if (busy || captures.length >= 3) return
    try {
      setBusy(true)
      // 1) Take the picture immediately for instant feedback
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8, skipProcessing: true })
      const device_info = buildDeviceInfo()
      const insertIndex = captures.length // position where this photo will be placed
      const baseMeta = {
        lat: null,
        lng: null,
        accuracy: null,
        altitude: null,
        altitude_accuracy: null,
        timestamp_utc: new Date().toISOString(),
        device_info,
        photo_index: insertIndex + 1,
      }
      setCaptures(prev => [...prev, { uri: photo?.uri, meta: baseMeta }])
      setBusy(false) // release UI lock asap

      // 2) Fetch location in the background and patch into state when available
      try {
        let position = await Location.getLastKnownPositionAsync()
        if (!position) {
          // Race a quick current position with a short timeout for responsiveness
          position = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise(resolve => setTimeout(() => resolve(null), 1500)),
          ])
        }
        if (position?.coords) {
          const { latitude, longitude, accuracy, altitude, altitudeAccuracy } = position.coords
          // Reverse geocode to normalized fields (place_name + address_details)
          let place = null
          try { place = await reverseGeocode(latitude, longitude) } catch {}
          setCaptures(prev => {
            const next = [...prev]
            if (next[insertIndex] && next[insertIndex].meta) {
              next[insertIndex] = {
                ...next[insertIndex],
                meta: {
                  ...next[insertIndex].meta,
                  lat: latitude,
                  lng: longitude,
                  accuracy: accuracy ?? next[insertIndex].meta.accuracy,
                  altitude: altitude ?? next[insertIndex].meta.altitude,
                  altitude_accuracy: altitudeAccuracy ?? next[insertIndex].meta.altitude_accuracy,
                  place_name: place?.placeName || null,
                  address_details: place?.address || null,
                },
              }
            }
            return next
          })
        }
      } catch {
        // Location optional; proceed without it
      }
    } catch (e) {
      setBusy(false)
      Alert.alert('Capture failed', e?.message || String(e))
    }
  }

  const proceed = () => {
    if (captures.length < 1) return
    router.push({ pathname: '/verification/submit', params: { payload: JSON.stringify(captures) } })
  }

  const renumberCaptures = (list) => list.map((it, idx) => ({ ...it, meta: { ...it.meta, photo_index: idx + 1 } }))
  const deleteCapture = (idx) => {
    setCaptures(prev => renumberCaptures(prev.filter((_, i) => i !== idx)))
  }
  const clearAll = () => setCaptures([])

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      {permission?.granted ? (
        <View style={{ flex: 1 }}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
          <CameraOverlay step={captures.length} total={3} />
          {/* Thumbnails with GPS badge and remove */}
          {captures.length > 0 && (
            <View style={styles.thumbRow}>
              {captures.map((c, i) => {
                const hasGps = c?.meta?.lat != null && c?.meta?.lng != null
                return (
                  <Pressable key={i} style={styles.thumbWrap} onPress={() => setPreviewIndex(i)} accessibilityLabel={`Preview photo ${i+1}`}>
                    <Image source={{ uri: c.uri }} style={styles.thumb} />
                    {/* Remove button */}
                    <Pressable onPress={() => deleteCapture(i)} style={styles.removeBtn} accessibilityLabel={`Remove photo ${i+1}`}>
                      <Ionicons name="close" size={14} color={COLORS.white} />
                    </Pressable>
                    {/* GPS badge */}
                    {hasGps && (
                      <View style={styles.gpsBadge}>
                        <Ionicons name="location-sharp" size={12} color={COLORS.white} />
                      </View>
                    )}
                  </Pressable>
                )
              })}
            </View>
          )}

          {/* Sticky footer controls: show shutter until 3, then swap to Review */}
          <View style={styles.footer}>
            {captures.length < 3 ? (
              <Pressable style={[styles.shutterLarge, busy && styles.disabled]} onPress={takePhoto} disabled={busy} accessibilityLabel="Capture photo">
                <Ionicons name="camera" size={22} color={COLORS.text} />
              </Pressable>
            ) : (
              <Pressable style={styles.nextFull} onPress={proceed} accessibilityLabel="Review and submit">
                <Text style={styles.nextText}>Review & Submit</Text>
              </Pressable>
            )}
            {captures.length > 0 && (
              <Pressable style={styles.clearBtn} onPress={clearAll} accessibilityLabel="Clear all photos">
                <Text style={styles.clearText}>Clear all</Text>
              </Pressable>
            )}
          </View>
          {/* Zoomable image preview using shared lightbox (falls back gracefully if lib missing) */}
          <ImageLightbox
            images={captures.map(c => c.uri)}
            index={previewIndex ?? 0}
            visible={previewIndex !== null}
            onRequestClose={() => setPreviewIndex(null)}
          />
          {!locGranted && (
            <View style={styles.warn}><Text style={styles.warnText}>Location permission denied. GPS will be missing.</Text></View>
          )}
        </View>
      ) : (
        <View style={styles.center}> 
          <Text style={{ color: COLORS.text }}>Camera permission required</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: BACKDROP.dark, gap: 12 },
  shutterLarge: { backgroundColor: COLORS.white, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 24, flex: 1, alignItems: 'center' },
  nextFull: { backgroundColor: COLORS.primary, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, flex: 1, alignItems: 'center' },
  nextText: { color: COLORS.white, fontWeight: '700' },
  disabled: { opacity: 0.5 },
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
  previewBackdrop: { flex:1, backgroundColor:'rgba(0,0,0,0.9)', alignItems:'center', justifyContent:'center' },
  previewClose: { position:'absolute', top:40, right:20, padding:8 },
  previewImage: { width: '92%', height: '70%', borderRadius: 8 },
  previewMetaBox: { position:'absolute', bottom: 40, left: 20, right: 20, backgroundColor:'rgba(0,0,0,0.6)', padding: 8, borderRadius: 8 },
  previewMetaText: { color:'#fff', fontSize:12 }
})
