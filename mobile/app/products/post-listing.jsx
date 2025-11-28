import { useState, useCallback, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Image } from 'react-native'
import { COLORS } from '../../constants/colors'
import CategoryFilter from '../../components/CategoryFilter'
import { CATEGORIES_FOR_FORM } from '../../constants/categories'
import { useProfile } from '../../context/profile'
import { getJSON, postJSON } from '../../context/api'
import { emitAppEvent } from '../../context/favorites'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useToast } from '../../context/toast'
import BlurhashImage from '../../components/BlurhashImage'
import { useResolvedUrls } from '../../hooks/useResolvedUrls'
import { postListingStyles as styles } from '../../assets/styles/listings.styles'

export default function PostListing() {
  const { profile } = useProfile()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [keyFeaturesText, setKeyFeaturesText] = useState('')
  const [price, setPrice] = useState('')
  const [unit, setUnit] = useState('kg')
  const [quantity, setQuantity] = useState('')
  const [discountPercent, setDiscountPercent] = useState('')
  const [location, setLocation] = useState(typeof profile?.location === 'string' ? profile.location : (profile?.placeName || ''))
  const [locationObj, setLocationObj] = useState(null)
  const [imageUris, setImageUris] = useState([]) // support up to 5 images
  const [imageUploading, setImageUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  const [posted, setPosted] = useState(null) // stores payload for success confirmation
  const [category, setCategory] = useState(null)
  // Optional: naive auto-suggest category from title when user hasn't chosen one yet
  const suggestCategory = useCallback((t) => {
    const s = String(t || '').toLowerCase()
  if (!s || category) return
    const pairs = [
      [/tomato|tomatoes|kale|spinach|cabbage|onion|onions|carrot|carrots|lettuce|broccoli|cauliflower|pepper|peppers|zucchini|eggplant|brinjal|cucumber|okra|pumpkin|beetroot|beet|radish|celery|leek/, 'vegetables'],
      [/mango|mangos|mangoes|banana|bananas|orange|oranges|pineapple|avocado|apple|apples|pear|pears|grape|grapes|papaya|pawpaw|watermelon|melon|guava|peach|peaches|plum|plums|berry|berries|lemon|lime|tangerine|pomegranate/, 'fruits'],
      [/maize|corn|wheat|barley|sorghum|rice|oat|oats|millet|quinoa|rye|spelt|buckwheatbean|beans|lentil|lentils|chickpea|chickpeas|pea|peas|pigeon\s*pea|cowpea|soybean|soybeans|mung\s*bean|kidney\s*bean|black\s*bean|navy\s*bean/, 'grains'],
      [/potato|potatoes|cassava|yam|yams|sweet\s*potato|taro|arrowroot|ginger|garlic|turmeric|cumin|cinnamon|peppercorn|paprika|plantain/, 'roots'],
      [/groundnut|groundnuts|macademia|peanut|peanuts|sesame|sunflower|seed|seeds|almond|cashew|nut|nuts|walnut|walnuts|hazelnut|pistachio|flaxseed|chia/, 'nuts'],
      [/milk|dairy|cheese|yoghurt|yogurt|cream|butter|ghee|curd/, 'dairy'],
      [/egg|eggs/, 'eggs']
    ]

    for (const [re, cat] of pairs) {
      if (re.test(s)) { setCategory(cat); break }
    }
  }, [category])
  // Resolve the posted image (if available) so private S3 URLs display on the success screen
  const resolvedPostedArr = useResolvedUrls(posted?.image ? [posted.image] : [])
  const resolvedPosted = resolvedPostedArr?.[0]
  const [verifyStatus, setVerifyStatus] = useState(null)
  // Keep verifyStatus for gating the submit button; banner itself is reusable
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const j = await getJSON('/api/verification/my-status')
        if (mounted) setVerifyStatus(j?.status || 'unverified')
      } catch {
        if (mounted) setVerifyStatus(null)
      }
    })()
    return () => { mounted = false }
  }, [])

  const resetForm = useCallback(() => {
    setTitle('')
    setDescription('')
    setPrice('')
    setUnit('kg')
    setQuantity('')
    setDiscountPercent('')
    setLocation(typeof profile?.location === 'string' ? profile.location : (profile?.placeName || ''))
    setLocationObj(null)
  setImageUris([])
    setErrors({})
    setPosted(null)
  setCategory(null)
  }, [profile?.location, profile?.placeName])

  const pickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') return Alert.alert('Permission denied', 'Media permission is required')
      const allowsMultiple = true
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
        allowsMultipleSelection: allowsMultiple,
      })
      if (result.canceled) return
      const picked = (result.assets || [])
        .map(a => a?.uri)
        .filter(Boolean)
      if (!picked.length) return
      setImageUris(prev => {
        const next = [...prev, ...picked]
        // enforce max 5
        return next.slice(0, 5)
      })
    } catch (e) {
      toast.show(e?.message || 'Image pick failed', { type: 'error' })
    }
  }, [toast])

  const uploadImagesIfNeeded = useCallback(async () => {
    if (!imageUris?.length) return []
    try {
      setImageUploading(true)
      const uploads = []
      for (const uri of imageUris.slice(0, 5)) {
        try {
          const resp = await fetch(uri)
          const blob = await resp.blob()
          let presign
          try {
            presign = await postJSON('/api/uploads/product-presign', { contentType: blob.type || 'image/jpeg', contentLength: blob.size })
          } catch (_e) {
            presign = await postJSON('/api/uploads/avatar-presign', { contentType: blob.type || 'image/jpeg', contentLength: blob.size })
          }
          await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': presign.contentType }, body: blob })
          uploads.push(presign.publicUrl)
        } catch (e) {
          console.warn('Upload failed for one image:', e?.message || e)
        }
      }
      return uploads
    } finally {
      setImageUploading(false)
    }
  }, [imageUris])

  // Listen for map selection for product location
  useEffect(() => {
    const { on, off } = require('../../utils/eventBus')
    const handler = (payload) => {
      const text = payload?.text || payload?.address?.text || ''
      setLocation(text)
      setLocationObj({
        text,
        coords: payload?.coords || null,
        details: payload?.details || payload?.address?.details || payload?.address || null,
      })
    }
    on('location:product-selected', handler)
    return () => off('location:product-selected', handler)
  }, [])

  // Validation logic
  const numeric = (v) => {
    if (v === '' || v === null || v === undefined) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : NaN
  }

  const validate = useCallback(() => {
    const next = {}
    if (!title.trim()) next.title = 'Title is required'
  if (!category) next.category = 'Category is required'
    const p = numeric(price)
    if (p === null) next.price = 'Price is required'
    else if (isNaN(p)) next.price = 'Price must be a number'
    else if (p <= 0) next.price = 'Price must be greater than 0'
    const q = numeric(quantity)
    if (q === null) next.quantity = 'Quantity is required'
    else if (isNaN(q)) next.quantity = 'Quantity must be a number'
    else if (q <= 0) next.quantity = 'Quantity must be > 0'
    if (!unit.trim()) next.unit = 'Unit is required'
    if (discountPercent !== '') {
      const d = numeric(discountPercent)
      if (isNaN(d)) next.discountPercent = 'Discount must be a number'
      else if (d < 0 || d > 90) next.discountPercent = 'Discount 0-90%'
    }
    // Location: allow submission if either a map selection exists OR profile already has coordinates
    const profileHasCoords = (
      (typeof profile?.latitude !== 'undefined' && profile?.latitude !== null && typeof profile?.longitude !== 'undefined' && profile?.longitude !== null) ||
      (profile?.location && typeof profile.location.lat === 'number' && typeof profile.location.lng === 'number')
    )
    if (!(locationObj && locationObj.coords) && !profileHasCoords) {
      next.location = 'Pick location on map or ensure your profile has a saved location'
    }
    return next
  }, [title, category, price, quantity, unit, discountPercent, locationObj, profile])

  const validationErrors = validate()
  const canSubmit = Object.keys(validationErrors).length === 0 && !submitting && !imageUploading

  const onSubmit = useCallback(async () => {
    const errs = validate()
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    if ((profile?.role) !== 'farmer') {
      return toast.show('Only farmers can post listings', { type: 'error' })
    }
    try {
      setSubmitting(true)
  const imgUrls = await uploadImagesIfNeeded()
      // Compute effective location from selection or profile
      const profileCoords = (profile && (profile.latitude != null && profile.longitude != null))
        ? { lat: Number(profile.latitude), lng: Number(profile.longitude) }
        : (profile?.location && typeof profile.location.lat === 'number' && typeof profile.location.lng === 'number')
          ? { lat: profile.location.lat, lng: profile.location.lng }
          : null
      const effectiveCoords = locationObj?.coords || profileCoords
      const effectivePlaceName = (locationObj?.text) || location || (typeof profile?.location === 'string' ? profile.location : (profile?.placeName || null))
      const effectiveAddressDetails = locationObj?.details || profile?.addressDetails || (profile?.location?.address ?? null)

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        category: category,
        price: Number(price),
        unit: unit || 'kg',
        quantity_available: Number(quantity),
        // Normalized location fields: prefer picker, fallback to profile
        latitude: effectiveCoords?.lat ?? null,
        longitude: effectiveCoords?.lng ?? null,
        place_name: effectivePlaceName || null,
        address_details: effectiveAddressDetails || null,
        // Legacy blob for older clients
        location: effectiveCoords ? {
          lat: effectiveCoords.lat,
          lng: effectiveCoords.lng,
          name: effectivePlaceName || null,
          address: effectiveAddressDetails || null,
        } : null,
  images: Array.isArray(imgUrls) ? imgUrls : [],
        is_organic: false,
        discount_percent: discountPercent === '' ? 0 : Math.min(Math.max(Number(discountPercent)||0,0),90),
      }
      // include key features as array of trimmed non-empty lines
      const featuresArr = (typeof keyFeaturesText === 'string') ? keyFeaturesText.split('\n').map(s => s.trim()).filter(Boolean) : []
      if (featuresArr.length > 0) payload.key_features = featuresArr
  const created = await postJSON('/api/products', payload)
  setPosted({ ...payload, id: created?.id, image: payload.images?.[0] })
  // Broadcast creation so Home, My Listings, and Profile can update instantly
  try { emitAppEvent('product:created', { productId: created?.id, product: created }) } catch {}
      toast.show('Listing posted', { type: 'success' })
    } catch (e) {
      console.error('Create product error:', e)
      toast.show(e?.message || 'Failed to post listing', { type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }, [validate, profile, title, description, price, unit, quantity, location, discountPercent, category, uploadImagesIfNeeded, toast, locationObj, keyFeaturesText])

  if (posted) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>SmartAgro</Text>
        </View>
        <Text style={styles.successHeading}>Listing Posted Successfully!</Text>
        <View style={styles.successCard}>
          {/* Placeholder for image - in full app we could render <Image /> */}
          {posted.image ? (
            <BlurhashImage uri={resolvedPosted || posted.image} style={styles.successImage} contentFit="cover" />
          ) : (
            <Text style={styles.noImage}>No Image</Text>
          )}
          <View style={{ marginTop: 12 }}>
            <Text style={styles.successLabel}>Product: <Text style={styles.successValue}>{posted.title}</Text></Text>
            {posted.description && <Text style={styles.successDesc}>Description: {posted.description}</Text>}
            <Text style={styles.successPrice}>Price: Ksh{posted.price} per {posted.unit}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.actionBtn} onPress={resetForm}>
          <Text style={styles.actionBtnText}>Add New Listing</Text>
        </TouchableOpacity>
        {posted?.id && (
          <TouchableOpacity style={styles.actionBtnSecondary} onPress={() => router.replace(`/products/edit/${posted.id}`)}>
            <Text style={styles.actionBtnTextSecondary}>Edit Listing</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    )
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.headerRow}>
        <Text style={styles.brand}>SmartAgro</Text>
      </View>
      {String(profile?.status || '').toLowerCase() === 'suspended' && (
        <View style={{ backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', borderWidth: 1, padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <Text style={{ color: '#B91C1C', fontWeight: '700' }}>Account suspended</Text>
          <Text style={{ color: '#7F1D1D', marginTop: 4, fontSize: 12 }}>You cannot post or edit listings until your account is reactivated.</Text>
        </View>
      )}
      {/* Simple verification callout */}
      {verifyStatus && verifyStatus !== 'verified' && (
        <View style={{ backgroundColor: '#fff7ed', borderColor: '#fdba74', borderWidth: 1, padding: 12, borderRadius: 8, marginBottom: 12 }}>
          <Text style={{ color: '#9a3412', marginBottom: 8 }}>You need to verify your account to post listings.</Text>
          <TouchableOpacity
            onPress={() => router.push('/verification')}
            style={{ backgroundColor: '#f97316', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 6, alignSelf: 'flex-start' }}
            activeOpacity={0.85}
          >
            <Text style={{ color: 'white', fontWeight: '700' }}>Verify account</Text>
          </TouchableOpacity>
        </View>
      )}
      <Text style={styles.title}>Create a New Post</Text>

      <Text style={styles.label}>Product Name</Text>
  <TextInput style={[styles.input, errors.title && styles.inputError]} value={title} onChangeText={(v)=>{ setTitle(v); suggestCategory(v); if(errors.title) setErrors(e=>({...e, title: undefined})) }} placeholder="Enter product name" />
  {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

      <Text style={styles.label}>Description</Text>
      <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} placeholder="Describe your product" multiline numberOfLines={4} textAlignVertical="top" />

      <Text style={styles.label}>Key Features (one per line)</Text>
      <TextInput style={[styles.input, styles.multiline]} value={keyFeaturesText} onChangeText={setKeyFeaturesText} placeholder="List key features, one per line (optional)" multiline numberOfLines={4} textAlignVertical="top" />

      <Text style={styles.label}>Price</Text>
  <TextInput style={[styles.input, errors.price && styles.inputError]} value={price} onChangeText={(v)=>{ setPrice(v); if(errors.price) setErrors(e=>({...e, price: undefined})) }} placeholder="Enter price in Ksh" keyboardType="decimal-pad" />
  {errors.price && <Text style={styles.errorText}>{errors.price}</Text>}

      <Text style={styles.label}>Unit</Text>
  <TextInput style={[styles.input, errors.unit && styles.inputError]} value={unit} onChangeText={(v)=>{ setUnit(v); if(errors.unit) setErrors(e=>({...e, unit: undefined})) }} placeholder="e.g. kg, bag" />
  {errors.unit && <Text style={styles.errorText}>{errors.unit}</Text>}

      <Text style={styles.label}>Quantity Available</Text>
  <TextInput style={[styles.input, errors.quantity && styles.inputError]} value={quantity} onChangeText={(v)=>{ setQuantity(v); if(errors.quantity) setErrors(e=>({...e, quantity: undefined})) }} placeholder="Enter quantity" keyboardType="numeric" />
  {errors.quantity && <Text style={styles.errorText}>{errors.quantity}</Text>}

    <Text style={styles.label}>Discount (%)</Text>
  <TextInput style={[styles.input, errors.discountPercent && styles.inputError]} value={discountPercent} onChangeText={(v)=>{ setDiscountPercent(v); if(errors.discountPercent) setErrors(e=>({...e, discountPercent: undefined})) }} placeholder="0-90" keyboardType="numeric" />
  {errors.discountPercent && <Text style={styles.errorText}>{errors.discountPercent}</Text>}

      <Text style={styles.label}>Location</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={location}
          onChangeText={(t) => { setLocation(t); setLocationObj(null) }}
          placeholder="Pick location or type address"
        />
        <TouchableOpacity
          onPress={() => router.push({ pathname: '/location-picker', params: { mode: 'product' } })}
          activeOpacity={0.85}
          style={{ padding: 8 }}
          accessibilityLabel="Pick location on map"
        >
          <Ionicons name="location" size={22} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
      {errors.location && <Text style={styles.errorText}>{errors.location}</Text>}

      <Text style={styles.label}>Category</Text>
      <CategoryFilter categories={CATEGORIES_FOR_FORM} selectedCategory={category} onSelectCategory={setCategory} />
      {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}

      <Text style={styles.label}>Upload Images (up to 5)</Text>
      <TouchableOpacity style={styles.imagePicker} activeOpacity={0.85} onPress={pickImage}>
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="cloud-upload-outline" size={28} color={COLORS.textLight} />
          <Text style={styles.uploadHint}>{imageUris.length ? `Add more images (${imageUris.length}/5)` : 'Select Images'}</Text>
        </View>
      </TouchableOpacity>
      {imageUris.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {imageUris.map((uri, idx) => (
              <View key={uri + idx} style={{ position: 'relative' }}>
                <Image source={{ uri }} style={{ width: 90, height: 90, borderRadius: 10 }} resizeMode="cover" />
                <TouchableOpacity
                  onPress={() => setImageUris(prev => prev.filter((_, i) => i !== idx))}
                  style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#0009', borderRadius: 12, padding: 4 }}
                  accessibilityLabel={`Remove image ${idx+1}`}
                >
                  <Ionicons name="close" color="#fff" size={14} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
  {(imageUploading) && <ActivityIndicator style={{ marginTop: 8 }} size="small" color={COLORS.primary} />}
      
  <TouchableOpacity style={[styles.submitBtn, ((!canSubmit) || String(profile?.status||'').toLowerCase()==='suspended') && { opacity: 0.6 }]} disabled={!canSubmit || String(profile?.status||'').toLowerCase()==='suspended'} onPress={onSubmit}>
  {submitting ? <ActivityIndicator size="small" color={COLORS.white} /> : <Text style={styles.submitText}>Submit Post</Text>}
      </TouchableOpacity>
      
      <View style={{ height: 48 }} />
    </ScrollView>
  )
}
