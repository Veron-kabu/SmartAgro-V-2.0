import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState, useCallback, useLayoutEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, Switch, Image } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../../constants/colors'
import { getJSON, patchJSON, postJSON } from '../../../context/api'
import { useNavigation } from '@react-navigation/native'
import { useProfile } from '../../../context/profile'
import { useResolvedUrls } from '../../../hooks/useResolvedUrls'
import * as ImagePicker from 'expo-image-picker'
import { track } from '../../../utils/analytics'
import { ANALYTICS_EVENTS } from '../../../constants/analyticsEvents'
import { productEditStyles as styles } from '../../../assets/styles/products.styles'
import { emitAppEvent } from '../../../context/favorites'

export default function EditProduct() {
  const { id } = useLocalSearchParams()
  const { profile } = useProfile()
  const numericId = Number(Array.isArray(id) ? id[0] : id)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('')
  const [discount, setDiscount] = useState('')
  const [active, setActive] = useState(true)
  const [description, setDescription] = useState('')
  const [keyFeaturesText, setKeyFeaturesText] = useState('')
  const [orig, setOrig] = useState(null)
  const [dirty, setDirty] = useState(false)
  // Images state (support up to 5)
  const [images, setImages] = useState([])
  const [imagesAdded, setImagesAdded] = useState([]) // newly uploaded URLs to add
  const [imagesRemoved, setImagesRemoved] = useState([]) // existing URLs removed
  const [addingImage, setAddingImage] = useState(false)

  // Resolve image URLs (handles private S3 URLs) for display
  const resolvedImages = useResolvedUrls(images)
  const navigation = useNavigation()

  // Hide native header and rely on the screen's in-page header row
  useLayoutEffect(() => {
    try { navigation.setOptions({ headerShown: false }) } catch (_e) {}
  }, [navigation])

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
    setKeyFeaturesText(Array.isArray(p.keyFeatures) ? p.keyFeatures.join('\n') : (Array.isArray(p.features) ? p.features.join('\n') : ''))
  // Load all existing images (max 5)
  setImages(Array.isArray(p.images) ? p.images.slice(0,5) : [])
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
      if (images.length >= 5) return Alert.alert('Limit reached', 'You can upload up to 5 images')
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.9,
        allowsMultipleSelection: true,
      })
      if (result.canceled) return
      const assets = (result.assets || []).filter(Boolean)
      if (assets.length === 0) return
      setAddingImage(true)
      const uploaded = []
      for (const a of assets) {
        if (!a?.uri) continue
        // Enforce overall max 5 including existing
        if ((images.length + uploaded.length) >= 5) break
        try {
          const resp = await fetch(a.uri)
          const blob = await resp.blob()
          let presign
          try {
            presign = await postJSON('/api/uploads/product-presign', { contentType: blob.type || 'image/jpeg', contentLength: blob.size })
          } catch (_e) {
            presign = await postJSON('/api/uploads/avatar-presign', { contentType: blob.type || 'image/jpeg', contentLength: blob.size })
          }
          await fetch(presign.uploadUrl, { method: 'PUT', headers: { 'Content-Type': presign.contentType }, body: blob })
          uploaded.push(presign.publicUrl)
        } catch (e) {
          console.warn('Upload failed for an image:', e?.message || e)
        }
      }
      if (uploaded.length > 0) {
        setImages(prev => {
          const next = [...prev, ...uploaded]
          return next.slice(0,5)
        })
        setImagesAdded(prev => [...prev, ...uploaded])
        markDirty()
      }
    } catch (e) {
      Alert.alert('Image error', e?.message || 'Failed to add image')
    } finally {
      setAddingImage(false)
    }
  }, [images.length, markDirty])

  const removeImage = (url, index) => {
    setImages(prev => prev.filter((_, i) => i !== index))
    // If the removed url was added in this session, drop it from imagesAdded; otherwise, mark as removed
    setImagesAdded(prev => prev.filter(u => u !== url))
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
    // prepare features array for optimistic UI and payload
    const featuresArr = (typeof keyFeaturesText === 'string')
      ? keyFeaturesText.split('\n').map(s => s.trim()).filter(Boolean)
      : []
  const optimisticNext = { ...orig, price: Number(price), quantityAvailable: Number(quantity), discountPercent: Number(discount), status: active ? 'active' : 'inactive', images, description: description.trim() || null, keyFeatures: featuresArr }
    setOrig(optimisticNext) // optimistic UI
    try {
      const body = {
        price: Number(price),
        quantity_available: Number(quantity),
        discount_percent: Number(discount),
        status: active ? 'active' : 'inactive',
        description: description.trim()
      }
      // send key_features as array of non-empty trimmed lines
      if (featuresArr.length > 0) body.key_features = featuresArr
      if (imagesAdded.length > 0) body.images_add = imagesAdded
      if (imagesRemoved.length > 0) body.images_remove = imagesRemoved
      const updated = await patchJSON(`/api/products/${numericId}`, body)
      track(ANALYTICS_EVENTS.PRODUCT_UPDATED, { productId: numericId })
      setOrig(updated)
      try { emitAppEvent('product:updated', { productId: numericId, product: updated }) } catch {}
      setImages(Array.isArray(updated?.images) ? updated.images : images)
      // reflect returned keyFeatures if backend returns it
      setKeyFeaturesText(Array.isArray(updated?.keyFeatures) ? updated.keyFeatures.join('\n') : (featuresArr.join('\n') || ''))
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
      <View style={styles.headerRow} marginTop={-10}>
        <TouchableOpacity onPress={() => { try { navigation.goBack() } catch { } }} style={{ width:48, alignItems: 'flex-start' }}>
          <Ionicons name="chevron-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { flex: 1, textAlign: 'center' }]}>Edit Product</Text>
        <View style={{ width:48 }} />
      </View>
      {String(profile?.status || '').toLowerCase() === 'suspended' && (
        <View style={{ backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', borderWidth: 1, padding: 12, borderRadius: 8, marginTop: 8, marginBottom: 8 }}>
          <Text style={{ color: '#B91C1C', fontWeight: '700' }}>Account suspended</Text>
          <Text style={{ color: '#7F1D1D', marginTop: 4, fontSize: 12 }}>Editing listings is disabled until reactivation.</Text>
        </View>
      )}
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
          <Text style={styles.label}>Key Features (one per line)</Text>
          <TextInput
            value={keyFeaturesText}
            onChangeText={(v)=>{ setKeyFeaturesText(v); markDirty() }}
            style={[styles.input, styles.multilineInput]}
            placeholder='List important features, one per line (optional)'
            multiline
            numberOfLines={4}
            textAlignVertical='top'
            maxLength={2000}
          />
          <Text style={styles.charCount}>{description.length}/1000</Text>

          <Text style={styles.label}>Images (up to 5)</Text>
          <View>
            {images.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {images.map((url, idx) => (
                    <View key={url + idx} style={{ position: 'relative' }}>
                      <Image
                        source={{ uri: (resolvedImages?.[idx] || url) }}
                        style={{ width: 90, height: 90, borderRadius: 10 }}
                        resizeMode='cover'
                      />
                      <TouchableOpacity style={{ position: 'absolute', top: -6, right: -6, backgroundColor: '#0009', borderRadius: 12, padding: 4 }} onPress={() => removeImage(url, idx)}>
                        <Text style={{ color: '#fff', fontWeight: '700' }}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  {images.length < 5 && (
                    <TouchableOpacity style={[styles.addImage, { width: 90, height: 90, alignItems: 'center', justifyContent: 'center' }]} onPress={pickAndUploadImage} disabled={String(profile?.status||'').toLowerCase()==='suspended' || addingImage} activeOpacity={0.85}>
                      {addingImage ? <ActivityIndicator size='small' color={styles?.saveBtn?.backgroundColor || '#111827'} /> : (
                        <Text style={styles.addImageText}>+</Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </ScrollView>
            )}
            {images.length === 0 && (
              <TouchableOpacity style={[styles.addImage, { height: 120, alignItems: 'center', justifyContent: 'center' }]} onPress={pickAndUploadImage} disabled={String(profile?.status||'').toLowerCase()==='suspended' || addingImage} activeOpacity={0.85}>
                {addingImage ? <ActivityIndicator size='small' color={styles?.saveBtn?.backgroundColor || '#111827'} /> : (
                  <Text style={styles.addImageText}>+</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.imagesHint}>{images.length}/5 images</Text>

          <View style={styles.switchRow}>
            <Text style={styles.label}>Active</Text>
            <Switch value={active} onValueChange={(v)=>{ setActive(v); markDirty() }} />
          </View>

          <TouchableOpacity disabled={!canSave || String(profile?.status||'').toLowerCase()==='suspended'} onPress={save} style={[styles.saveBtn, (!canSave || String(profile?.status||'').toLowerCase()==='suspended') && { opacity:0.5 }]}>
            {saving ? <ActivityIndicator color={styles?.saveText?.color || '#fff'} /> : <Text style={styles.saveText}>Save Changes</Text>}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  )
}
