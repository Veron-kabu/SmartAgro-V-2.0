import React, { useMemo } from 'react'
import { Modal, View, Text, TouchableOpacity } from 'react-native'

// Lightweight wrapper. Tries to use react-native-image-viewing for pinch-zoom. Falls back to simple modal if unavailable.
export default function ImageLightbox({ images = [], index = 0, visible, onRequestClose }) {
  const data = useMemo(() => images.filter(Boolean).map((uri) => ({ uri })), [images])
  let Viewer = null
  try { Viewer = require('react-native-image-viewing').default } catch {}

  if (Viewer) {
    return (
      <Viewer
        images={data}
        imageIndex={index}
        visible={!!visible}
        onRequestClose={onRequestClose}
        backgroundColor="rgba(0,0,0,0.95)"
      />
    )
  }

  // Fallback: simple modal with a message (no pinch-zoom). Encourages installing the library.
  return (
    <Modal visible={!!visible} transparent animationType="fade" onRequestClose={onRequestClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <Text style={{ color: '#fff', marginBottom: 16, textAlign: 'center' }}>Install react-native-image-viewing to enable zoomable preview.</Text>
        <TouchableOpacity onPress={onRequestClose} style={{ backgroundColor: '#111827', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}
