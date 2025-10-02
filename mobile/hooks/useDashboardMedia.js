import { useEffect, useState, useCallback, useRef } from 'react'
import { getJSON } from '../context/api'

export function useDashboardMedia(profile) {
  const [avatarUrl, setAvatarUrl] = useState(null)
  // Banner feature deferred – keep API surface but no functionality.
  const [bannerUrl] = useState(null)
  const [bannerResolving] = useState(false)
  const setBannerUrl = () => {}
  const storageModeRef = useRef(null)
  const storageCheckedRef = useRef(false)

  // One-time storage mode fetch to decide signing strategy (private buckets => always force sign first time)
  useEffect(() => {
    if (storageCheckedRef.current) return
    storageCheckedRef.current = true
    ;(async () => {
      try {
        const h = await getJSON('/api/uploads/storage-health')
        storageModeRef.current = h?.mode || null
      } catch { /* ignore */ }
    })()
  }, [])

  // Generic signed URL refresher
  const setupRefresh = useCallback((raw, setter) => {
    if (!raw) return () => {}
    let active = true
    let timer = null
    async function schedule() {
      if (!active) return
      try {
        const q = encodeURIComponent(raw)
        const resolved = await getJSON(`/api/uploads/resolve-avatar-url?url=${q}`)
        if (active) setter(resolved?.url || raw)
        const ttlSec = Number(resolved?.ttlSeconds)
        const ms = Number.isFinite(ttlSec) ? Math.max(10_000, Math.floor(ttlSec * 1000 * 0.8)) : 4 * 60 * 1000
        timer = setTimeout(schedule, ms)
      } catch {
        timer = setTimeout(schedule, 60 * 1000)
      }
    }
    schedule()
    return () => { active = false; if (timer) clearTimeout(timer) }
  }, [])

  // Avatar initial resolve & refresh
  useEffect(() => {
    (async () => {
      try {
        const raw = profile?.profileImageUrl || profile?.profile_image_url || null
        if (!raw) { setAvatarUrl(null); return }
        const q = encodeURIComponent(raw)
        const forceParam = storageModeRef.current === 's3-private' ? '&force=1' : ''
        let r = await getJSON(`/api/uploads/resolve-avatar-url?url=${q}${forceParam}`)
        if (r && r.url === raw && !/X-Amz-Signature/i.test(raw)) {
          // Possibly private object but server assumed public-read; force a signed URL.
          try { r = await getJSON(`/api/uploads/resolve-avatar-url?force=1&url=${q}`) } catch {}
        }
        setAvatarUrl(r?.url || raw)
      } catch {
        setAvatarUrl(profile?.profileImageUrl || profile?.profile_image_url || null)
      }
    })()
  }, [profile?.profileImageUrl, profile?.profile_image_url])

  useEffect(() => {
    return setupRefresh(profile?.profileImageUrl || profile?.profile_image_url, setAvatarUrl)
  }, [profile?.profileImageUrl, profile?.profile_image_url, setupRefresh])

  // (Banner resolve logic removed – deferred implementation)

  // Warn in development if placeholder CloudFront domain is present to explain 403/DNS errors
  useEffect(() => {
    const raw = profile?.profileImageUrl || profile?.profile_image_url
    if (!raw) return
    if (/your-cloudfront-domain/i.test(raw) && !global.__CF_PLACEHOLDER_WARNED__) {
      global.__CF_PLACEHOLDER_WARNED__ = true
      console.warn('[useDashboardMedia] Placeholder CloudFront domain detected in avatar URL. Banner feature disabled currently.')
    }
  }, [profile?.profileImageUrl, profile?.profile_image_url])

  return { avatarUrl, bannerUrl, bannerResolving, setBannerUrl, setAvatarUrl }
}
