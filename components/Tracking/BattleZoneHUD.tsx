// components/tracking/BattleZoneHUD.tsx
//
// Overlay that sits on top of the map (NOT inside MapView) during battle mode.
//
// Renders:
//  1. TOP BANNER  — zone count badge + "Battle Mode" label
//  2. CAPTURE TOASTS — animated pop-ups for each new cell captured / stolen
//  3. LEADERBOARD PANEL — slide-in panel showing top territory holders
//     • Users whose zones are all stolen stay in the list at 0
//     • Each row shows a delta arrow: ▲5 (green) or ▼3 (red) next to
//       the zone count, based on change since the session started

import React, { memo, useEffect, useRef, useState, useCallback } from 'react'
import {
  View, Text, TouchableOpacity,
  Animated, StyleSheet, FlatList, ActivityIndicator,
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { battleZoneService, ZoneLeaderboardEntry } from '../../services/battleZoneService'
import type { CaptureEvent } from '../../hooks/useBattleZone'

// ─── Palette ──────────────────────────────────────────────────────────────────

const BATTLE_RED   = '#ef4444'
const BATTLE_GOLD  = '#f59e0b'
const STEAL_COLOR  = '#f97316'   // orange — "you stole a zone!"
const CLAIM_COLOR  = Colors.primary  // green — "you claimed a new zone"

const DELTA_UP_COLOR   = '#4ade80'  // bright green for gains
const DELTA_DOWN_COLOR = '#f87171'  // soft red for losses

// ─── Props ────────────────────────────────────────────────────────────────────

interface BattleZoneHUDProps {
  myZoneCount: number
  captures: CaptureEvent[]
  onClearCapture: (id: string) => void
}

// ─── Main HUD ─────────────────────────────────────────────────────────────────

function BattleZoneHUD({ myZoneCount, captures, onClearCapture }: BattleZoneHUDProps) {
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  return (
    <>
      {/* Top banner */}
      <TopBanner
        zoneCount={myZoneCount}
        onLeaderboardPress={() => setShowLeaderboard(true)}
      />

      {/* Capture toasts — stacked below banner */}
      <View style={styles.toastStack} pointerEvents="none">
        {captures.slice(0, 4).map((evt) => (
          <CaptureToast key={evt.id} event={evt} onDone={() => onClearCapture(evt.id)} />
        ))}
      </View>

      {/* Leaderboard slide-in */}
      {showLeaderboard && (
        <LeaderboardPanel onClose={() => setShowLeaderboard(false)} myZoneCount={myZoneCount} />
      )}
    </>
  )
}

// ─── Top banner ───────────────────────────────────────────────────────────────

const TopBanner = memo(function TopBanner({
  zoneCount,
  onLeaderboardPress,
}: {
  zoneCount: number
  onLeaderboardPress: () => void
}) {
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.2, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1.0, duration: 800, useNativeDriver: true }),
      ])
    ).start()
  }, [pulse])

  return (
    <View style={styles.banner} pointerEvents="box-none">
      {/* Pulsing war icon */}
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <View style={styles.warIcon}>
          <Text style={styles.warEmoji}>⚔️</Text>
        </View>
      </Animated.View>

      <View style={styles.bannerCenter}>
        <Text style={styles.bannerTitle}>BATTLE MODE</Text>
        <Text style={styles.bannerSub}>Run to claim territory</Text>
      </View>

      {/* Zone count badge — tapping opens the leaderboard */}
      <TouchableOpacity style={styles.zoneBadge} onPress={onLeaderboardPress}>
        <FontAwesome5 name="flag" size={10} color={BATTLE_GOLD} />
        <Text style={styles.zoneCount}>{zoneCount}</Text>
        <FontAwesome5 name="chevron-right" size={8} color="rgba(255,255,255,0.4)" />
      </TouchableOpacity>
    </View>
  )
})

// ─── Capture toast ────────────────────────────────────────────────────────────

const TOAST_DURATION_MS = 3500

