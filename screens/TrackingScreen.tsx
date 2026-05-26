// screens/TrackingScreen.tsx

import React, { useRef, useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  TextInput, Modal, Alert, ActivityIndicator,
  ScrollView, Dimensions, AppState, AppStateStatus,
  FlatList, Platform,
} from 'react-native'
import MapView from 'react-native-maps'
import { FontAwesome5 } from '@expo/vector-icons'
import * as MediaLibrary from 'expo-media-library'
import * as Sharing from 'expo-sharing'
import { router, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { useGPSTracking } from '../hooks/useGPSTracking'
import { useBattleZone } from '../hooks/useBattleZone'
import { activityService } from '../services/activityService'
import { flushQueue } from '../utils/offlineQueue'
import { supabase } from '../services/supabase'
import { Colors } from '../constants/colors'
import TrackingMap from '../components/Tracking/TrackingMap'
import StatsPanel from '../components/Tracking/StatsPanel'
import BattleZoneHUD from '../components/Tracking/BattleZoneHUD'
import RunShareCard, { RunShareCardHandle } from '../components/RunShareCard'
import type { ActivityType } from '../components/Tracking/ActivityTypePicker'
import type { SavedRoute, RunSnapshot } from '../components/Tracking/tracking'

const { width: SCREEN_W } = Dimensions.get('window')

// ─── No tab bar on this screen — stats panel sits flush at the bottom ─────────

export default function TrackingScreen() {
  const insets       = useSafeAreaInsets()
  const mapRef       = useRef<MapView>(null)
  const shareCardRef = useRef<RunShareCardHandle>(null)
  const latestIdRef  = useRef<string | null>(null)

  const [currentUserId,   setCurrentUserId]   = useState<string | null>(null)
  const [currentUserName, setCurrentUserName] = useState('Runner')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user
      if (!user) return
      setCurrentUserId(user.id)
      supabase
        .from('profiles')
        .select('username, full_name')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data: profile }) => {
          if (profile) setCurrentUserName(profile.username ?? profile.full_name ?? 'Runner')
        })
    })
  }, [])

  const [activityType, setActivityType] = useState<ActivityType>('run')

  const {
    isTracking, isPaused, isOnline,
    route, distance, duration,
    pace, calories, steps,
    currentLocation,
    startTracking, pauseTracking, resumeTracking,
    stopTracking, resetTracking,
    getAnalytics,
  } = useGPSTracking()

  const {
    zones,
    captures,
    myZoneCount,
    isBattleMode,
    toggleBattleMode,
    clearCapture,
  } = useBattleZone({
    isTracking,
    currentLocation,
    userName: currentUserName,
  })

  // ── Auto-enable battle mode when navigated here from Explore ────────────────
  const { battleMode } = useLocalSearchParams<{ battleMode?: string }>()
  const battleModeInitialised = useRef(false)
  useEffect(() => {
    if (battleMode === '1' && !battleModeInitialised.current && !isBattleMode) {
      battleModeInitialised.current = true
      toggleBattleMode()
    }
  }, [battleMode, isBattleMode, toggleBattleMode])

  // ── Save-modal state ─────────────────────────────────────────────────────────
  const [saveModal,     setSaveModal]     = useState(false)
  const [activityTitle, setActivityTitle] = useState('')
  const [saving,        setSaving]        = useState(false)

  const [shareModal,     setShareModal]     = useState(false)
  const [captureLoading, setCaptureLoading] = useState(false)
  const [savedData,      setSavedData]      = useState<RunSnapshot | null>(null)

  const [routeModal,    setRouteModal]    = useState(false)
  const [savedRoutes,   setSavedRoutes]   = useState<SavedRoute[]>([])
  const [routesLoading, setRoutesLoading] = useState(false)
  const [ghostRoute,    setGhostRoute]    = useState<{ latitude: number; longitude: number }[] | null>(null)
  const [ghostLabel,    setGhostLabel]    = useState<string | null>(null)

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        flushQueue(activityService.saveActivity).then(({ saved }) => {
          if (saved > 0) console.log(`[sync] Flushed ${saved} offline run(s)`)
        })
      }
    })
    return () => sub.remove()
  }, [])

  const handleLocateMe = useCallback(() => {
    if (!currentLocation) {
      Alert.alert('Location unavailable', 'GPS fix not yet acquired. Try again in a moment.')
      return
    }
    mapRef.current?.animateToRegion(
      { latitude: currentLocation.latitude, longitude: currentLocation.longitude, latitudeDelta: 0.004, longitudeDelta: 0.004 },
      400,
    )
  }, [currentLocation])

  const openRouteModal = useCallback(async () => {
    setRouteModal(true)
    setRoutesLoading(true)
    try {
      const routes = await activityService.getSavedRoutes()
      setSavedRoutes(routes as SavedRoute[])
    } catch (e: any) {
      Alert.alert('Error loading routes', e.message)
    } finally {
      setRoutesLoading(false)
    }
  }, [])

  const handleSelectRoute = useCallback((r: SavedRoute) => {
    setGhostRoute(r.waypoints)
    setGhostLabel(r.name)
    setRouteModal(false)
    if (r.waypoints.length > 0) {
      mapRef.current?.fitToCoordinates(r.waypoints, { edgePadding: { top: 60, right: 40, bottom: 200, left: 40 }, animated: true })
    }
  }, [])

  const handleClearGhostRoute = useCallback(() => {
    setGhostRoute(null)
    setGhostLabel(null)
  }, [])

  const handleStop = async () => {
    await stopTracking()
    if (distance > 0.05) {
      setSaveModal(true)
    } else {
      Alert.alert('Too short', 'Go a little further before saving!')
      resetTracking()
    }
  }

  const handleSaveActivity = async () => {
    setSaving(true)
    try {
      const defaultTitles: Record<ActivityType, string> = {
        run: 'Morning Run', walk: 'Afternoon Walk', ride: 'Bike Ride',
      }
      const finalTitle = activityTitle.trim() || defaultTitles[activityType]
      const analytics  = getAnalytics()

      await activityService.saveActivity({
        title: finalTitle,
        distance, duration, pace, calories, route,
        ...(analytics.elevation_data.length > 0 && {
          elevation_gain: analytics.elevation_gain,
          max_elevation:  analytics.max_elevation,
          elevation_data: analytics.elevation_data,
        }),
        ...(analytics.pace_data.length > 0 && {
          pace_data:     analytics.pace_data,
          moving_time:   analytics.moving_time,
          fastest_split: analytics.fastest_split,
        }),
        ...(analytics.splits.length > 0 && { splits: analytics.splits }),
        ...(analytics.pace_zones.some((z: any) => z.percentage > 0) && {
          pace_zones: analytics.pace_zones,
        }),
      })

      const activities    = await activityService.getMyActivities()
      latestIdRef.current = activities[0]?.id ?? null

      setSavedData({
        title: finalTitle, distance, duration, pace, calories, route, steps,
        elevGain: analytics.elevation_gain,
        maxElev:  analytics.max_elevation,
      })
      setSaveModal(false)
      setShareModal(true)
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  const confirmDiscard = () => {
    Alert.alert('Discard activity?', 'This will permanently delete your current activity data.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { setSaveModal(false); resetTracking() } },
    ])
  }

  const handleSaveImage = async () => {
    setCaptureLoading(true)
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync()
      if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo library access to save the image.'); return }
      const uri = await (shareCardRef.current as any)?.capture()
      await MediaLibrary.saveToLibraryAsync(uri)
      Alert.alert('Saved! 📸', 'Share card saved to your Photos.')
    } catch (e: any) { Alert.alert('Error', e.message) }
    finally { setCaptureLoading(false) }
  }

  const handleShareImage = async () => {
    setCaptureLoading(true)
    try {
      const uri       = await (shareCardRef.current as any)?.capture()
      const available = await Sharing.isAvailableAsync()
      if (!available) { Alert.alert('Sharing not available on this device'); return }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your activity 🏃' })
    } catch (e: any) { Alert.alert('Error', e.message) }
    finally { setCaptureLoading(false) }
  }

  const handleCloseShare = () => { setShareModal(false); setSavedData(null); resetTracking() }

  const handleViewActivity = () => {
    setShareModal(false); setSavedData(null); resetTracking()
    if (latestIdRef.current) router.push({ pathname: '/(tabs)/activity', params: { id: latestIdRef.current } })
  }

  // ── How tall the stats panel is (so map FABs sit above it) ─────────────────
  // StatsPanel content height + device safe area bottom
  const statsPanelHeight = 180 + insets.bottom

  return (
    <View style={styles.container}>

      {/* ── MAP fills the entire screen ── */}
      <TrackingMap
        mapRef={mapRef}
        isTracking={isTracking}
        isPaused={isPaused}
        isOnline={isOnline}
        route={route}
        ghostRoute={ghostRoute}
        ghostLabel={ghostLabel}
        currentLocation={currentLocation}
        activityType={activityType}
        onChangeType={setActivityType}
        onLocateMe={handleLocateMe}
        onOpenRoutes={openRouteModal}
        onClearGhost={handleClearGhostRoute}
        isBattleMode={isBattleMode}
        onToggleBattleMode={toggleBattleMode}
        battleZones={zones}
        currentUserId={currentUserId}
      />

      {/* ── Back button — top-left, only when NOT actively tracking ── */}
      {!isTracking && (
        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + 12 }]}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <FontAwesome5 name="chevron-left" size={14} color="#fff" />
        </TouchableOpacity>
      )}

      {/* ── Battle Zone HUD (sits below status bar, above stats panel) ── */}
      {isBattleMode && (
        <BattleZoneHUD
          myZoneCount={myZoneCount}
          captures={captures}
          onClearCapture={clearCapture}
        />
      )}

      {/* ── Stats panel — flush at the bottom ── */}
      <View style={[styles.statsPanelWrapper, { bottom: 0 }]}>
        <StatsPanel
          isTracking={isTracking}
          isPaused={isPaused}
          distance={distance}
          duration={duration}
          pace={pace}
          onStart={startTracking}
          onPause={pauseTracking}
          onResume={resumeTracking}
          onStop={handleStop}
        />
      </View>

      {/* ── SAVED ROUTES MODAL ─────────────────────────────────────────────── */}
      <Modal visible={routeModal} transparent animationType="slide" onRequestClose={() => setRouteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Saved Routes</Text>
              <TouchableOpacity onPress={() => setRouteModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <FontAwesome5 name="times" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {routesLoading ? (
              <ActivityIndicator color={Colors.primary} style={styles.loader} />
            ) : savedRoutes.length === 0 ? (
              <View style={styles.emptyRoutes}>
                <FontAwesome5 name="map-marked-alt" size={32} color={Colors.textDim} />
                <Text style={styles.emptyTitle}>No saved routes yet</Text>
                <Text style={styles.emptySub}>Plan a route in the Explore tab and save it to see it here.</Text>
              </View>
            ) : (
              <FlatList
                data={savedRoutes}
                keyExtractor={(r) => r.id}
                style={styles.routeList}
                ItemSeparatorComponent={() => <View style={styles.routeSep} />}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.routeRow} onPress={() => handleSelectRoute(item)} activeOpacity={0.7}>
                    <View style={styles.routeIconWrap}>
                      <FontAwesome5 name="route" size={14} color={Colors.primary} />
                    </View>
                    <View style={styles.routeInfo}>
                      <Text style={styles.routeName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.routeMeta}>{item.distance_km.toFixed(2)} km</Text>
                    </View>
                    <FontAwesome5 name="chevron-right" size={13} color={Colors.textDim} />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ── SAVE MODAL ─────────────────────────────────────────────────────── */}
      <Modal visible={saveModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Text style={styles.modalTitle}>Save your activity</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Activity name"
              placeholderTextColor={Colors.textDim}
              value={activityTitle}
              onChangeText={setActivityTitle}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveActivity} disabled={saving}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save Activity</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmDiscard} disabled={saving}>
              <Text style={styles.discardText}>Discard activity</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── SHARE MODAL ────────────────────────────────────────────────────── */}
      <Modal visible={shareModal} transparent animationType="fade">
        <View style={styles.shareOverlay}>
          <ScrollView
            contentContainerStyle={[
              styles.shareScroll,
              { paddingBottom: Math.max(insets.bottom, 24) + 24 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.shareHeading}>Activity Card 🏃</Text>
            <Text style={styles.shareSubheading}>Save or share your achievement</Text>

            {savedData && (
              <View style={styles.shareCardWrapper}>
                <RunShareCard
                  ref={shareCardRef}
                  title={savedData.title}
                  distance={savedData.distance}
                  duration={savedData.duration}
                  pace={savedData.pace}
                  calories={savedData.calories}
                  route={savedData.route}
                  elevGain={savedData.elevGain}
                  maxElev={savedData.maxElev}
                  steps={savedData.steps}
                />
              </View>
            )}

            <View style={styles.shareActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleSaveImage} disabled={captureLoading}>
                {captureLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <FontAwesome5 name="download" size={18} color="#fff" />}
                <Text style={styles.actionBtnText}>Save to Photos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]} onPress={handleShareImage} disabled={captureLoading}>
                <FontAwesome5 name="share-alt" size={18} color={Colors.primary} />
                <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Share</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.shareSecondary}>
              <TouchableOpacity onPress={handleViewActivity}>
                <Text style={styles.secondaryLink}>View activity details</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCloseShare}>
                <Text style={styles.secondaryClose}>Close</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // ── Back button (top-left, visible when not tracking) ─────────────────────
  backBtn: {
    position: 'absolute',
    left: 14,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
  },

  // ── Stats panel sits above the floating tab bar ────────────────────────────
  statsPanelWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    // `bottom` is set inline using TAB_BAR_CLEARANCE
    // This ensures the panel never overlaps the tab bar pill
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 16,
  },

  // ── Modals ─────────────────────────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: {
    backgroundColor: Colors.card,
    padding: 24,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { color: Colors.text, fontSize: 20, fontWeight: 'bold' },
  loader: { marginVertical: 32 },

  modalInput: { backgroundColor: Colors.card2, color: Colors.text, padding: 15, borderRadius: 10, marginTop: 16, marginBottom: 20 },
  saveBtn:    { backgroundColor: Colors.primary, padding: 18, borderRadius: 10, alignItems: 'center', marginBottom: 12 },
  btnText:    { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  discardText:{ color: Colors.textMuted, textAlign: 'center', paddingVertical: 4 },

  routeList: { maxHeight: 320 },
  routeSep:  { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  routeRow:  { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  routeIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(108,99,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  routeInfo: { flex: 1 },
  routeName: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  routeMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  emptyRoutes: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyTitle:  { color: Colors.text, fontSize: 16, fontWeight: '600' },
  emptySub:    { color: Colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 18, paddingHorizontal: 12 },

  // ── Share modal ────────────────────────────────────────────────────────────
  shareOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  shareScroll:      { flexGrow: 1, alignItems: 'center', paddingTop: 60, paddingHorizontal: 20 },
  shareHeading:     { color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  shareSubheading:  { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 28 },
  shareCardWrapper: {
    width: SCREEN_W - 40,
    aspectRatio: 360 / 540,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  shareActions:     { flexDirection: 'row', gap: 12, marginTop: 28, width: '100%' },
  actionBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14 },
  actionBtnOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary },
  actionBtnText:    { color: '#fff', fontWeight: '700', fontSize: 15 },
  shareSecondary:   { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 20, paddingHorizontal: 4 },
  secondaryLink:    { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  secondaryClose:   { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
})