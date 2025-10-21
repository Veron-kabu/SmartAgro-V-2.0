import React, { useEffect, useState, useMemo, useRef } from 'react'
import { View, Text, ActivityIndicator, ScrollView, TouchableOpacity, TextInput } from 'react-native'
import { Image as ExpoImage } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { getJSON, postJSON } from '../../context/api'
import SafeScreen from '../../components/SafeScreen'
import { useResolvedUrls } from '../../hooks/useResolvedUrls'
import { emit as emitEvent } from '../../utils/eventBus'
import ImageLightbox from '../../components/ImageLightbox'
import { useToast } from '../../context/toast'

export default function VerificationSubmission() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const toast = useToast()

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        let j = null
        try {
          j = await getJSON(`/api/admin/verifications/${id}`)
        } catch (e) {
          if (e?.status === 401) {
            // small retry after ensuring token getter refreshed
            await new Promise(r => setTimeout(r, 150))
            j = await getJSON(`/api/admin/verifications/${id}`)
          } else {
            throw e
          }
        }
        if (mounted) setData(j)
      } catch (_e) {
        setError('Failed to load submission')
      } finally {
        setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [id])

  // Resolve submission images in-order: handles both raw URLs and S3 uploadKeys from respond-more
  const [finalUrls, setFinalUrls] = useState([])
  const urlCacheRef = useRef(new Map()) // rawUrl -> resolvedUrl
  const keyCacheRef = useRef(new Map()) // uploadKey -> resolvedUrl
  // no resolving flag needed with progressive render
  useEffect(() => {
    let cancelled = false
    const imgs = Array.isArray(data?.images) ? data.images : []
    if (imgs.length === 0) { setFinalUrls([]); return }
    const out = new Array(imgs.length).fill(null)
    const tasks = imgs.map(async (p, idx) => {
      try {
        // Prefer resolving by uploadKey first (most reliable for private buckets)
        const key = p?.uploadKey || p?.key || null
        if (key) {
          if (keyCacheRef.current.has(key)) { out[idx] = keyCacheRef.current.get(key); return }
          const s = await getJSON(`/api/admin/verification-image-url?key=${encodeURIComponent(key)}`)
          const final = s?.url || null
          if (final) {
            keyCacheRef.current.set(key, final)
            out[idx] = final
            // incremental update for faster perception
            setFinalUrls(prev => {
              const arr = prev && prev.length === out.length ? [...prev] : new Array(out.length).fill(null)
              arr[idx] = final
              return arr
            })
            return
          }
        }
        // Fallback: resolve any provided raw/display URL via generic resolver
        const raw = p?.displayUrl || p?.url || null
        if (raw) {
          if (urlCacheRef.current.has(raw)) { out[idx] = urlCacheRef.current.get(raw); return }
          const q = encodeURIComponent(raw)
          const r = await getJSON(`/api/uploads/resolve-avatar-url?force=1&url=${q}`)
          const final = r?.url || raw
          urlCacheRef.current.set(raw, final)
          out[idx] = final
          setFinalUrls(prev => {
            const arr = prev && prev.length === out.length ? [...prev] : new Array(out.length).fill(null)
            arr[idx] = final
            return arr
          })
          return
        }
        out[idx] = null
      } catch {
        out[idx] = null
      }
    })
    Promise.all(tasks).then(() => { if (!cancelled) { setFinalUrls(curr => curr?.length ? curr : out) } })
    return () => { cancelled = true }
  }, [data?.images])
  const [bannerUrl] = useResolvedUrls(useMemo(() => data?.user?.banner_image_url ? [data.user.banner_image_url] : [], [data?.user?.banner_image_url]))
  const [profileUrl] = useResolvedUrls(useMemo(() => data?.user?.profile_image_url ? [data.user.profile_image_url] : [], [data?.user?.profile_image_url]))
  const [lightbox, setLightbox] = useState({ open: false, index: 0 })
  const [reviewerComment, setReviewerComment] = useState('')
  // Recheck removed

  const onApprove = async () => {
    try {
      await postJSON(`/api/admin/verifications/${id}/approve`, {})
      toast.show('Approved', { type: 'success' })
      // Broadcast update so list view can sync instantly
  emitEvent('verification:update', { id: Number(id), status: 'approved' })
      router.back()
    } catch { toast.show('Approve failed', { type: 'error' }) }
  }
  const onReject = async () => {
    try {
      await postJSON(`/api/admin/verifications/${id}/reject`, { reviewer_comment: reviewerComment || undefined })
      toast.show('Rejected', { type: 'success' })
  emitEvent('verification:update', { id: Number(id), status: 'rejected' })
      router.back()
    } catch { toast.show('Reject failed', { type: 'error' }) }
  }
  // onRecheck removed

  const onSuspendToggle = async () => {
    if (!data?.user?.id) return
    const currentlySuspended = data.user.status === 'suspended'
    try {
      const ep = currentlySuspended ? '/api/admin/users/'+data.user.id+'/unsuspend' : '/api/admin/users/'+data.user.id+'/suspend'
      const r = await postJSON(ep, {})
      setData(prev => prev ? { ...prev, user: { ...prev.user, status: r?.user?.status || (currentlySuspended ? 'active' : 'suspended') } } : prev)
      toast.show(currentlySuspended ? 'User unsuspended' : 'User suspended', { type: 'success' })
    } catch {
      toast.show('Action failed', { type: 'error' })
    }
  }
  const onBanUser = async () => {
    if (!data?.user?.id) return
    try { await postJSON(`/api/admin/users/${data.user.id}/ban`, {}); setData(prev => prev ? { ...prev, user: { ...prev.user, status: 'inactive' } } : prev); toast.show('User banned', { type: 'success' }) } catch { toast.show('Ban failed', { type: 'error' }) }
  }

  return (
    <SafeScreen>
      <ScrollView contentContainerStyle={{ padding: 16, backgroundColor: '#f3f4f6', flexGrow: 1 }}>
        <Text style={{ fontSize: 20, fontWeight: '800' }}>Verification Submission</Text>
        {loading ? (
          <View style={{ marginTop: 20 }}><ActivityIndicator /></View>
        ) : error ? (
          <Text style={{ color: '#dc2626', marginTop: 8 }}>{error}</Text>
        ) : (
          <View style={{ marginTop: 12, gap: 12 }}>
            {/* User card */}
            <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', overflow: 'hidden' }}>
              <View style={{ padding: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '800' }}>{data?.user?.email || `User #${data?.userId}`}</Text>
                <Text style={{ color: '#374151', marginTop: 4 }}>Username: {data?.user?.username || '—'}</Text>
                <Text style={{ color: '#374151', marginTop: 2 }}>Phone: {data?.user?.phone || '—'}</Text>
                <Text style={{ color: '#6b7280', marginTop: 2 }}>Role: {data?.user?.role} • Status: {data?.user?.status}</Text>
              </View>
              {(bannerUrl || profileUrl) && (
                <View style={{ padding: 16, paddingTop: 0 }}>
                  {bannerUrl && (
                    <ExpoImage
                      source={{ uri: bannerUrl }}
                      style={{ width: '100%', height: 120, borderRadius: 12, marginBottom: 12 }}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  )}
                  {profileUrl && (
                    <ExpoImage
                      source={{ uri: profileUrl }}
                      style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#e5e7eb' }}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  )}
                </View>
              )}
              <View style={{ flexDirection: 'row', gap: 8, padding: 16, paddingTop: 0 }}>
                <TouchableOpacity onPress={onSuspendToggle} style={{ backgroundColor: '#f59e0b', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 }}>
                  <Text style={{ color: '#fff', fontWeight: '800' }}>{data?.user?.status === 'suspended' ? 'Unsuspend' : 'Suspend'}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onBanUser} style={{ backgroundColor: '#dc2626', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 }}>
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Ban</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Submission details */}
            <View style={{ backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#e5e7eb', padding: 16 }}>
              <Text style={{ fontSize: 16, fontWeight: '800' }}>Submission #{data?.id}</Text>
              {/* code removed */}
              <Text style={{ color: '#6b7280' }}>Status: {data?.status}</Text>
                {/* Diagnostics: engines status */}
                {/* diagnostics removed */}
              {/* Summary badges */}
              {/* No automated badges */}
              <Text style={{ color: '#6b7280' }}>Created: {data?.createdAt ? new Date(data.createdAt).toLocaleString() : '—'}</Text>
              {/* Images grid: show either latest needs-correction image (if present) OR the full set */}
              {(() => {
                // Per-image targeting removed; render all images
                const imgsToRender = Array.isArray(data?.images) ? data.images.map((_, i)=>i) : []
                return (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    {imgsToRender.map((idx) => {
                      const p = data.images[idx]
                  // diagnostics removed
                  const src = finalUrls?.[idx] || p?.displayUrl || p?.url || null
                  const resolvedIdxList = (finalUrls || []).map((u, i) => (u ? i : null)).filter(i => i != null)
                  const viewerIndex = src && finalUrls?.[idx] ? resolvedIdxList.indexOf(idx) : -1
                  return (
                    <TouchableOpacity
                      key={idx}
                      activeOpacity={0.85}
                      onPress={async () => {
                        if (viewerIndex >= 0) {
                          setLightbox({ open: true, index: viewerIndex })
                          return
                        }
                        // Attempt on-demand resolve for this tile, then open if available
                        try {
                          let final = null
                          // Try key first
                          const key = p?.uploadKey || p?.key || null
                          if (key) {
                            const s = await getJSON(`/api/admin/verification-image-url?key=${encodeURIComponent(key)}`)
                            final = s?.url || null
                          }
                          if (!final) {
                            const raw = p?.displayUrl || p?.url || null
                            if (raw) {
                              const q = encodeURIComponent(raw)
                              const r = await getJSON(`/api/uploads/resolve-avatar-url?force=1&url=${q}`)
                              final = r?.url || raw
                            }
                          }
                          if (final) {
                            const newArr = (() => { const a = [...(finalUrls || [])]; a[idx] = final; return a })()
                            const resolvedIdxList2 = newArr.map((u, i) => (u ? i : null)).filter(i => i != null)
                            const ri2 = resolvedIdxList2.indexOf(idx)
                            setFinalUrls(newArr)
                            if (ri2 >= 0) setLightbox({ open: true, index: ri2 })
                          }
                        } catch {}
                      }}
                    >
                      <View style={{ position: 'relative' }}>
                        <ExpoImage
                          source={src ? { uri: src } : null}
                          style={{ width: 108, height: 108, borderRadius: 10, backgroundColor: '#e5e7eb' }}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          priority="high"
                          transition={0}
                        />
                        {/* tags removed */}
                      </View>
                    </TouchableOpacity>
                  )
                    })}
                  </View>
                )
              })()}
              {/* Metrics removed */}
            </View>

            {/* Actions */}
            <View style={{ gap: 8 }}>
              <Text style={{ fontWeight: '700', marginBottom: 4 }}>Reviewer comment (optional)</Text>
              <TextInput
                value={reviewerComment}
                onChangeText={setReviewerComment}
                placeholder="Reason for rejection or notes..."
                multiline
                style={{ backgroundColor: '#fff', borderColor: '#e5e7eb', borderWidth: 1, borderRadius: 10, padding: 10, minHeight: 60 }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
              <TouchableOpacity onPress={onApprove} style={{ backgroundColor: '#16a34a', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 }}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onReject} style={{ backgroundColor: '#dc2626', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12 }}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>Reject</Text>
              </TouchableOpacity>
              {/* Re-run checks removed */}
              <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: '#111827', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, marginLeft: 'auto' }}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>Back</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
      {/* Lightbox uses only resolved list with accurate index mapping */}
      {(() => {
        const imgs = (finalUrls || []).filter(Boolean)
        return (
          <ImageLightbox images={imgs} index={lightbox.index} visible={lightbox.open} onRequestClose={() => setLightbox({ open: false, index: 0 })} />
        )
      })()}
    </SafeScreen>
  )
}
