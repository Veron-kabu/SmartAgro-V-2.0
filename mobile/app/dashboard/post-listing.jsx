import { useState, useCallback } from 'react'
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Image } from 'react-native'
import { useProfile } from '../../context/profile'
import { postJSON } from '../../context/api'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { useToast } from '../../context/toast'

export default function PostListing() {
  const { profile } = useProfile()
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [unit, setUnit] = useState('kg')
  const [quantity, setQuantity] = useState('')
  const [discountPercent, setDiscountPercent] = useState('')
  const [location, setLocation] = useState(profile?.location || '')
  const [imageUri, setImageUri] = useState(null)
  const [imageUploading, setImageUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  const [posted, setPosted] = useState(null) // stores payload for success confirmation

  const resetForm = useCallback(() => {
    setTitle('')
    setDescription('')
    setPrice('')
    setUnit('kg')
    setQuantity('')
    setDiscountPercent('')
    setLocation(profile?.location || '')
    setImageUri(null)
    setErrors({})
    setPosted(null)
  }, [profile?.location])

  const pickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') return Alert.alert('Permission denied', 'Media permission is required')
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4,3],
        quality: 0.9,
      })
      if (result.canceled) return
      const asset = result.assets?.[0]
      if (!asset) return
      setImageUri(asset.uri)
    } catch (e) {
      toast.show(e?.message || 'Image pick failed', { type: 'error' })
    }
  }, [toast])

  const uploadImageIfNeeded = useCallback(async () => {
    if (!imageUri) return null
    try {
      setImageUploading(true)
      const resp = await fetch(imageUri)
      const blob = await resp.blob()
      let presign
      // Try product specific endpoint first if backend implements it
      try {
        presign = await postJSON('/api/uploads/product-presign', { contentType: blob.type || 'image/jpeg', contentLength: blob.size })
  } catch (_e) {
        // Fallback to avatar-presign (existing) silently
        presign = await postJSON('/api/uploads/avatar-presign', { contentType: blob.type || 'image/jpeg', contentLength: blob.size })
      }
      await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': presign.contentType }, body: blob })
      return presign.publicUrl
    } finally {
      setImageUploading(false)
    }
  }, [imageUri])

  // Validation logic
  const numeric = (v) => {
    if (v === '' || v === null || v === undefined) return null
    const n = Number(v)
    return Number.isFinite(n) ? n : NaN
  }

  const validate = useCallback(() => {
    const next = {}
    if (!title.trim()) next.title = 'Title is required'
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
    return next
  }, [title, price, quantity, unit, discountPercent])

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
      const imgUrl = await uploadImageIfNeeded()
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        category: 'general',
        price: Number(price),
        unit: unit || 'kg',
        quantity_available: Number(quantity),
        location: location || 'Unknown',
        images: imgUrl ? [imgUrl] : [],
        is_organic: false,
        discount_percent: discountPercent === '' ? 0 : Math.min(Math.max(Number(discountPercent)||0,0),90),
      }
      const created = await postJSON('/api/products', payload)
      setPosted({ ...payload, id: created?.id, image: payload.images?.[0] })
      toast.show('Listing posted', { type: 'success' })
    } catch (e) {
      console.error('Create product error:', e)
      toast.show(e?.message || 'Failed to post listing', { type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }, [validate, profile?.role, title, description, price, unit, quantity, location, discountPercent, uploadImageIfNeeded, toast])

  if (posted) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>FarmLink</Text>
        </View>
        <Text style={styles.successHeading}>Listing Posted Successfully!</Text>
        <View style={styles.successCard}>
          {/* Placeholder for image - in full app we could render <Image /> */}
          {posted.image ? (
            <Image source={{ uri: posted.image }} style={styles.successImage} resizeMode="cover" />
          ) : (
            <Text style={styles.noImage}>No Image</Text>
          )}
          <View style={{ marginTop: 12 }}>
            <Text style={styles.successLabel}>Product: <Text style={styles.successValue}>{posted.title}</Text></Text>
            {posted.description && <Text style={styles.successDesc}>Description: {posted.description}</Text>}
            <Text style={styles.successPrice}>Price: ${posted.price} per {posted.unit}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.replace('/dashboard/farmer')}>
          <Text style={styles.actionBtnText}>View My Listings</Text>
        </TouchableOpacity>
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
        <Text style={styles.brand}>FarmLink</Text>
        <TouchableOpacity style={[styles.submitBtn, (!canSubmit) && { opacity: 0.6 }]} disabled={!canSubmit} onPress={onSubmit}>
          {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.submitText}>Submit Post</Text>}
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>Create a New Post</Text>

      <Text style={styles.label}>Product Name</Text>
  <TextInput style={[styles.input, errors.title && styles.inputError]} value={title} onChangeText={(v)=>{ setTitle(v); if(errors.title) setErrors(e=>({...e, title: undefined})) }} placeholder="Enter product name" />
  {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

      <Text style={styles.label}>Description</Text>
      <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} placeholder="Describe your product" multiline numberOfLines={4} textAlignVertical="top" />

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
      <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Location" />

      <Text style={styles.label}>Upload Image</Text>
      <TouchableOpacity style={styles.imagePicker} activeOpacity={0.85} onPress={pickImage}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.imagePreview} resizeMode="cover" />
        ) : (
          <>
            <Text style={styles.uploadIcon}>📷</Text>
            <Text style={styles.uploadHint}>Tap to upload</Text>
          </>
        )}
      </TouchableOpacity>
      {(imageUploading) && <ActivityIndicator style={{ marginTop: 8 }} size="small" color="#16a34a" />}
      <View style={{ height: 48 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 64 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  brand: { fontSize: 18, fontWeight: '700', color: '#111827' },
  title: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: '#374151', marginTop: 12, marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, fontSize: 13 },
  multiline: { borderRadius: 20, minHeight: 120 },
  submitBtn: { backgroundColor: '#000', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
  submitText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  imagePicker: { marginTop: 4, backgroundColor: '#f1f5f9', borderRadius: 20, height: 140, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  imagePreview: { width: '100%', height: '100%', borderRadius: 20 },
  uploadIcon: { fontSize: 22, color: '#64748b', marginBottom: 4 },
  uploadHint: { fontSize: 12, color: '#64748b' },
  imagePicked: { fontSize: 12, color: '#111827' },
  inputError: { borderColor: '#ef4444' },
  errorText: { color: '#ef4444', fontSize: 11, marginTop: 4, marginLeft: 4 },
  successHeading: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 16, textAlign: 'center' },
  successCard: { backgroundColor: '#f1f5f9', padding: 16, borderRadius: 20 },
  successImage: { width: '100%', height: 160, borderRadius: 16, backgroundColor: '#e2e8f0' },
  successLabel: { fontSize: 12, color: '#374151', fontWeight: '600' },
  successValue: { color: '#111827', fontWeight: '700' },
  successDesc: { fontSize: 12, color: '#374151', marginTop: 4 },
  successPrice: { fontSize: 13, color: '#111827', fontWeight: '600', marginTop: 6 },
  noImage: { fontSize: 12, color: '#64748b' },
  actionBtn: { marginTop: 16, backgroundColor: '#000', paddingVertical: 12, borderRadius: 24, alignItems: 'center' },
  actionBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  actionBtnSecondary: { marginTop: 16, backgroundColor: '#fff', paddingVertical: 12, borderRadius: 24, alignItems: 'center', borderWidth: 1, borderColor: '#111827' },
  actionBtnTextSecondary: { color: '#111827', fontWeight: '600', fontSize: 13 },
})
