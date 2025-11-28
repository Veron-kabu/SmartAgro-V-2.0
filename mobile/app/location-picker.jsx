import React, { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useProfile } from '../context/profile'
import { COLORS } from '../constants/colors'
import LeafletMap from '../components/LeafletMap'
import { geocode, reverseGeocode } from '../utils/geocoding'
import { patchJSON } from '../context/api'
import { emit } from '../utils/eventBus'
import * as ExpoLocation from 'expo-location'
import { Ionicons } from '@expo/vector-icons'

export default function LocationPickerScreen() {
  const { profile } = useProfile()
  const { mode } = useLocalSearchParams()
  const [coords, setCoords] = useState(() => ({
    latitude: profile?.latitude ? Number(profile.latitude) : (profile?.location?.lat ?? -1.286389),
    longitude: profile?.longitude ? Number(profile.longitude) : (profile?.location?.lng ?? 36.817223),
  }))
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [place, setPlace] = useState(null)
  const [gettingLocation, setGettingLocation] = useState(false)

  const getCurrentLocation = async () => {
    try {
      setGettingLocation(true)
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to use your current location.')
        return
      }
      
      const location = await ExpoLocation.getCurrentPositionAsync({ 
        accuracy: ExpoLocation.Accuracy.High 
      })
      
      setCoords({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      })
    } catch (_error) {
      Alert.alert('Error', 'Failed to get your current location. Please try again.')
    } finally {
      setGettingLocation(false)
    }
  }

  // When coords change, reverse geocode name (debounced by in-process throttling)
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const p = await reverseGeocode(coords.latitude, coords.longitude)
        if (alive) setPlace(p)
      } catch {}
    })()
    return () => { alive = false }
  }, [coords.latitude, coords.longitude])

  const doSearch = async () => {
    const q = query.trim()
    if (!q) { setResults([]); return }
    setLoading(true)
    try {
      const items = await geocode(q, { limit: 8 })
      setResults(items)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const selectResult = (item) => {
    setCoords({ latitude: item.lat, longitude: item.lng })
    setPlace(item)
    setResults([])
  }

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        lat: coords.latitude,
        lng: coords.longitude,
        place_name: place?.placeName,
        address_details: place?.address || null,
      }
      const m = String(mode || 'profile')
      if (m === 'delivery') {
        // For delivery selection during checkout/new order, do not patch profile location by default.
  emit('location:delivery-selected', {
          address: place?.placeName || `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`,
          coords: { lat: coords.latitude, lng: coords.longitude },
          details: place?.address || null,
        })
        router.back()
        return
      }
      if (m === 'product') {
        emit('location:product-selected', {
          text: place?.placeName || `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`,
          coords: { lat: coords.latitude, lng: coords.longitude },
          details: place?.address || null,
        })
        router.back()
        return
      }
      // Default: profile mode — patch normalized location and set profile.address text for convenience
      await patchJSON('/api/location', payload)
      try { await patchJSON('/api/users/profile', { location: payload.place_name || null }) } catch {}
      // Inform any open editors to update field locally
  emit('location:profile-updated', {
        address: payload.place_name || '',
        coords: { lat: payload.lat, lng: payload.lng },
        details: payload.address_details || null,
      })
      router.back()
    } finally {
      setSaving(false)
    }
  }

  const renderItem = ({ item }) => (
    <TouchableOpacity style={{ paddingVertical: 8 }} onPress={() => selectResult(item)}>
      <Text style={{ color: COLORS.text }}>{item.placeName}</Text>
      {item.address?.city || item.address?.county ? (
        <Text style={{ color: COLORS.textLight, fontSize: 12 }}>
          {[item.address?.city, item.address?.county, item.address?.state, item.address?.country].filter(Boolean).join(', ')}
        </Text>
      ) : null}
    </TouchableOpacity>
  )

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={{ padding: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.text }}>Pick your location</Text>
          <TouchableOpacity 
            onPress={getCurrentLocation} 
            disabled={gettingLocation}
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              gap: 4, 
              backgroundColor: COLORS.primary, 
              paddingVertical: 6, 
              paddingHorizontal: 10, 
              borderRadius: 6,
              opacity: gettingLocation ? 0.6 : 1
            }}
          >
            <Ionicons name="locate" size={16} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 12 }}>
              {gettingLocation ? 'Getting...' : 'Current'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            placeholder="Search a place (e.g., Nairobi)"
            placeholderTextColor={COLORS.textLight}
            value={query}
            onChangeText={setQuery}
            style={{ flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, color: COLORS.text }}
            returnKeyType="search"
            onSubmitEditing={doSearch}
          />
          <TouchableOpacity onPress={doSearch} style={{ backgroundColor: COLORS.primary, paddingHorizontal: 12, borderRadius: 8, justifyContent: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>Search</Text>
          </TouchableOpacity>
        </View>
        {loading ? <ActivityIndicator style={{ marginTop: 8 }} /> : null}
        {results.length > 0 && (
          <View style={{ maxHeight: 220, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, marginTop: 8, paddingHorizontal: 12 }}>
            <FlatList
              data={results}
              keyExtractor={(it, idx) => `${it.lat},${it.lng},${idx}`}
              renderItem={renderItem}
            />
          </View>
        )}
      </View>

      <View style={{ flex: 1, paddingHorizontal: 12, paddingBottom: 12 }}>
        <LeafletMap
          latitude={coords.latitude}
          longitude={coords.longitude}
          onChange={(c) => setCoords({ latitude: c.latitude, longitude: c.longitude })}
        />
        <View style={{ marginTop: 8 }}>
          <Text style={{ color: COLORS.text }} numberOfLines={2}>
            {place?.placeName || `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`}
          </Text>
        </View>
      </View>

      <View style={{ padding: 12 }}>
        <TouchableOpacity disabled={saving} onPress={save} style={{ backgroundColor: COLORS.primary, padding: 12, borderRadius: 8, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>{saving ? 'Saving…' : 'Save location'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
