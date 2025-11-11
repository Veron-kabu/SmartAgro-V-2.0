import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@clerk/clerk-expo'
import { getJSON } from '../context/api'

// Lightweight in-memory cache to avoid re-resolving the same URL repeatedly during a session
const cache = new Map()

/**
 * Resolve a list of media URLs via the backend resolver which returns a signed URL when needed.
 * Works for S3 private buckets and is a no-op for public/non-S3 URLs.
 *
 * @param {string[]} urls Raw URLs (e.g., S3/CloudFront origins)
 * @returns {string[]} Resolved URLs (preserve input order)
 */
export function useResolvedUrls(urls) {
  // Normalize inputs (filter out falsy) and only depend on the provided prop
  const list = useMemo(() => (Array.isArray(urls) ? urls.filter(Boolean) : []), [urls])
  const [resolved, setResolved] = useState(list)
  const resolvedRef = useRef(resolved)
  const sigRef = useRef('')
  // Trigger re-resolution when auth becomes ready (prevents a first-run 401 from sticking)
  const { isLoaded, isSignedIn } = useAuth()

  const arraysEqual = (a, b) => {
    if (!Array.isArray(a) || !Array.isArray(b)) return false
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
  }

  // makeSig no longer used; listSig replaces it

  // Create stable effect keys that won't churn when callers pass new array identities with same contents
  const listSig = useMemo(() => {
    try { return JSON.stringify(list) } catch { return String(list?.length || 0) }
  }, [list])
  const authSig = isLoaded ? (isSignedIn ? 'auth:in' : 'auth:out') : 'auth:pending'

  useEffect(() => {
    let cancelled = false
    // Defer until Clerk auth state is known; avoids calling backend without token on first paint
    if (!isLoaded) {
      return () => { cancelled = true }
    }
    // Compose a signature purely from stable strings to avoid false-positive reruns
    const sig = `${listSig}|${authSig}`
    // If inputs haven't actually changed, skip work to avoid loops
    if (sigRef.current === sig) return () => { cancelled = true }
    // claim this signature for this run
    sigRef.current = sig

    // Recreate list from signature to keep effect dependency strictly on the signature
    let parsed
    try { parsed = JSON.parse(listSig) } catch { parsed = [] }

    if (parsed.length === 0) {
      if (resolvedRef.current.length !== 0) {
        resolvedRef.current = []
        setResolved([])
      }
      return () => { cancelled = true }
    }

    ;(async () => {
      // Capture signature for this run to avoid racing setState after deps change
      const runSig = sig
      const out = new Array(parsed.length)
      const tasks = parsed.map(async (u, idx) => {
        try {
          if (cache.has(u)) { out[idx] = cache.get(u); return }
          const q = encodeURIComponent(u)
          // Force=1 ensures we always get a valid URL for private objects; for public it simply echoes back
          const r = await getJSON(`/api/uploads/resolve-avatar-url?force=1&url=${q}`)
          const finalUrl = r?.url || u
          cache.set(u, finalUrl)
          out[idx] = finalUrl
        } catch {
          out[idx] = u
        }
      })
      await Promise.all(tasks)
      // Abort if inputs changed mid-flight or effect cleaned up
      if (cancelled || sigRef.current !== runSig) return
      try {
        if (!arraysEqual(resolvedRef.current, out)) {
          // Break potential render-cycle by scheduling state update on next tick
          const t = setTimeout(() => {
            if (cancelled || sigRef.current !== runSig) return
            try {
              resolvedRef.current = out
              setResolved(out)
            } catch (e) {
              console.warn('useResolvedUrls: scheduled setResolved failed', e)
            }
          }, 0)
          // ensure we clear the timeout if the effect is torn down early
          if (cancelled) clearTimeout(t)
        }
      } catch (e) {
        // Defensive: if anything throws during equality or scheduling, bail silently to avoid render loops
        console.warn('useResolvedUrls: prepare setResolved failed', e)
      }
    })()

    return () => { cancelled = true }
  }, [listSig, authSig, isLoaded])

  // Keep a ref in sync with the latest resolved array to avoid depending on it in the main effect
  useEffect(() => {
    resolvedRef.current = resolved
  }, [resolved])

  return resolved
}
