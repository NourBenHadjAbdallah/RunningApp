// screens/RoutePlannerScreen.tsx
//
// Changes from original:
//   • Imports heatmapService and HeatCell type
//   • Added showHeatmap, heatCells, heatmapLoading state
//   • handleToggleHeatmap — lazy-loads heatmap data on first toggle
//   • Passes heatmap props down to RouteMapView and TopBar
//   • Tracks latitudeDelta via onRegionChange for zoom-aware culling

import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Keyboard,
  Dimensions,
  Platform,
} from 'react-native'
import MapView, { MapPressEvent, Region } from 'react-native-maps'
import { FontAwesome5 } from '@expo/vector-icons'
import * as Location from 'expo-location'
import { router, useLocalSearchParams } from 'expo-router'
import { activityService } from '../services/activityService'
import { heatmapService, ActivityRoute } from '../services/heatMapService'
import { Colors } from '../constants/colors'

// ─── Components ───────────────────────────────────────────────────────────────
import { RouteMapView }       from '../components/RoutePlanner/RouteMapView'
import { TopBar }             from '../components/RoutePlanner/TopBar'
import { MapActionButtons }   from '../components/RoutePlanner/MapActionButtons'
import { RouteStatsRow }      from '../components/RoutePlanner/RouteStatsRow'
import { WaypointChips }      from '../components/RoutePlanner/WaypointChips'
import { RouteActionButtons } from '../components/RoutePlanner/RouteActionButtons'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LatLng {
  latitude: number
  longitude: number
}

// ─── OSRM snap-to-road ───────────────────────────────────────────────────────

const OSRM_BASE = 'https://router.project-osrm.org/route/v1/foot'

function decodePolyline6(encoded: string): LatLng[] {
  const coords: LatLng[] = []
  let index = 0, lat = 0, lng = 0

  while (index < encoded.length) {
    let b, shift = 0, result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lat += result & 1 ? ~(result >> 1) : result >> 1

    shift = 0; result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    lng += result & 1 ? ~(result >> 1) : result >> 1

    coords.push({ latitude: lat / 1e6, longitude: lng / 1e6 })
  }
  return coords
}

async function snapToRoad(
  waypoints: LatLng[],
): Promise<{ polyline: LatLng[]; distanceKm: number } | null> {
  if (waypoints.length < 2) return null

  const coords = waypoints.map((w) => `${w.longitude},${w.latitude}`).join(';')
  const url = `${OSRM_BASE}/${coords}?overview=full&geometries=polyline6`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 8000)

  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    if (!res.ok) return null
    const json = await res.json()
    if (json.code !== 'Ok' || !json.routes?.length) return null

    const route = json.routes[0]
    return {
      polyline: decodePolyline6(route.geometry),
      distanceKm: route.distance / 1000,
    }
  } catch (e: any) {
    clearTimeout(timer)
    return null
  }
}

// ─── Elevation from Open-Elevation ───────────────────────────────────────────

const ELEVATION_API = 'https://api.open-elevation.com/api/v1/lookup'
const MAX_ELEVATION_SAMPLES = 100

function samplePolyline(polyline: LatLng[], maxPoints: number): LatLng[] {
  if (polyline.length <= maxPoints) return polyline
  const step = polyline.length / maxPoints
  return Array.from({ length: maxPoints }, (_, i) => polyline[Math.floor(i * step)])
}

async function fetchElevationGain(polyline: LatLng[]): Promise<number> {
  const sampled = samplePolyline(polyline, MAX_ELEVATION_SAMPLES)
  const locations = sampled.map((p) => ({ latitude: p.latitude, longitude: p.longitude }))

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)

  try {
    const res = await fetch(ELEVATION_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locations }),
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) return 0
    const json = await res.json()
    const elevations: number[] = (json.results ?? []).map((r: any) => r.elevation as number)

    let gain = 0
    for (let i = 1; i < elevations.length; i++) {
      const diff = elevations[i] - elevations[i - 1]
      if (diff > 0) gain += diff
    }
    return Math.round(gain)
  } catch {
    clearTimeout(timer)
    return 0
  }
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────

