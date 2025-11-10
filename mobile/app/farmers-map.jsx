import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, ActivityIndicator, TouchableOpacity, FlatList, RefreshControl } from 'react-native'
import LeafletMap from '../components/LeafletMap'
import { COLORS } from '../constants/colors'
import { getJSON } from '../context/api'
import * as ExpoLocation from 'expo-location'
import { Ionicons } from '@expo/vector-icons'

// Simple screen that shows nearby farmers on a map with a list.
// Uses backend endpoint /api/location/nearby/farmers (buyers and farmers allowed)
export default function FarmersMapScreen() {
  const [center, setCenter] = useState({ latitude: -1.286389, longitude: 36.817223 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [farmers, setFarmers] = useState([])
  const [radiusKm, setRadiusKm] = useState(50)
  const [initialized, setInitialized] = useState(false)

  const fetchFarmers = useCallback(async (opts = {}) => {
    try {
      if (!opts.silent) setLoading(true)
      setError(null)
      const url = `/api/location/nearby/farmers?lat=${center.latitude}&lng=${center.longitude}&radiusKm=${radiusKm}&limit=100`
      const data = await getJSON(url)
      setFarmers(Array.isArray(data) ? data : [])
    } catch (e) {
      const msg = e?.message || 'Failed to load farmers'
      // Distinguish 403 and 400 from generic errors if the API client provides status/code
      if (e?.status === 403) setError('You don’t have permission to view nearby farmers. Please sign in with a buyer or farmer account.')
      else if (e?.status === 400) setError('Please set your location first (Profile → Set Location) or enable GPS and try again.')
      else setError(msg)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [center, radiusKm])

  // Initialize: prefer stored location, otherwise fall back to GPS, then fetch
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        // Try server-stored location first (no permission prompt)
        try {
          const me = await getJSON('/api/location/me')
          const lat = Number(me?.latitude)
          const lng = Number(me?.longitude)
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            if (!cancelled) setCenter({ latitude: lat, longitude: lng })
          } else {
            // Fallback to GPS if no stored coords
            if (!cancelled) await locateMe()
          }
        } catch {
          // If API call fails, fallback to GPS
          if (!cancelled) await locateMe()
        }
      } finally {
        if (!cancelled) setInitialized(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (initialized) fetchFarmers()
  }, [initialized, fetchFarmers])

  const locateMe = useCallback(async () => {
    try {
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync()
      if (status !== 'granted') return
      const { coords } = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced })
      setCenter({ latitude: coords.latitude, longitude: coords.longitude })
      // refetch after center update
      setTimeout(() => fetchFarmers(), 100)
    } catch {}
  }, [fetchFarmers])

  const onRefresh = useCallback(() => { setRefreshing(true); fetchFarmers({ silent: true }) }, [fetchFarmers])

  const renderItem = ({ item }) => (
    <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eee' }}>
      <Text style={{ fontWeight: '600', color: COLORS.text }}>{item.fullName || item.username}</Text>
      {item.location?.name && <Text style={{ fontSize: 12, color: COLORS.textLight }}>{item.location.name}</Text>}
      <Text style={{ fontSize: 12, color: COLORS.textLight }}>{item.distanceKm} km away</Text>
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: 'white' }}>
      <View style={{ height: 300 }}>
        <LeafletMap latitude={center.latitude} longitude={center.longitude} zoom={10} onChange={(pos) => setCenter(pos)} />
        <TouchableOpacity onPress={locateMe} style={{ position: 'absolute', top: 12, right: 12, backgroundColor: '#fff', padding: 10, borderRadius: 8, elevation: 2 }}>
          <Ionicons name="locate" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, justifyContent: 'space-between' }}>
        <Text style={{ fontWeight: '700', fontSize: 16 }}>Nearby Farmers</Text>
        <TouchableOpacity onPress={() => fetchFarmers({ silent: true })}>
          <Ionicons name="refresh" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      {error && <Text style={{ color: 'red', paddingHorizontal: 16, marginTop: 4 }}>{error}</Text>}
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="small" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={farmers}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          style={{ flex: 1, paddingHorizontal: 16, marginTop: 4 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={<Text style={{ padding: 16, color: COLORS.textLight }}>No farmers found within {radiusKm} km.</Text>}
        />
      )}
    </View>
  )
}
