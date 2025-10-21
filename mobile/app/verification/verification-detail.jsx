import React, { useMemo } from 'react'
import { View, Text, Image, StyleSheet, TouchableOpacity, Linking, ScrollView } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useResolvedUrls } from '../../hooks/useResolvedUrls'

export default function VerificationDetail() {
  const router = useRouter()
  const { image, lat, lng, ts, idx, code, device } = useLocalSearchParams()
  const rawUrl = useMemo(() => decodeURIComponent(String(image || '')), [image])
  const [resolvedUrl] = useResolvedUrls([rawUrl])
  const latNum = lat ? Number(lat) : null
  const lngNum = lng ? Number(lng) : null
  const timeStr = ts ? new Date(ts).toLocaleString() : null
  const mapUrl = (latNum != null && lngNum != null)
    ? `https://www.google.com/maps?q=${latNum},${lngNum}`
    : null

  return (
    <ScrollView contentContainerStyle={styles.container}>
  <Image source={{ uri: resolvedUrl || rawUrl }} style={styles.image} resizeMode="contain" />
      <View style={styles.meta}>
        <Text style={styles.title}>Photo #{idx || 1}</Text>
        {code && <Text style={styles.line}>Code: <Text style={styles.bold}>{code}</Text></Text>}
        {timeStr && <Text style={styles.line}>Captured: <Text style={styles.bold}>{timeStr}</Text></Text>}
        {(latNum != null && lngNum != null) && (
          <Text style={styles.line}>GPS: <Text style={styles.bold}>{latNum.toFixed(6)}, {lngNum.toFixed(6)}</Text></Text>
        )}
        {device && <Text style={styles.line}>Device: <Text style={styles.bold}>{device}</Text></Text>}
        {mapUrl && (
          <TouchableOpacity onPress={() => Linking.openURL(mapUrl)} style={styles.mapBtn}>
            <Text style={styles.mapBtnText}>Open in Maps</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { padding: 12 },
  image: { width: '100%', height: 360, backgroundColor: '#000', borderRadius: 12 },
  meta: { marginTop: 12 },
  title: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  line: { color: '#374151', marginTop: 4 },
  bold: { fontWeight: '700' },
  mapBtn: { backgroundColor: '#2563eb', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start', marginTop: 10 },
  mapBtnText: { color: '#fff', fontWeight: '700' },
  backBtn: { backgroundColor: '#111827', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start', marginTop: 10 },
  backBtnText: { color: '#fff', fontWeight: '700' },
})
