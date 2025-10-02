"use client"

import { createContext, useContext, useState, useEffect, useRef } from "react"
import AsyncStorage from "@react-native-async-storage/async-storage"
import { useProfile } from './profile'

const CartContext = createContext({
  items: [],
  addItem: () => {},
  removeItem: () => {},
  updateQuantity: () => {},
  updateItemPrice: () => {},
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
    try {
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


  const addItem = (product, quantity = 1) => {
    setItems((currentItems) => {
      const existingItem = currentItems.find((item) => item.id === product.id)

      if (existingItem) {
        return currentItems.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item,
        )
      } else {
        return [...currentItems, { ...product, quantity }]
      }
    })
  }

  const removeItem = (productId) => {
    setItems((currentItems) => currentItems.filter((item) => item.id !== productId))
  }

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      removeItem(productId)
      return
    }

    setItems((currentItems) => currentItems.map((item) => (item.id === productId ? { ...item, quantity } : item)))
  }

  const clearCart = () => {
    setItems([])
  }

  const updateItemPrice = (productId, newPrice) => {
    setItems((currentItems) => currentItems.map(i => i.id === productId ? { ...i, price: newPrice } : i))
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
