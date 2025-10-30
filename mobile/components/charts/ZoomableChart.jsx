import { View } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated'

export default function ZoomableChart({ width = 320, height = 120, minScale = 1, maxScale = 3, children }) {
  const scale = useSharedValue(1)

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      const next = Math.min(maxScale, Math.max(minScale, e.scale * scale.value))
      scale.value = next
    })
    .onEnd(() => {
      // Clamp smoothly back into range if overscrolled
      if (scale.value < minScale) scale.value = withTiming(minScale)
      if (scale.value > maxScale) scale.value = withTiming(maxScale)
    })

  const doubleTap = Gesture.Tap().numberOfTaps(2).onEnd(() => {
    scale.value = withTiming(1)
  })

  const composed = Gesture.Simultaneous(pinch, doubleTap)

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))

  return (
    <View style={{ width, height, overflow:'hidden', alignItems:'center', justifyContent:'center' }}>
      <GestureDetector gesture={composed}>
        <Animated.View style={style}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  )
}
