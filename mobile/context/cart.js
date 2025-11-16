"use client"

import { createContext, useContext, useState, useEffect, useRef } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useProfile } from './profile'
import { getJSON, postJSON, patchJSON, deleteJSON } from './api'

const CartContext = createContext({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  updateItemPrice: () => {},
  updateItemFields: () => {},
  clearCart: () => {},
  getTotalPrice: () => 0,
  getTotalItems: () => 0,
})

export function CartProvider({ children }) {
  const [items, setItems] = useState([])
  const { profile } = useProfile()
  const storageKeyRef = useRef(null)
  const readyRef = useRef(false)
  const currentKey = profile?.id ? `cart:${profile.id}` : 'cart:guest'

  const loadCart = async (key) => {
    // Try server-backed cart first for authenticated users, fall back to AsyncStorage
    try {
      let serverItems = null
      try {
        serverItems = await getJSON('/api/cart')
      } catch (e) {
        // if 401 or network error, fall back to local cache
        serverItems = null
      }
      if (serverItems && Array.isArray(serverItems)) {
        // Map server shape to local item shape and include cart row id as _cartId
        const mapped = serverItems.map((r) => ({
          id: r.product?.id || r.productId,
          _cartId: r.id,
          quantity: r.quantity,
          price: r.product?.price ?? r.unitPrice ?? 0,
          title: r.product?.title || null,
          images: r.product?.images || [],
          productSnapshot: r.product || null,
          metadata: r.metadata || {},
        }))
        setItems(mapped)
        try { await AsyncStorage.setItem(key, JSON.stringify(mapped)) } catch {}
        return
      }

      const raw = await AsyncStorage.getItem(key)
      if (raw) setItems(JSON.parse(raw))
      else setItems([])
    } catch (error) {
      console.error('Error loading cart:', error)
      setItems([])
    }
  }

  // Load when user changes
  useEffect(() => {
    if (storageKeyRef.current === currentKey && readyRef.current) return
    (async () => {
      try {
        if (!readyRef.current) {
          const legacy = await AsyncStorage.getItem('cart')
          if (legacy) {
            const existing = await AsyncStorage.getItem(currentKey)
            if (!existing) await AsyncStorage.setItem(currentKey, legacy)
          }
        }
      } catch {}
      await loadCart(currentKey)
      storageKeyRef.current = currentKey
      readyRef.current = true
    })()
  }, [currentKey])

  // Persist changes
  useEffect(() => {
    if (!readyRef.current) return
    (async () => {
      try { await AsyncStorage.setItem(currentKey, JSON.stringify(items)) } catch (e) { console.error('Error saving cart:', e) }
    })()
  }, [items, currentKey])


  const addItem = async (product, quantity = 1) => {
    // Optimistic local update for snappy UI
    setItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.id === product.id)
      if (existingItem) return currentItems.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item))
      return [...currentItems, { ...product, quantity }]
    })

    // If server is available, persist there and then refresh canonical state
    try {
      await postJSON('/api/cart', { productId: product.id, quantity })
      // Refresh from server to get cart row ids and product snapshots
      await loadCart(currentKey)
    } catch (e) {
      // Ignore network errors — keep local state and let background sync retry
    }
  }

  const removeItem = async (productId) => {
    // Find any server cart id
    const existing = items.find(i => i.id === productId)
    if (existing?._cartId) {
      try {
        await deleteJSON(`/api/cart/${existing._cartId}`)
      } catch (e) {
        // ignore network errors; still update local state
      }
    }
    setItems((currentItems) => currentItems.filter((item) => item.id !== productId))
  }

  const updateQuantity = async (productId, quantity) => {
    if (quantity <= 0) {
      await removeItem(productId)
      return
    }
    // Optimistic update
    setItems((currentItems) => currentItems.map((item) => (item.id === productId ? { ...item, quantity } : item)))

    // Try to persist change server-side
    const existing = items.find(i => i.id === productId)
    try {
      if (existing?._cartId) {
        await patchJSON(`/api/cart/${existing._cartId}`, { quantity })
      } else {
        // No server row yet — create one
        await postJSON('/api/cart', { productId, quantity })
      }
      // Refresh canonical state
      await loadCart(currentKey)
    } catch (e) {
      // keep optimistic local state; background sync will reconcile
    }
  }

  const clearCart = () => {
    // Try to clear server items when possible
    (async () => {
      try {
        for (const it of items) {
          if (it?._cartId) {
            await deleteJSON(`/api/cart/${it._cartId}`)
          }
        }
      } catch (e) {
        // ignore
      }
      setItems([])
    })()
  }

  const updateItemPrice = (productId, newPrice) => {
    setItems((currentItems) => currentItems.map(i => i.id === productId ? { ...i, price: newPrice } : i))
  }

  // Generic updater to merge additional fields into an item (e.g., images)
  const updateItemFields = (productId, fields) => {
    if (!productId || !fields || typeof fields !== 'object') return
    setItems((currentItems) => currentItems.map(i => i.id === productId ? { ...i, ...fields } : i))
  }

  const getTotalPrice = () => {
    return items.reduce((total, item) => total + item.price * item.quantity, 0)
  }

  const getTotalItems = () => {
    return items.reduce((total, item) => total + item.quantity, 0)
  }

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        updateItemPrice,
        updateItemFields,
        clearCart,
        getTotalPrice,
        getTotalItems,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}
