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
  toggleFavorite: async (_id, _snapshot) => {},
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

  const toggleFavorite = useCallback(async (productId, snapshot) => {
    // Optimistic update for snappy UI
    const optimistic = (prev) => {
      const isFav = prev.some(f => f.product?.id === productId)
      if (isFav) {
        // remove optimistically
        return prev.filter(f => f.product?.id !== productId)
      } else {
        // add optimistically with snapshot if provided
        const productObj = snapshot ? { ...snapshot, id: productId } : { id: productId }
        return [{ id: Date.now(), createdAt: new Date().toISOString(), product: productObj, farmer: null }, ...prev]
      }
    }

    // Apply optimistic change immediately
    setFavorites(optimistic)
    // Notify screens with snapshot to avoid skeletons
    try { emitAppEvent('favorite:changed', { productId, favorited: !favorites.some(f => f.product?.id === productId), snapshot }) } catch {}

    try {
      const res = await postJSON(`/api/favorites/${productId}/toggle`, {})
      // Reconcile with server answer
      setFavorites(prev => {
        const isFavNow = prev.some(f => f.product?.id === productId)
        if (res?.favorited) {
          if (isFavNow) return prev
          const productObj = snapshot ? { ...snapshot, id: productId } : { id: productId }
          return [{ id: res.id || Date.now(), createdAt: new Date().toISOString(), product: productObj, farmer: null }, ...prev]
        } else {
          if (!isFavNow) return prev
          return prev.filter(f => f.product?.id !== productId)
        }
      })
      emitAppEvent('favorite:changed', { productId, favorited: res?.favorited, snapshot })
      return !!res?.favorited
    } catch (e) {
      // Revert optimistic change on error
      setFavorites(prev => optimistic(prev))
      emitAppEvent('favorite:changed', { productId, favorited: favorites.some(f => f.product?.id === productId), snapshot })
      throw e
    }
  }, [favorites])

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