function haversine(a: LatLng, b: LatLng): number {
  const R = 6371
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180
  const lat1 = (a.latitude * Math.PI) / 180
  const lat2 = (b.latitude * Math.PI) / 180
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

// ─── Constants ────────────────────────────────────────────────────────────────

const { height: SCREEN_H } = Dimensions.get('window')
const PANEL_H = SCREEN_H * 0.33
const SNAP_DEBOUNCE_MS = 600

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function RoutePlannerScreen() {
  const mapRef    = useRef<MapView>(null)
  const params    = useLocalSearchParams<{ loadRoute?: string; loadName?: string }>()
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [waypoints, setWaypoints] = useState<LatLng[]>(() => {
    if (params.loadRoute) {
      try { return JSON.parse(params.loadRoute) as LatLng[] } catch {}
    }
    return []
  })
  const [saving, setSaving]     = useState(false)
  const [locating, setLocating] = useState(false)
  const [tapMode, setTapMode]   = useState(true)

  // Snapped road route state
  const [routePolyline, setRoutePolyline] = useState<LatLng[]>([])
  const [snappedDist, setSnappedDist]     = useState(0)
  const [elevationGain, setElevationGain] = useState(0)
  const [isSnapping, setIsSnapping]       = useState(false)

  // ── Heatmap state ──────────────────────────────────────────────────────────
  const [showHeatmap, setShowHeatmap]       = useState(false)
  const [heatRoutes, setHeatRoutes]         = useState<ActivityRoute[]>([])
  const [heatmapLoading, setHeatmapLoading] = useState(false)
  const [latitudeDelta, setLatitudeDelta]   = useState(0.06)
  // Track whether we've loaded data at least once to avoid redundant fetches
  const heatmapLoaded = useRef(false)

  // Distance shown in the UI
  const displayDist = snappedDist > 0 ? snappedDist : (() => {
    let d = 0
    for (let i = 1; i < waypoints.length; i++) d += haversine(waypoints[i - 1], waypoints[i])
    return d
  })()

  // ── Snap to road whenever waypoints change ──────────────────────────────────

  useEffect(() => {
    if (snapTimer.current) clearTimeout(snapTimer.current)

    if (waypoints.length < 2) {
      setRoutePolyline([])
      setSnappedDist(0)
      setElevationGain(0)
      setIsSnapping(false)
      return
    }

    setIsSnapping(true)

    snapTimer.current = setTimeout(async () => {
      const result = await snapToRoad(waypoints)

      if (!result) {
        setRoutePolyline([])
        setSnappedDist(0)
        setElevationGain(0)
        setIsSnapping(false)
        return
      }

      setRoutePolyline(result.polyline)
      setSnappedDist(result.distanceKm)

      const gain = await fetchElevationGain(result.polyline)
      setElevationGain(gain)
      setIsSnapping(false)
    }, SNAP_DEBOUNCE_MS)

    return () => {
      if (snapTimer.current) clearTimeout(snapTimer.current)
    }
  }, [waypoints])

  // ── Heatmap toggle ─────────────────────────────────────────────────────────

  const handleToggleHeatmap = useCallback(async () => {
    // If turning off, just hide
    if (showHeatmap) {
      setShowHeatmap(false)
      return
    }

    // If we already have data, just show it
    if (heatmapLoaded.current && heatRoutes.length > 0) {
      setShowHeatmap(true)
      return
    }

    setHeatmapLoading(true)
    try {
      const { routes, totalActivities, bounds } = await heatmapService.getHeatmapData()

      if (routes.length === 0) {
        Alert.alert(
          'No heatmap data',
          totalActivities === 0
            ? "You haven't recorded any runs yet. Complete a run to see your heatmap!"
            : "Your runs don't have GPS route data saved.",
        )
        setHeatmapLoading(false)
        return
      }

      setHeatRoutes(routes)
      heatmapLoaded.current = true
      setShowHeatmap(true)

      // Optionally fly to the bounds of all the user's runs
      if (bounds && waypoints.length === 0) {
        mapRef.current?.fitToCoordinates(
          [
            { latitude: bounds.minLat, longitude: bounds.minLng },
            { latitude: bounds.maxLat, longitude: bounds.maxLng },
          ],
          {
            edgePadding: { top: 80, right: 40, bottom: PANEL_H + 40, left: 40 },
            animated: true,
          },
        )
      }
    } catch (e: any) {
      Alert.alert('Error', `Could not load heatmap: ${e.message}`)
    } finally {
      setHeatmapLoading(false)
    }
  }, [showHeatmap, heatRoutes, waypoints])

  // ── Region change — track zoom for HeatmapLayer culling ───────────────────

  const handleRegionChange = useCallback((region: Region) => {
    setLatitudeDelta(region.latitudeDelta)
  }, [])

  // ── Location ────────────────────────────────────────────────────────────────

  const goToMyLocation = async () => {
    setLocating(true)
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Location permission is required to centre the map on you.')
        return
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      mapRef.current?.animateToRegion({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      })
    } catch {
      Alert.alert('Error', 'Could not get your location.')
    }
    setLocating(false)
  }

  // ── Waypoint management ─────────────────────────────────────────────────────

  const handleMapPress = useCallback((e: MapPressEvent) => {
    if (!tapMode) return
    const coordinate = e.nativeEvent.coordinate
    Keyboard.dismiss()
    setWaypoints((prev) => [...prev, coordinate])
  }, [tapMode])

  const undoLast = () => setWaypoints((prev) => prev.slice(0, -1))

  const clearAll = () => {
    Alert.alert('Clear Route', 'Remove all waypoints?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => setWaypoints([]) },
    ])
  }

  const fitRoute = () => {
    const pts = routePolyline.length > 1 ? routePolyline : waypoints
    if (pts.length < 2) return
    mapRef.current?.fitToCoordinates(pts, {
      edgePadding: { top: 80, right: 40, bottom: PANEL_H + 40, left: 40 },
      animated: true,
    })
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  const handleStartRun = () => {
    if (waypoints.length < 2) {
      Alert.alert('No route', 'Add at least 2 waypoints to plan a route, or start without one.')
      return
    }
    const name = `${displayDist.toFixed(1)} km planned run`
    const routeData = routePolyline.length > 1 ? routePolyline : waypoints
    router.push({
      pathname: '/(tabs)/track',
      params: { plannedRoute: JSON.stringify(routeData), plannedName: name },
    })
  }

  const saveRoute = async (name?: string) => {
    if (waypoints.length < 2) {
      Alert.alert('No route', 'Add at least 2 waypoints before saving.')
      return
    }

    if (!name) {
      Alert.prompt(
        'Name this route',
        'Give your route a name',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: (input: string | undefined) =>
              saveRoute(input?.trim() || `${displayDist.toFixed(1)} km route`),
          },
        ],
        'plain-text',
        `${displayDist.toFixed(1)} km route`,
      )
      return
    }

    const routeData = routePolyline.length > 1 ? routePolyline : waypoints
    setSaving(true)
    try {
      await activityService.saveRoute(name, routeData, displayDist)
      Alert.alert('Saved! ✅', `"${name}" has been saved to your profile.`)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleStartFree = () => router.push('/(tabs)/track')

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Map */}
      <RouteMapView
        mapRef={mapRef}
        waypoints={waypoints}
        routePolyline={routePolyline}
        onPress={handleMapPress}
        heatRoutes={heatRoutes}
        showHeatmap={showHeatmap}
        onRegionChange={handleRegionChange}
      />

      {/* Top bar */}
      <TopBar
        tapMode={tapMode}
        onToggleTapMode={() => setTapMode((v) => !v)}
        showHeatmap={showHeatmap}
        onToggleHeatmap={handleToggleHeatmap}
        heatmapLoading={heatmapLoading}
      />

      {/* Map action buttons */}
      <MapActionButtons
        locating={locating}
        waypointCount={waypoints.length}
        onLocate={goToMyLocation}
        onFit={fitRoute}
        onUndo={undoLast}
        onDeleteAll={clearAll}
        onSave={saveRoute}
      />

      {/* Tap hint */}
      {tapMode && waypoints.length === 0 && (
        <View style={styles.tapHint}>
          <FontAwesome5 name="hand-point-up" size={13} color="#fff" />
          <Text style={styles.tapHintText}>Tap the map to add waypoints</Text>
        </View>
      )}

      {/* Snapping indicator */}
      {isSnapping && waypoints.length >= 2 && (
        <View style={styles.snapBadge}>
          <FontAwesome5 name="route" size={11} color={Colors.primary} />
          <Text style={styles.snapBadgeText}>Snapping to road…</Text>
        </View>
      )}



      {/* Bottom panel */}
      <View style={styles.panel}>
        <View style={styles.handle} />

        <RouteStatsRow
          dist={displayDist}
          waypointCount={waypoints.length}
          elevationGain={elevationGain}
          isSnapping={isSnapping}
        />

        <View style={styles.waypointsPanel}>
          <WaypointChips waypoints={waypoints} onClear={clearAll} />
        </View>

        <RouteActionButtons
          dist={displayDist}
          waypointCount={waypoints.length}
          onStartRun={handleStartRun}
        />
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

  tapHint: {
    position: 'absolute',
    bottom: PANEL_H + 12,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 24,
  },
  tapHintText: { color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '600' },

  snapBadge: {
    position: 'absolute',
    bottom: PANEL_H + 52,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1,
    borderColor: Colors.primary + '60',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  snapBadgeText: { color: Colors.primary, fontSize: 12, fontWeight: '600' },

panel: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: PANEL_H,
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
  },

  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 4,
  },

  waypointsPanel: { height: 38, justifyContent: 'center', marginBottom: 6 },
})