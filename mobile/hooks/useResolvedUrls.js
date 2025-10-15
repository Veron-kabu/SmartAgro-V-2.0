import { useEffect, useMemo, useRef, useState } from 'react'
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

  const arraysEqual = (a, b) => {
    if (!Array.isArray(a) || !Array.isArray(b)) return false
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
    return true
  }

  const makeSig = (arr) => {
    try { return JSON.stringify(arr) } catch { return String(arr?.length || 0) }
  }

  useEffect(() => {
    let cancelled = false
    const sig = makeSig(list)
    // If inputs haven't actually changed, skip work to avoid loops
    if (sigRef.current === sig) return () => { cancelled = true }
    sigRef.current = sig

    if (list.length === 0) {
      if (resolvedRef.current.length !== 0) {
        resolvedRef.current = []
        setResolved([])
      }
      return () => { cancelled = true }
    }

    ;(async () => {
      const out = new Array(list.length)
      const tasks = list.map(async (u, idx) => {
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
      if (!cancelled && !arraysEqual(resolvedRef.current, out)) {
        resolvedRef.current = out
        setResolved(out)
      }
    })()

    return () => { cancelled = true }
  }, [list])

  // Keep a ref in sync with the latest resolved array to avoid depending on it in the main effect
  useEffect(() => {
    resolvedRef.current = resolved
  }, [resolved])

  return resolved
}
