// components/RoutePlanner/RouteMapView.tsx
//
// Changes from original:
//   • Accepts `heatCells`, `showHeatmap`, and exposes `onRegionChange` so the
//     parent can pass the current latitudeDelta to HeatmapLayer for zoom-based
//     density culling.

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import MapView, { Polyline, Marker, MapPressEvent, Region } from 'react-native-maps'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { HeatmapLayer } from './HeatMapLayer'
import { ActivityRoute } from '../../services/heatMapService'

interface LatLng {
  latitude: number
  longitude: number
}

interface RouteMapViewProps {
  mapRef: React.RefObject<MapView | null>
  waypoints: LatLng[]
  /** The snapped polyline points returned from OSRM — drawn on the map */
  routePolyline: LatLng[]
  onPress: (e: MapPressEvent) => void

  // ── Heatmap props ──────────────────────────────────────────────────────────
  /** Route polylines produced by heatmapService.getHeatmapData() */
  heatRoutes?: ActivityRoute[]
  /** Whether to show the heatmap layer */
  showHeatmap?: boolean
  /** Called when the visible map region changes — passes latitudeDelta for culling */
  onRegionChange?: (region: Region) => void
}

const INITIAL_REGION: Region = {
  latitude: 36.8065,
  longitude: 10.1815,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
}

export function RouteMapView({
  mapRef,
  waypoints,
  routePolyline,
  onPress,
  heatRoutes = [],
  showHeatmap = false,
  onRegionChange,
}: RouteMapViewProps) {
  return (
    <MapView
      ref={mapRef}
      style={styles.map}
      onPress={onPress}
      initialRegion={INITIAL_REGION}
      onRegionChange={onRegionChange}
      showsUserLocation
      showsCompass={false}
    >
      {/* ── Heatmap layer (below route polyline + markers) ─────────────────── */}
      <HeatmapLayer
        routes={heatRoutes}
        visible={showHeatmap}
        latitudeDelta={INITIAL_REGION.latitudeDelta}
      />

      {/* Snapped road polyline */}
      {routePolyline.length > 1 && (
        <>
          {/* Shadow / casing */}
          <Polyline
            coordinates={routePolyline}
            strokeColor="rgba(0,0,0,0.25)"
            strokeWidth={10}
            lineCap="round"
            lineJoin="round"
          />
          {/* Main line */}
          <Polyline
            coordinates={routePolyline}
            strokeColor={Colors.primary}
            strokeWidth={6}
            lineCap="round"
            lineJoin="round"
          />
        </>
      )}

      {/* Fallback straight-line while snapping */}
      {routePolyline.length <= 1 && waypoints.length > 1 && (
        <Polyline
          coordinates={waypoints}
          strokeColor={Colors.primary + '60'}
          strokeWidth={3}
          lineDashPattern={[8, 6]}
          lineCap="round"
        />
      )}

      {/* Waypoint markers */}
      {waypoints.map((pt, i) => (
        <Marker
          key={i}
          coordinate={pt}
          anchor={{ x: 0.5, y: 0.5 }}
          zIndex={10}
        >
          <View style={[
            styles.waypointDot,
            i === 0 && styles.waypointStart,
            i === waypoints.length - 1 && i > 0 && styles.waypointEnd,
          ]}>
            {i === 0 ? (
              <FontAwesome5 name="play" size={8} color="#fff" />
            ) : i === waypoints.length - 1 ? (
              <FontAwesome5 name="flag-checkered" size={8} color="#fff" />
            ) : (
              <Text style={styles.waypointNum}>{i}</Text>
            )}
          </View>
        </Marker>
      ))}
    </MapView>
  )
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  waypointDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.textMuted,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#fff',
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  waypointStart: { backgroundColor: Colors.primary },
  waypointEnd:   { backgroundColor: Colors.danger },
  waypointNum:   { color: '#fff', fontSize: 10, fontWeight: '800' },
})