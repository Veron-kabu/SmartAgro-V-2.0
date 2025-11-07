import React, { useMemo, useRef, useEffect } from 'react'
import { View } from 'react-native'
import { WebView } from 'react-native-webview'

// Minimal Leaflet map inside a WebView using OSM tiles.
// Props:
// - latitude, longitude: initial center
// - onChange(lat, lng): called when user taps map to move marker
// - zoom: initial zoom (default 12)
export default function LeafletMap({ latitude = -1.286389, longitude = 36.817223, zoom = 12, onChange }) {
  const webRef = useRef(null)

  const html = useMemo(() => `
    <!doctype html>
    <html>
      <head>
        <meta name="viewport" content="initial-scale=1, maximum-scale=1" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
        <style> html, body, #map { height: 100%; margin: 0; padding: 0; } .leaflet-control-container { z-index: 500; } </style>
      </head>
      <body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          const center = [${latitude}, ${longitude}]
          const map = L.map('map').setView(center, ${zoom})
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
          }).addTo(map)
          let marker = L.marker(center, { draggable: false }).addTo(map)

          function send(lat, lng) {
            const msg = JSON.stringify({ type: 'change', lat, lng })
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(msg)
          }

          map.on('click', function(e) {
            const { lat, lng } = e.latlng
            marker.setLatLng([lat,lng])
            send(lat, lng)
          })

          // Accept external commands
          document.addEventListener('message', (ev) => {
            try {
              const data = JSON.parse(ev.data)
              if (data.type === 'set') {
                const { lat, lng, zoom } = data
                if (typeof lat === 'number' && typeof lng === 'number') {
                  marker.setLatLng([lat,lng])
                  map.setView([lat,lng], zoom || map.getZoom())
                }
              }
            } catch {}
          })
        </script>
      </body>
    </html>
  `, [latitude, longitude, zoom])

  const onMessage = (e) => {
    try {
      const data = JSON.parse(e.nativeEvent.data)
      if (data?.type === 'change' && typeof onChange === 'function') {
        onChange({ latitude: data.lat, longitude: data.lng })
      }
    } catch {}
  }

  useEffect(() => {
    // keep marker in sync when props change significantly
    if (webRef.current) {
      const payload = JSON.stringify({ type: 'set', lat: latitude, lng: longitude, zoom })
      webRef.current.postMessage(payload)
    }
  }, [latitude, longitude, zoom])

  return (
    <View style={{ flex: 1, borderRadius: 8, overflow: 'hidden' }}>
      <WebView ref={webRef} originWhitelist={["*"]} source={{ html }} onMessage={onMessage} />
    </View>
  )
}
