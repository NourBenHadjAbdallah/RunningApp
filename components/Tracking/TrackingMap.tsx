// components/tracking/TrackingMap.tsx

import { FontAwesome5 } from '@expo/vector-icons'
import React, { memo, useState, useRef } from 'react'
import { StyleSheet, Text, TouchableOpacity, View, Animated, Pressable } from 'react-native'
import MapView, { Polyline, PROVIDER_GOOGLE } from 'react-native-maps'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import { DARK_MAP_STYLE, DEFAULT_REGION } from '../../constants/mapStyle'
import type { Coordinate } from './tracking'
import type { ActivityType } from './ActivityTypePicker'
import BattleZoneLayer from './BattleZoneLayer'
import type { BattleZone } from '../../services/battleZoneService'

// ─── Activity type options ────────────────────────────────────────────────────

const TYPE_OPTIONS: { type: ActivityType; icon: string; label: string; color: string }[] = [
  { type: 'run',  icon: 'running', label: 'Run',  color: Colors.primary },
  { type: 'walk', icon: 'walking', label: 'Walk', color: '#60a5fa' },
  { type: 'ride', icon: 'bicycle', label: 'Ride', color: '#f59e0b' },
]

const BATTLE_RED  = '#ef4444'
const BATTLE_GOLD = '#f59e0b'

// Stats panel height — FABs sit just above it. No tab bar to clear.
const STATS_PANEL_H = 180
const FAB_BOTTOM    = STATS_PANEL_H + 8

// ─── Props ────────────────────────────────────────────────────────────────────

interface TrackingMapProps {
  mapRef: React.RefObject<MapView | null>
  isTracking: boolean
  isPaused: boolean
  isOnline: boolean
  route: Coordinate[]
  ghostRoute: Coordinate[] | null
  ghostLabel: string | null
  currentLocation: Coordinate | null
  activityType: ActivityType
  onChangeType: (t: ActivityType) => void
  onLocateMe: () => void
  onOpenRoutes: () => void
  onClearGhost: () => void
  isBattleMode: boolean
  onToggleBattleMode: () => void
  battleZones: BattleZone[]
  currentUserId: string | null
}

// ─── Component ────────────────────────────────────────────────────────────────