const CaptureToast = memo(function CaptureToast({
  event,
  onDone,
}: {
  event: CaptureEvent
  onDone: () => void
}) {
  const opacity    = useRef(new Animated.Value(0)).current
  const translateX = useRef(new Animated.Value(60)).current

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.spring(opacity,    { toValue: 1, useNativeDriver: true, damping: 15 }),
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, damping: 15 }),
    ]).start()

    // Auto-dismiss
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity,    { toValue: 0, duration: 300, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 60, duration: 300, useNativeDriver: true }),
      ]).start(onDone)
    }, TOAST_DURATION_MS)

    return () => clearTimeout(timer)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const color = event.wasSteal ? STEAL_COLOR : CLAIM_COLOR
  const title = event.wasSteal
    ? `Stolen from ${event.previousOwner ?? 'enemy'}!`
    : 'Territory Claimed!'
  const sub = event.wasSteal
    ? 'You took their zone 🔥'
    : 'New hex under your control'

  return (
    <Animated.View
      style={[
        styles.toast,
        { borderLeftColor: color, opacity, transform: [{ translateX }] },
      ]}
    >
      <View style={[styles.toastIcon, { backgroundColor: color + '22' }]}>
        <FontAwesome5
          name={event.wasSteal ? 'crosshairs' : 'flag-checkered'}
          size={16}
          color={color}
        />
      </View>
      <View>
        <Text style={[styles.toastTitle, { color }]}>{title}</Text>
        <Text style={styles.toastSub}>{sub}</Text>
      </View>
    </Animated.View>
  )
})

// ─── Leaderboard panel ────────────────────────────────────────────────────────

const LeaderboardPanel = memo(function LeaderboardPanel({
  onClose,
  myZoneCount,
}: {
  onClose: () => void
  myZoneCount: number
}) {
  const [entries, setEntries] = useState<ZoneLeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const slideY = useRef(new Animated.Value(-500)).current

  const load = useCallback(() => {
    setLoading(true)
    battleZoneService
      .getLeaderboard()
      .then(setEntries)
      .catch(console.warn)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 18 }).start()
    load()
  }, [slideY, load])

  const close = useCallback(() => {
    Animated.timing(slideY, { toValue: -500, duration: 250, useNativeDriver: true }).start(onClose)
  }, [slideY, onClose])

  return (
    <Animated.View style={[styles.panel, { transform: [{ translateY: slideY }] }]}>
      {/* Header */}
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>⚔️ Territory Rankings</Text>
        <View style={styles.panelHeaderRight}>
          {/* Refresh button */}
          <TouchableOpacity
            onPress={load}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.refreshBtn}
          >
            <FontAwesome5 name="sync-alt" size={13} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={close} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <FontAwesome5 name="times" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* My count */}
      <View style={styles.myRow}>
        <FontAwesome5 name="flag" size={13} color={BATTLE_GOLD} />
        <Text style={styles.myRowText}>
          You control <Text style={styles.myRowCount}>{myZoneCount}</Text> zones
        </Text>
      </View>

      {/* Delta legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <FontAwesome5 name="arrow-up" size={9} color={DELTA_UP_COLOR} />
          <Text style={[styles.legendText, { color: DELTA_UP_COLOR }]}>gained this session</Text>
        </View>
        <View style={styles.legendItem}>
          <FontAwesome5 name="arrow-down" size={9} color={DELTA_DOWN_COLOR} />
          <Text style={[styles.legendText, { color: DELTA_DOWN_COLOR }]}>lost this session</Text>
        </View>
      </View>

      {/* List */}
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.owner_id}
          style={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <LeaderboardRow entry={item} rank={index + 1} />
          )}
        />
      )}

      {/* Handle — at bottom to indicate swipe-up to dismiss */}
      <View style={styles.panelHandle} />
    </Animated.View>
  )
})

// ─── Leaderboard row ──────────────────────────────────────────────────────────

