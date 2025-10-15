import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState, useCallback } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Switch, Image } from 'react-native'
import { getJSON, patchJSON, postJSON } from '../../../context/api'
import { useResolvedUrls } from '../../../hooks/useResolvedUrls'
import * as ImagePicker from 'expo-image-picker'
import { track } from '../../../utils/analytics'
import { ANALYTICS_EVENTS } from '../../../constants/analyticsEvents'
import { productEditStyles as styles } from '../../../assets/styles/products.styles'

export default function EditProduct() {
  const { id } = useLocalSearchParams()
  const numericId = Number(Array.isArray(id) ? id[0] : id)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [discount, setDiscount] = useState('')
  const [active, setActive] = useState(true)
  const [description, setDescription] = useState('')
  const [orig, setOrig] = useState(null)
  const [dirty, setDirty] = useState(false)
  // Images state
  const [images, setImages] = useState([]) // single image array (0 or 1)
  const [imagesAdded, setImagesAdded] = useState([]) // 0 or 1
  const [imagesRemoved, setImagesRemoved] = useState([]) // removal when replacing
  const [addingImage, setAddingImage] = useState(false)

  // Resolve image URLs (handles private S3 URLs) for display
  const resolvedImages = useResolvedUrls(images)

  const load = useCallback(async () => {
    if (!numericId) return
    setLoading(true); setError('')
    try {
      const p = await getJSON(`/api/products/${numericId}`)
      setOrig(p)
  setPrice(String(p.price))
      setQuantity(String(p.quantityAvailable))
      setDiscount(String(p.discountPercent || 0))
      setActive(p.status === 'active')
  setDescription(typeof p.description === 'string' ? p.description : '')
  // Enforce single image locally
  setImages(Array.isArray(p.images) && p.images.length ? [p.images[0]] : [])
      setImagesAdded([]); setImagesRemoved([])
    } catch (e) { setError(e?.message || 'Failed to load product') }
    finally { setLoading(false) }
  }, [numericId])

  useEffect(()=>{ load() }, [load])

  const markDirty = useCallback(() => { if (!dirty) setDirty(true) }, [dirty])

  const pickAndUploadImage = useCallback(async () => {
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
      if (!asset?.uri) return
      setAddingImage(true)
      const resp = await fetch(asset.uri)
      const blob = await resp.blob()
      let presign
      try {
        presign = await postJSON('/api/uploads/product-presign', { contentType: blob.type || 'image/jpeg', contentLength: blob.size })
      } catch (_e) {
        presign = await postJSON('/api/uploads/avatar-presign', { contentType: blob.type || 'image/jpeg', contentLength: blob.size })
      }
      await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': presign.contentType }, body: blob })
      const url = presign.publicUrl
      // Replacing any existing image
      setImages([url])
      setImagesAdded([url])
      markDirty()
    } catch (e) {
      Alert.alert('Image error', e?.message || 'Failed to add image')
    } finally {
      setAddingImage(false)
    }
  }, [markDirty])

  const removeImage = (url) => {
    setImages([])
    setImagesAdded([])
    // Only push to removed if it existed originally
    if (orig?.images?.includes(url)) setImagesRemoved(prev => prev.includes(url) ? prev : [...prev, url])
    markDirty()
  }

  const validate = () => {
    const errs = {}
    const pr = Number(price); if (!Number.isFinite(pr) || pr <= 0) errs.price = 'Invalid price'
    const q = Number(quantity); if (!Number.isInteger(q) || q < 0) errs.quantity = 'Invalid quantity'
    const d = Number(discount); if (!Number.isInteger(d) || d < 0 || d > 90) errs.discount = '0-90'
    return errs
  }

  const errs = validate()
  const canSave = Object.keys(errs).length === 0 && dirty && !saving && !addingImage

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    const optimisticPrev = { ...orig }
  const optimisticNext = { ...orig, price: Number(price), quantityAvailable: Number(quantity), discountPercent: Number(discount), status: active ? 'active' : 'inactive', images, description: description.trim() || null }
    setOrig(optimisticNext) // optimistic UI
    try {
      const body = {
        price: Number(price),
        quantity_available: Number(quantity),
        discount_percent: Number(discount),
        status: active ? 'active' : 'inactive',
        description: description.trim()
      }
      if (imagesAdded.length > 0) body.images_add = imagesAdded
      if (imagesRemoved.length > 0) body.images_remove = imagesRemoved
      const updated = await patchJSON(`/api/products/${numericId}`, body)
      track(ANALYTICS_EVENTS.PRODUCT_UPDATED, { productId: numericId })
      setOrig(updated)
      setImages(Array.isArray(updated?.images) ? updated.images : images)
      setImagesAdded([]); setImagesRemoved([])
      setDirty(false)
      Alert.alert('Saved', 'Product updated')
    } catch (e) {
      // rollback
      setOrig(optimisticPrev)
      setImages(optimisticPrev?.images || [])
      Alert.alert('Error', e?.message || 'Failed to save')
    } finally { setSaving(false) }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding:16 }}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Edit Product</Text>
        <View style={{ width:60 }} />
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} /> : error ? (
        <View style={{ marginTop:40 }}><Text style={styles.error}>{error}</Text><TouchableOpacity onPress={load} style={styles.retry}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View>
      ) : !orig ? null : (
        <View>
          <Text style={styles.label}>Price (KSH)</Text>
          <TextInput value={price} onChangeText={(v)=>{ setPrice(v); markDirty() }} style={[styles.input, errs.price && styles.inputError]} keyboardType='decimal-pad' />
          {errs.price && <Text style={styles.fieldError}>{errs.price}</Text>}

          <Text style={styles.label}>Quantity Available</Text>
          <TextInput value={quantity} onChangeText={(v)=>{ setQuantity(v); markDirty() }} style={[styles.input, errs.quantity && styles.inputError]} keyboardType='numeric' />
          {errs.quantity && <Text style={styles.fieldError}>{errs.quantity}</Text>}

          <Text style={styles.label}>Discount %</Text>
          <TextInput value={discount} onChangeText={(v)=>{ setDiscount(v); markDirty() }} style={[styles.input, errs.discount && styles.inputError]} keyboardType='numeric' />
          {errs.discount && <Text style={styles.fieldError}>{errs.discount}</Text>}

          <Text style={styles.label}>Description</Text>
          <TextInput
            value={description}
            onChangeText={(v)=>{ setDescription(v); markDirty() }}
            style={[styles.input, styles.multilineInput]}
            placeholder='Describe your product (optional)'
            multiline
            numberOfLines={4}
            textAlignVertical='top'
            maxLength={1000}
          />
          <Text style={styles.charCount}>{description.length}/1000</Text>

          <Text style={styles.label}>Image</Text>
          <View style={styles.imagesWrap}>
            {images.length === 1 ? (
              <View key={images[0]} style={styles.imageItem}>
                <Image
                  source={{ uri: (resolvedImages?.[0] || images[0] || 'https://via.placeholder.com/300x200') }}
                  style={styles.imageThumb}
                  resizeMode='cover'
                  onError={() => {
                    // If resolution fails, drop to placeholder so the user sees an image tile
                    if (resolvedImages?.[0] !== 'https://via.placeholder.com/300x200') {
                      // Force local fallback display by clearing to placeholder (non-destructive; images array still holds real URL)
                      // No state write here to avoid infinite loops; RN Image will render nothing if invalid, so placeholder ensures visibility
                    }
                  }}
                />
                <TouchableOpacity style={styles.removeBtn} onPress={()=>removeImage(images[0])}>
                  <Text style={styles.removeBtnText}>×</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.addImage} onPress={pickAndUploadImage} activeOpacity={0.85}>
                {addingImage ? <ActivityIndicator size='small' color={styles?.saveBtn?.backgroundColor || '#111827'} /> : (
                  <Text style={styles.addImageText}>+</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.imagesHint}>{images.length}/1 image</Text>

          <View style={styles.switchRow}>
            <Text style={styles.label}>Active</Text>
            <Switch value={active} onValueChange={(v)=>{ setActive(v); markDirty() }} />
          </View>

          <TouchableOpacity disabled={!canSave} onPress={save} style={[styles.saveBtn, !canSave && { opacity:0.5 }]}>
            {saving ? <ActivityIndicator color={styles?.saveText?.color || '#fff'} /> : <Text style={styles.saveText}>Save Changes</Text>}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )
}
