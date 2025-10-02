import { useEffect, useState } from 'react'
import { getJSON } from '../context/api'

export function useDashboardStats(enabled = true, intervalMs = 60000) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) return
    let active = true
    let timer = null
    async function load() {
      if (!active) return
      try {
        setLoading(true)
        const s = await getJSON('/api/stats/overview')
        if (active) setStats(s)
      } catch {
        // ignore
      } finally {
        setLoading(false)
        if (active) timer = setTimeout(load, intervalMs)
      }
    }
    load()
    return () => { active = false; if (timer) clearTimeout(timer) }
  }, [enabled, intervalMs])

  return { stats, loading }
}
