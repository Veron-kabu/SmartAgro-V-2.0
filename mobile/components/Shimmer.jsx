import React, { useEffect, useState } from 'react'
import { View, Animated, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

/**
 * Reusable Shimmer placeholder component.
 * Props:
 *  - style: style object(s) applied to outer container (width/height/radius)
 *  - colors: gradient color stops (default soft highlight)
 *  - duration: animation loop duration ms (default 1200)
 *  - widthFactor: internal gradient width percentage (default 60)
 */
export default function Shimmer({ style, colors = ['rgba(255,255,255,0)','rgba(255,255,255,0.55)','rgba(255,255,255,0)'], duration = 1200, widthFactor = 0.6 }) {
  const [anim] = useState(() => new Animated.Value(-1))

  useEffect(() => {
    let mounted = true
    const loop = () => {
      if (!mounted) return
      anim.setValue(-1)
      Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }).start(loop)
    }
    loop()
    return () => { mounted = false }
  }, [anim, duration])

  const translateX = anim.interpolate({ inputRange: [-1, 1], outputRange: [-150, 150] })

  return (
    <View style={[styles.base, style, { overflow: 'hidden' }]}> 
      <Animated.View style={{ position: 'absolute', top: 0, bottom: 0, width: `${widthFactor * 100}%`, transform: [{ translateX }] }}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  base: { backgroundColor: '#e5e7eb' },
})
