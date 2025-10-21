import React, { useEffect, useState, useMemo } from 'react'
import { View, Text, ActivityIndicator, Image, ScrollView } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { getJSON } from '../../context/api'
import SafeScreen from '../../components/SafeScreen'
import { useResolvedUrls } from '../../hooks/useResolvedUrls'

export default function UserPreview() {
  const { id } = useLocalSearchParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const res = await getJSON(`/api/users/${id}`)
        if (mounted) setData(res)
      } catch (_e) {
        setError('Failed to load user')
      } finally {
        setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [id])

  const [bannerUrl] = useResolvedUrls(useMemo(() => data?.banner_image_url ? [data.banner_image_url] : [], [data?.banner_image_url]))
  const [profileUrl] = useResolvedUrls(useMemo(() => data?.profile_image_url ? [data.profile_image_url] : [], [data?.profile_image_url]))

  return (
    <SafeScreen>
      <ScrollView contentContainerStyle={{ padding: 16, backgroundColor: '#f3f4f6', flexGrow: 1 }}>
  <Text style={{ fontSize: 20, fontWeight: '800' }}>User Preview</Text>
        {loading ? (
          <View style={{ marginTop: 20 }}><ActivityIndicator /></View>
        ) : error ? (
          <Text style={{ color: '#dc2626', marginTop: 8 }}>{error}</Text>
        ) : (
          <View style={{ marginTop: 12, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#e5e7eb' }}>
            {bannerUrl && (
              <Image source={{ uri: bannerUrl }} style={{ width: '100%', height: 140 }} />
            )}
            <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {profileUrl && (
                <Image source={{ uri: profileUrl }} style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#e5e7eb' }} />
              )}
              <View>
                <Text style={{ fontSize: 18, fontWeight: '700' }}>{data?.full_name || data?.username || `User #${data?.id}`}</Text>
                <Text style={{ color: '#6b7280' }}>Role: {data?.role}</Text>
              </View>
            </View>
            <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
              {data?.location && (
                <Text style={{ marginTop: 8, color: '#374151' }}>Location: {typeof data.location === 'string' ? data.location : JSON.stringify(data.location)}</Text>
              )}
              <Text style={{ marginTop: 8, color: '#6b7280' }}>Joined: {data?.created_at ? new Date(data.created_at).toLocaleString() : '—'}</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeScreen>
  )
}
