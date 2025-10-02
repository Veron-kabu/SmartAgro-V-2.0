"use client"

import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { getJSON, postJSON } from './api'

// Simple in-app event bus so other tabs can react without a full state library
const listeners = new Set()
export function emitAppEvent(type, payload) { listeners.forEach(l => { try { l({ type, payload }) } catch {} }) }
export function subscribeAppEvents(fn) { listeners.add(fn); return () => listeners.delete(fn) }

const FavoritesContext = createContext({
  favorites: [],
  loading: false,
  error: null,
  toggleFavorite: async (_id) => {},
  refreshFavorites: () => {},
  isFavorited: (_id) => false,
})

export function FavoritesProvider({ children }) {
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const initialized = useRef(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const data = await getJSON('/api/favorites')
      if (Array.isArray(data)) setFavorites(data)
    } catch (e) {
      setError(e?.message || 'Failed to load favorites')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (!initialized.current) { initialized.current = true; load() } }, [load])

  const toggleFavorite = useCallback(async (productId) => {
    try {
      const res = await postJSON(`/api/favorites/${productId}/toggle`, {})
      setFavorites(prev => {
        const isFav = prev.some(f => f.product?.id === productId)
        if (isFav && res?.favorited === false) {
          return prev.filter(f => f.product?.id !== productId)
        } else if (!isFav && res?.favorited) {
          return [{ id: res.id || Date.now(), createdAt: new Date().toISOString(), product: { id: productId }, farmer: null }, ...prev]
        }
        return prev
      })
      emitAppEvent('favorite:changed', { productId, favorited: res?.favorited })
      return res?.favorited
    } catch (e) {
      throw e
    }
  }, [])

  const refreshFavorites = useCallback(() => load(), [load])
  const isFavorited = useCallback((productId) => favorites.some(f => f.product?.id === productId), [favorites])

  // React to global events that may require refetch (product hard-deleted)
  useEffect(() => subscribeAppEvents(evt => {
    if (evt.type === 'product:deleted') {
      setFavorites(prev => prev.filter(f => f.product?.id !== evt.payload.productId))
    }
  }), [])

  return (
    <FavoritesContext.Provider value={{ favorites, loading, error, toggleFavorite, refreshFavorites, isFavorited }}>
      {children}
    </FavoritesContext.Provider>
  )
}

export function useFavorites() { return useContext(FavoritesContext) }
