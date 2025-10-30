import { useEffect, useRef, useState } from 'react'
import { getJSON } from '../context/api'

export default function useAnomalies({ intervalMs = 15000, onNew } = {}) {
  const [items, setItems] = useState([])
  const [unread, setUnread] = useState(0)
  const sinceRef = useRef(0)
  const timerRef = useRef(null)

  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const res = await getJSON(`/api/analytics/anomalies?sinceId=${sinceRef.current}`)
        const arr = Array.isArray(res?.items) ? res.items : []
        if (!alive) return
        if (arr.length) {
          const maxId = Math.max(...arr.map(i => Number(i.id || 0)))
          if (Number.isFinite(maxId) && maxId > sinceRef.current) sinceRef.current = maxId
          setItems(prev => [...arr, ...prev].slice(0, 100))
          setUnread(prev => prev + arr.length)
          if (typeof onNew === 'function') {
            try {
              // Show up to 3 latest per tick
              arr.slice(0,3).forEach(item => onNew(item))
            } catch {}
          }
        }
      } catch {}
    }
    tick()
    timerRef.current = setInterval(tick, intervalMs)
    return () => { alive = false; if (timerRef.current) clearInterval(timerRef.current) }
  }, [intervalMs, onNew])

  const markRead = () => setUnread(0)

  return { items, unread, markRead }
}