const LeaderboardRow = memo(function LeaderboardRow({
  entry,
  rank,
}: {
  entry: ZoneLeaderboardEntry
  rank: number
}) {
  const rankColor = rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : rank === 3 ? '#cd7f32' : Colors.textMuted

  const hasDelta    = !!entry.delta && entry.delta !== 0
  const deltaIcon   = (entry.delta ?? 0) > 0 ? 'arrow-up' : 'arrow-down'
  const deltaColor  = (entry.delta ?? 0) > 0 ? DELTA_UP_COLOR : DELTA_DOWN_COLOR
  const deltaAbs    = Math.abs(entry.delta ?? 0)

  // Dim the row slightly if user has 0 zones (all stolen)
  const isEliminated = entry.zone_count === 0

  return (
    <View style={[styles.lbRow, isEliminated && styles.lbRowEliminated]}>
      {/* Rank */}
      <Text style={[styles.lbRank, { color: rankColor }]}>
        {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}
      </Text>

      {/* Name */}
      <Text
        style={[styles.lbName, isEliminated && styles.lbNameEliminated]}
        numberOfLines={1}
      >
        {entry.owner_name}
      </Text>

      {/* Delta arrow + zone count pill */}
      <View style={styles.lbRight}>
        {hasDelta && (
          <View style={[styles.deltaBadge, { backgroundColor: deltaColor + '18', borderColor: deltaColor + '44' }]}>
            <FontAwesome5 name={deltaIcon} size={8} color={deltaColor} />
            <Text style={[styles.deltaText, { color: deltaColor }]}>{deltaAbs}</Text>
          </View>
        )}

        <View style={[
          styles.lbCount,
          isEliminated && styles.lbCountEliminated,
        ]}>
          <FontAwesome5
            name="flag"
            size={10}
            color={isEliminated ? Colors.textMuted : Colors.primary}
          />
          <Text style={[
            styles.lbCountText,
            isEliminated && styles.lbCountTextEliminated,
          ]}>
            {entry.zone_count}
          </Text>
        </View>
      </View>
    </View>
  )
})

export default memo(BattleZoneHUD)
BattleZoneHUD.displayName = 'BattleZoneHUD'

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Banner
  banner: {
    position: 'absolute',
    top: 46,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.88)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: `${BATTLE_RED}55`,
    gap: 12,
    shadowColor: BATTLE_RED,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  warIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: `${BATTLE_RED}22`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  warEmoji:     { fontSize: 18 },
  bannerCenter: { flex: 1 },
  bannerTitle:  { color: BATTLE_RED, fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
  bannerSub:    { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 1 },
  zoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: `${BATTLE_GOLD}18`,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: `${BATTLE_GOLD}44`,
  },
  zoneCount: { color: BATTLE_GOLD, fontSize: 14, fontWeight: '800' },

  // ── Toasts
  toastStack: {
    position: 'absolute',
    top: 120,
    right: 12,
    gap: 8,
    width: 220,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  toastIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastTitle: { fontSize: 12, fontWeight: '800' },
  toastSub:   { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 },

  // ── Leaderboard panel
  panel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.card,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 56,   // space for status bar / notch
    paddingBottom: 24,
    maxHeight: '75%',
    borderBottomWidth: 1,
    borderColor: `${BATTLE_RED}33`,
  },
  panelHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: 8,
    marginBottom: 18,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  panelHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  refreshBtn: {
    padding: 2,
  },
  panelTitle: { color: Colors.text, fontSize: 18, fontWeight: '800' },

  myRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${BATTLE_GOLD}12`,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: `${BATTLE_GOLD}30`,
  },
  myRowText:  { color: Colors.textMuted, fontSize: 13 },
  myRowCount: { color: BATTLE_GOLD, fontWeight: '800' },

  // Delta legend
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendText: {
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.8,
  },

  loader: { marginVertical: 24 },
  list:   { maxHeight: 340 },

  // ── Leaderboard row
  lbRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: 10,
  },
  // Visually dim eliminated (0-zone) rows
  lbRowEliminated: {
    opacity: 0.55,
  },

  lbRank: { width: 32, fontSize: 16, textAlign: 'center' },

  lbName: { flex: 1, color: Colors.text, fontSize: 14, fontWeight: '600' },
  lbNameEliminated: { color: Colors.textMuted, fontWeight: '500' },

  // Right side: delta badge + zone count
  lbRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  // Delta pill (▲5 / ▼3)
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  deltaText: {
    fontSize: 11,
    fontWeight: '800',
  },

  // Zone count pill
  lbCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: `${Colors.primary}18`,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  lbCountEliminated: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  lbCountText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  lbCountTextEliminated: { color: Colors.textMuted },
})