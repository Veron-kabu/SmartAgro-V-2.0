import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'

const ToastContext = createContext({ show: (msg, opts) => {} })

export function ToastProvider({ children }) {
  const [queue, setQueue] = useState([])
  const anim = useRef(new Animated.Value(0)).current
  const current = queue[0] || null

  const process = useCallback(() => {
    if (!current) return
    Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.delay(current.duration || 2500),
      Animated.timing(anim, { toValue: 0, duration: 180, easing: Easing.in(Easing.ease), useNativeDriver: true }),
    ]).start(() => {
      setQueue(q => q.slice(1))
    })
  }, [anim, current])

  React.useEffect(() => { if (current) process() }, [current, process])

  const show = useCallback((message, opts = {}) => {
    setQueue(q => [...q, { id: Date.now() + Math.random(), message, type: opts.type || 'info', duration: opts.duration }])
  }, [])

  const value = React.useMemo(() => ({ show }), [show])
  const translateY = anim.interpolate({ inputRange: [0,1], outputRange: [40,0] })
  const opacity = anim

  return (
    <ToastContext.Provider value={value}>
      {children}
      {current && (
        <Animated.View style={[styles.toastContainer, { opacity, transform: [{ translateY }] }] } pointerEvents="none">
          <View style={[styles.toast, current.type === 'error' && styles.toastError, current.type === 'success' && styles.toastSuccess]}>
            <Text style={styles.toastText}>{current.message}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() { return useContext(ToastContext) }

const styles = StyleSheet.create({
  toastContainer: { position: 'absolute', bottom: 48, left: 0, right: 0, alignItems: 'center', paddingHorizontal: 24 },
  toast: { backgroundColor: 'rgba(31,41,55,0.95)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, maxWidth: '90%' },
  toastText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  toastError: { backgroundColor: '#b91c1c' },
  toastSuccess: { backgroundColor: '#15803d' },
})
