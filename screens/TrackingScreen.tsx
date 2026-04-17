import React, { useRef, useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, Modal, Alert, ActivityIndicator,
} from 'react-native'
import MapView, { Polyline, Marker, PROVIDER_GOOGLE } from 'react-native-maps'
import { FontAwesome5 } from '@expo/vector-icons'
import { useGPSTracking } from '../hooks/useGPSTracking'
import { activityService } from '../services/activityService'
import { formatTime, formatPace } from '../utils/calculations'
import { Colors } from '../constants/colors'
import { router } from 'expo-router'

const DEFAULT_REGION = {
  latitude: 36.8065,
  longitude: 10.1815,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
}

const DARK_MAP_STYLE: any[] = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d2d44' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c58' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1f2933' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1a2e1a' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#2f3948' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
]

export default function TrackingScreen() {
  const mapRef = useRef<MapView>(null)
  const [saveModal, setSaveModal] = useState(false)
  const [activityTitle, setActivityTitle] = useState('')
  const [saving, setSaving] = useState(false)

  const {
    isTracking, isPaused,
    route, distance, duration,
    pace, calories, currentLocation,
    startTracking, pauseTracking, resumeTracking,
    stopTracking, resetTracking,
  } = useGPSTracking()

  const handleStop = () => {
    stopTracking()
    if (distance > 0.05) {
      setSaveModal(true)
    } else {
      Alert.alert('Too short', 'Run a little more before saving!')
      resetTracking()
    }
  }

  const saveActivity = async () => {
    setSaving(true)
    try {
      const data = {
        title: activityTitle.trim() || 'Morning Run',
        distance,
        duration,
        pace,
        calories,
        route,
      }

      await activityService.saveActivity(data)
      
      const activities = await activityService.getMyActivities()
      const latest = activities[0]

      setSaveModal(false)
      setActivityTitle('')

      Alert.alert('Saved!', 'Your run has been saved.', [
        { 
          text: 'View', 
          onPress: () => {
            if (latest?.id) {
              router.push({ pathname: '/(tabs)/activity', params: { id: latest.id } })
            }
          } 
        },
        { text: 'Close', onPress: () => resetTracking() }
      ])
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    Alert.alert('Discard?', 'This will delete current run data.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { setSaveModal(false); resetTracking(); } }
    ])
  }

  const mapRegion = currentLocation ? {
    latitude: currentLocation.latitude,
    longitude: currentLocation.longitude,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  } : DEFAULT_REGION

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        customMapStyle={DARK_MAP_STYLE}
        showsUserLocation
        followsUserLocation={isTracking && !isPaused}
        region={currentLocation ? mapRegion : undefined}
      >
        {route.length > 1 && <Polyline coordinates={route} strokeColor={Colors.primary} strokeWidth={5} />}
      </MapView>

      {isTracking && (
        <View style={styles.badge}>
          <View style={[styles.badgeDot, isPaused && styles.badgeDotPaused]} />
          <Text style={styles.badgeText}>{isPaused ? 'PAUSED' : 'TRACKING'}</Text>
        </View>
      )}

      <View style={styles.panel}>
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{distance.toFixed(2)}</Text>
            <Text style={styles.statLabel}>KM</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{formatTime(duration)}</Text>
            <Text style={styles.statLabel}>TIME</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{formatPace(pace)}</Text>
            <Text style={styles.statLabel}>PACE</Text>
          </View>
        </View>

        {!isTracking ? (
          <TouchableOpacity style={styles.startBtn} onPress={startTracking}>
            <Text style={styles.btnText}>Start Run</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.activeRow}>
            <TouchableOpacity 
                style={isPaused ? styles.resumeBtn : styles.pauseBtn} 
                onPress={isPaused ? resumeTracking : pauseTracking}
            >
              <Text style={styles.btnText}>{isPaused ? 'Resume' : 'Pause'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
              <FontAwesome5 name="stop" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Modal visible={saveModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Save your run</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Activity name"
              placeholderTextColor={Colors.textDim}
              value={activityTitle}
              onChangeText={setActivityTitle}
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveActivity}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save Activity</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDiscard}><Text style={styles.discardText}>Discard</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  map: { flex: 1 },
  badge: { position: 'absolute', top: 50, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)', padding: 10, borderRadius: 20 },
  badgeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.danger, marginRight: 8 },
  badgeDotPaused: { backgroundColor: '#f59e0b' },
  badgeText: { color: '#fff', fontWeight: 'bold' },
  panel: { backgroundColor: Colors.card, padding: 20, borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  statBox: { alignItems: 'center', flex: 1 },
  statValue: { color: Colors.text, fontSize: 20, fontWeight: 'bold' },
  statLabel: { color: Colors.textMuted, fontSize: 12 },
  startBtn: { backgroundColor: Colors.primary, padding: 18, borderRadius: 50, alignItems: 'center' },
  activeRow: { flexDirection: 'row', gap: 10 },
  pauseBtn: { flex: 1, backgroundColor: Colors.card2, padding: 18, borderRadius: 50, alignItems: 'center', borderWidth: 1, borderColor: Colors.primary },
  resumeBtn: { flex: 1, backgroundColor: Colors.primary, padding: 18, borderRadius: 50, alignItems: 'center' },
  stopBtn: { backgroundColor: Colors.danger, width: 60, height: 60, borderRadius: 30, justifyContent: 'center', alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: Colors.card, padding: 30, borderTopLeftRadius: 25, borderTopRightRadius: 25 },
  modalTitle: { color: Colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 20 },
  modalInput: { backgroundColor: Colors.card2, color: Colors.text, padding: 15, borderRadius: 10, marginBottom: 20 },
  saveBtn: { backgroundColor: Colors.primary, padding: 18, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  discardText: { color: Colors.textMuted, textAlign: 'center' }
})