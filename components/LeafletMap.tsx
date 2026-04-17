import React, { useRef } from 'react'
import { StyleSheet } from 'react-native'
import WebView from 'react-native-webview'

interface Coordinate {
  latitude: number
  longitude: number
}

interface LeafletMapProps {
  route: Coordinate[]
  currentLocation: Coordinate | null
  isTracking: boolean
  strokeColor?: string
}

export default function LeafletMap({
  route,
  currentLocation,
  isTracking,
  strokeColor = '#FC4C02',
}: LeafletMapProps) {
  const webviewRef = useRef<WebView>(null)

  // Send updated data to the map whenever props change
  const updateMap = () => {
    const msg = JSON.stringify({ route, currentLocation, isTracking })
    webviewRef.current?.injectJavaScript(`
      window.updateMap && window.updateMap(${msg});
      true;
    `)
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; background: #0f0f0f; }
    .leaflet-tile-pane { filter: brightness(0.85) saturate(1.1); }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const STROKE = '${strokeColor}';
    const DEFAULT = [36.8065, 10.1815];

    const map = L.map('map', {
      zoomControl: false,
      attributionControl: false,
    }).setView(DEFAULT, 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    let polyline = L.polyline([], { color: STROKE, weight: 5, opacity: 0.9 }).addTo(map);
    let startMarker = null;
    let currentMarker = null;

    const startIcon = L.divIcon({
      html: '<div style="width:14px;height:14px;border-radius:50%;background:#22c55e;border:3px solid #fff;box-shadow:0 0 6px rgba(0,0,0,0.5)"></div>',
      className: '', iconAnchor: [7, 7],
    });

    const currentIcon = L.divIcon({
      html: '<div style="width:16px;height:16px;border-radius:50%;background:${strokeColor};border:3px solid #fff;box-shadow:0 0 8px rgba(252,76,2,0.6)"></div>',
      className: '', iconAnchor: [8, 8],
    });

    window.updateMap = function({ route, currentLocation, isTracking }) {
      // Update polyline
      const latlngs = route.map(c => [c.latitude, c.longitude]);
      polyline.setLatLngs(latlngs);

      // Start marker
      if (route.length > 0) {
        if (!startMarker) {
          startMarker = L.marker([route[0].latitude, route[0].longitude], { icon: startIcon }).addTo(map);
        }
      } else {
        startMarker && map.removeLayer(startMarker);
        startMarker = null;
      }

      // Current location marker
      if (currentLocation) {
        const ll = [currentLocation.latitude, currentLocation.longitude];
        if (!currentMarker) {
          currentMarker = L.marker(ll, { icon: currentIcon }).addTo(map);
        } else {
          currentMarker.setLatLng(ll);
        }
        // Pan to current location while tracking
        if (isTracking) map.panTo(ll, { animate: true, duration: 0.8 });
      }
    };
  </script>
</body>
</html>
`

  return (
    <WebView
      ref={webviewRef}
      style={styles.map}
      source={{ html }}
      onLoad={updateMap}
      onLoadEnd={updateMap}
      scrollEnabled={false}
      bounces={false}
      javaScriptEnabled
      domStorageEnabled
    />
  )
}

const styles = StyleSheet.create({
  map: { flex: 1 },
})