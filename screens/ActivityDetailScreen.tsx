// screens/ActivityDetailScreen.tsx
import React, { useEffect, useState, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native'
import MapView, { Polyline, Marker } from 'react-native-maps'
import { FontAwesome5 } from '@expo/vector-icons'
import { useLocalSearchParams, router } from 'expo-router'
import { activityService, Activity } from '../services/activityService'
import { formatTime, formatPace, formatDate } from '../utils/calculations'
import { Colors } from '../constants/colors'

function getBoundingRegion(coords: { latitude: number; longitude: number }[]) {
  if (coords.length === 0) return null

  const lats = coords.map((c) => c.latitude)
  const lngs = coords.map((c) => c.longitude)

  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)

  const latDelta = Math.max((maxLat - minLat) * 1.4, 0.008)
  const lngDelta = Math.max((maxLng - minLng) * 1.4, 0.008)

  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  }
}

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [activity, setActivity] = useState<Activity | null>(null)
  const [loading, setLoading] = useState(true)
  const mapRef = useRef<MapView>(null)

  useEffect(() => {
    if (id) loadActivity()
  }, [id])

  useEffect(() => {
    if (!activity || !mapRef.current) return
    const coords = activity.route ?? []
    if (coords.length > 1) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
          animated: true,
        })
      }, 400)
    }
  }, [activity])

  const loadActivity = async () => {
    setLoading(true)
    try {
      const activities = await activityService.getMyActivities()
      const found = activities.find((a: Activity) => a.id === id)
      setActivity(found || null)
    } catch (e) {
      console.error(e)
      Alert.alert('Error', 'Failed to load activity')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = () => {
    Alert.alert('Delete Activity', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Deleted', 'Activity has been removed.')
          router.replace('/(tabs)')
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  if (!activity) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Activity not found</Text>
      </View>
    )
  }

  const routeCoords = activity.route ?? []
  const mapRegion = getBoundingRegion(routeCoords) ?? {
    latitude: 36.8065,
    longitude: 10.1815,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          region={mapRegion}
          scrollEnabled={false}
          zoomEnabled={false}
          rotateEnabled={false}
          pitchEnabled={false}
        >
          {routeCoords.length > 1 && (
            <Polyline
              coordinates={routeCoords}
              strokeColor={Colors.primary}
              strokeWidth={7}
              lineCap="round"
              lineJoin="round"
            />
          )}
          {routeCoords.length > 0 && (
            <Marker coordinate={routeCoords[0]} title="Start">
              <View style={styles.startMarker} />
            </Marker>
          )}
          {routeCoords.length > 1 && (
            <Marker coordinate={routeCoords[routeCoords.length - 1]} title="Finish">
              <View style={styles.finishMarker} />
            </Marker>
          )}
        </MapView>

        {/* Back button overlaid on map */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.replace('/(tabs)')}>
          <FontAwesome5 name="chevron-left" size={16} color="#fff" />
        </TouchableOpacity>

        <View style={styles.mapOverlay}>
          <Text style={styles.distanceBig}>{activity.distance.toFixed(2)}</Text>
          <Text style={styles.distanceUnit}>km</Text>
        </View>
      </View>

      <View style={styles.infoHeader}>
        <Text style={styles.activityTitle}>{activity.title}</Text>
        <Text style={styles.activityDate}>{formatDate(activity.started_at)}</Text>
      </View>

      <View style={styles.statsCard}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatTime(activity.duration)}</Text>
          <Text style={styles.statLabel}>TIME</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{formatPace(activity.pace)}</Text>
          <Text style={styles.statLabel}>PACE</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{activity.calories}</Text>
          <Text style={styles.statLabel}>KCAL</Text>
        </View>
      </View>

      <View style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <FontAwesome5 name="route" size={18} color={Colors.textMuted} />
          <Text style={styles.detailText}>Distance: {activity.distance.toFixed(2)} km</Text>
        </View>
        <View style={styles.detailRow}>
          <FontAwesome5 name="clock" size={18} color={Colors.textMuted} />
          <Text style={styles.detailText}>Duration: {formatTime(activity.duration)}</Text>
        </View>
        <View style={styles.detailRow}>
          <FontAwesome5 name="tachometer-alt" size={18} color={Colors.textMuted} />
          <Text style={styles.detailText}>Pace: {formatPace(activity.pace)} /km</Text>
        </View>
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.shareButton}>
          <FontAwesome5 name="share-alt" size={18} color={Colors.primary} />
          <Text style={styles.shareButtonText}>Share Activity</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <FontAwesome5 name="trash-alt" size={18} color={Colors.danger} />
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  mapContainer: { height: 340, position: 'relative' },
  map: { flex: 1 },

  backBtn: {
    position: 'absolute',
    top: 52,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  mapOverlay: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  distanceBig: { fontSize: 48, fontWeight: '800', color: '#fff' },
  distanceUnit: { fontSize: 20, color: '#fff', marginLeft: 6 },

  infoHeader: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16 },
  activityTitle: { fontSize: 24, fontWeight: '700', color: Colors.text },
  activityDate: { fontSize: 15, color: Colors.textMuted, marginTop: 4 },

  statsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    borderRadius: 18,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 26, fontWeight: '700', color: Colors.primary },
  statLabel: { fontSize: 12, color: Colors.textMuted, marginTop: 6, letterSpacing: 0.5 },

  divider: { width: 1, height: 50, backgroundColor: Colors.border },

  detailsCard: {
    backgroundColor: Colors.card,
    margin: 16,
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
  },
  detailText: { color: Colors.text, fontSize: 16 },

  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  shareButton: {
    flex: 1,
    backgroundColor: Colors.card,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  shareButtonText: { color: Colors.primary, fontWeight: '600', fontSize: 16 },

  deleteButton: {
    flex: 1,
    backgroundColor: Colors.card,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: Colors.danger,
  },
  deleteButtonText: { color: Colors.danger, fontWeight: '600', fontSize: 16 },

  startMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.success,
    borderWidth: 3,
    borderColor: '#fff',
  },
  finishMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.danger,
    borderWidth: 3,
    borderColor: '#fff',
  },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  errorText: { color: Colors.textMuted, fontSize: 17 },
})