function TrackingMap({
  mapRef, isTracking, isPaused, isOnline,
  route, ghostRoute, ghostLabel, currentLocation,
  activityType, onChangeType,
  onLocateMe, onOpenRoutes, onClearGhost,
  isBattleMode, onToggleBattleMode, battleZones, currentUserId,
}: TrackingMapProps) {
  const insets = useSafeAreaInsets()
  const [pickerOpen, setPickerOpen] = useState(false)
  const fadeAnim  = useRef(new Animated.Value(0)).current
  const scaleAnim = useRef(new Animated.Value(0.85)).current

  // Battle button pulse
  const battlePulse = useRef(new Animated.Value(1)).current
  const pulseLoop   = useRef<Animated.CompositeAnimation | null>(null)

  React.useEffect(() => {
    if (isBattleMode) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(battlePulse, { toValue: 1.18, duration: 700, useNativeDriver: true }),
          Animated.timing(battlePulse, { toValue: 1.0,  duration: 700, useNativeDriver: true }),
        ])
      )
      pulseLoop.current.start()
    } else {
      pulseLoop.current?.stop()
      battlePulse.setValue(1)
    }
  }, [isBattleMode, battlePulse])

  const openPicker = () => {
    setPickerOpen(true)
    Animated.parallel([
      Animated.spring(fadeAnim,  { toValue: 1, useNativeDriver: true, damping: 15, stiffness: 200 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, damping: 15, stiffness: 200 }),
    ]).start()
  }

  const closePicker = () => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.85, duration: 150, useNativeDriver: true }),
    ]).start(() => setPickerOpen(false))
  }

  const handleSelect = (t: ActivityType) => {
    onChangeType(t)
    closePicker()
  }

  const activeCfg = TYPE_OPTIONS.find(o => o.type === activityType)!

  const mapRegion = currentLocation
    ? {
        latitude:      currentLocation.latitude,
        longitude:     currentLocation.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }
    : undefined

  return (
    <>
      {/* ── Map fills the entire screen ── */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFillObject}
        customMapStyle={DARK_MAP_STYLE}
        showsUserLocation
        followsUserLocation={isTracking && !isPaused}
        region={mapRegion}
        initialRegion={DEFAULT_REGION}
      >
        {isBattleMode && (
          <BattleZoneLayer zones={battleZones} currentUserId={currentUserId} />
        )}

        {ghostRoute && ghostRoute.length > 1 && (
          <Polyline
            coordinates={ghostRoute}
            strokeColor="rgba(255,255,255,0.35)"
            strokeWidth={4}
            lineDashPattern={[10, 6]}
          />
        )}
        {route.length > 1 && (
          <Polyline coordinates={route} strokeColor={Colors.primary} strokeWidth={5} />
        )}
      </MapView>

      {/* ── Tracking status badge — below status bar ── */}
      {isTracking && (
        <View style={[styles.badge, { top: insets.top + 12 }]}>
          <View style={[styles.badgeDot, isPaused && styles.badgeDotPaused]} />
          <Text style={styles.badgeText}>{isPaused ? 'PAUSED' : 'TRACKING'}</Text>
        </View>
      )}

      {/* ── Offline banner ── */}
      {!isOnline && (
        <View style={[styles.offlineBanner, { top: insets.top + (isTracking ? 58 : 12) }]}>
          <FontAwesome5 name="wifi" size={11} color="#fff" />
          <Text style={styles.offlineBannerText}>No connection — run will save offline</Text>
        </View>
      )}

      {/* ── Ghost route label ── */}
      {ghostLabel && (
        <View style={[
          styles.ghostBanner,
          { top: insets.top + (isTracking ? (!isOnline ? 104 : 58) : (!isOnline ? 58 : 12)) },
        ]}>
          <FontAwesome5 name="route" size={11} color={Colors.primary} />
          <Text style={styles.ghostText} numberOfLines={1}>{ghostLabel}</Text>
          <TouchableOpacity onPress={onClearGhost} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <FontAwesome5 name="times" size={12} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>
      )}

      {/* ── FABs — positioned above StatsPanel + tab bar ── */}
      <View style={[styles.fabs, { bottom: FAB_BOTTOM }]}>
        {/* Locate me */}
        <TouchableOpacity style={styles.fab} onPress={onLocateMe} activeOpacity={0.8}>
          <FontAwesome5 name="location-arrow" size={16} color={Colors.primary} />
        </TouchableOpacity>

        {/* Saved routes */}
        <TouchableOpacity style={styles.fab} onPress={onOpenRoutes} activeOpacity={0.8}>
          <FontAwesome5 name="route" size={16} color={Colors.primary} />
        </TouchableOpacity>

        {/* Activity type */}
        <TouchableOpacity
          style={[styles.fab, { borderColor: activeCfg.color + '88' }]}
          onPress={pickerOpen ? closePicker : openPicker}
          activeOpacity={0.8}
        >
          <FontAwesome5 name={activeCfg.icon} size={16} color={activeCfg.color} />
        </TouchableOpacity>

        {/* Battle Zone toggle */}
        <Animated.View style={{ transform: [{ scale: battlePulse }] }}>
          <TouchableOpacity
            style={[
              styles.fab,
              styles.battleFab,
              isBattleMode && styles.battleFabActive,
            ]}
            onPress={onToggleBattleMode}
            activeOpacity={0.8}
          >
            {isBattleMode
              ? <Text style={styles.battleEmoji}>⚔️</Text>
              : <FontAwesome5 name="shield-alt" size={16} color={BATTLE_RED} />
            }
          </TouchableOpacity>
        </Animated.View>
      </View>

      {/* ── Battle mode active label — left of FABs ── */}
      {isBattleMode && (
        <View style={[styles.battleLabel, { bottom: FAB_BOTTOM }]}>
          <View style={styles.battleLabelDot} />
          <Text style={styles.battleLabelText}>BATTLE ZONE</Text>
        </View>
      )}

      {/* ── Activity type picker popover ── */}
      {pickerOpen && (
        <>
          <Pressable style={StyleSheet.absoluteFill} onPress={closePicker} />
          <Animated.View
            style={[
              styles.popover,
              { bottom: FAB_BOTTOM + 10, opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
            ]}
          >
            <View style={styles.track}>
              <View
                style={[
                  styles.thumb,
                  {
                    backgroundColor: activeCfg.color + '22',
                    borderColor:     activeCfg.color,
                    left: `${TYPE_OPTIONS.findIndex(o => o.type === activityType) * 33.33}%` as any,
                  },
                ]}
              />
              {TYPE_OPTIONS.map((opt) => {
                const active = opt.type === activityType
                return (
                  <TouchableOpacity
                    key={opt.type}
                    style={styles.option}
                    onPress={() => handleSelect(opt.type)}
                    activeOpacity={0.7}
                  >
                    <FontAwesome5
                      name={opt.icon}
                      size={18}
                      color={active ? opt.color : 'rgba(255,255,255,0.35)'}
                    />
                    <Text style={[styles.optionLabel, active && { color: opt.color }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </Animated.View>
        </>
      )}
    </>
  )
}

export default memo(TrackingMap)
TrackingMap.displayName = 'TrackingMap'

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 10,
    borderRadius: 20,
  },
  badgeDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#ef4444', marginRight: 8,
  },
  badgeDotPaused: { backgroundColor: '#f59e0b' },
  badgeText: { color: '#fff', fontWeight: 'bold' },

  offlineBanner: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239,68,68,0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  offlineBannerText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  ghostBanner: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    maxWidth: 300,
  },
  ghostText: { color: '#fff', fontSize: 12, fontWeight: '600', flex: 1 },

  // ── FABs ──────────────────────────────────────────────────────────────────
  fabs: {
    position: 'absolute',
    right: 14,
    gap: 10,
    alignItems: 'center',
  },
  fab: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.82)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(108,99,255,0.35)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4, shadowRadius: 4, elevation: 5,
  },
  battleFab: {
    borderColor: `${BATTLE_RED}66`,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  battleFabActive: {
    backgroundColor: `${BATTLE_RED}22`,
    borderColor: BATTLE_RED,
    shadowColor: BATTLE_RED,
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  battleEmoji: { fontSize: 18 },

  // ── Battle label ──────────────────────────────────────────────────────────
  battleLabel: {
    position: 'absolute',
    right: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.88)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: `${BATTLE_RED}55`,
  },
  battleLabelDot: {
    width: 7, height: 7, borderRadius: 3.5,
    backgroundColor: BATTLE_RED,
  },
  battleLabelText: {
    color: BATTLE_RED,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },

  // ── Activity type popover ─────────────────────────────────────────────────
  popover: {
    position: 'absolute',
    right: 66,
    backgroundColor: 'rgba(10,10,15,0.96)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  track: {
    flexDirection: 'row',
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  thumb: {
    position: 'absolute',
    top: 0, bottom: 0,
    width: '33.33%',
    borderRadius: 14,
    borderWidth: 1,
  },
  option: {
    width: 68,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 5,
    zIndex: 1,
  },
  optionLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
})