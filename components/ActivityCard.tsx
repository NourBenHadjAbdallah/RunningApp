// components/ActivityCard.tsx
// Unified card used in both the Home feed and Profile screens.
//
// FEED mode    (variant="feed")    — non-pressable, shows kudos + comment buttons.
// PROFILE mode (variant="profile") — pressable, shows chevron, navigates on tap.
//
// Username fix: reads `full_name` first, falls back to `username`, then 'Runner'.

import React, { useMemo } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { router } from 'expo-router'
import MapView, { Polyline, Marker } from 'react-native-maps'
import { Activity } from '../services/activityService'
import { formatTime } from '../utils/calculations'
import { Colors } from '../constants/colors'

// ─── Props ────────────────────────────────────────────────────────────────────

interface BaseProps {
  item: Activity
}

interface FeedProps extends BaseProps {
  variant: 'feed'
  kudosed: boolean
  onKudos: (id: string, currently: boolean) => void
}

interface ProfileProps extends BaseProps {
  variant: 'profile'
  onPress: (activity: Activity) => void
}

export type ActivityCardProps = FeedProps | ProfileProps

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPaceStr(pace: number): string {
  if (pace <= 0) return '--'
  const min = Math.floor(pace)
  const sec = Math.round((pace - min) * 60)
  return `${min}'${sec.toString().padStart(2, '0')}" /km`
}

function formatDisplayDate(isoString: string): string {
  const d        = new Date(isoString)
  const datePart = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const timePart = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${datePart} at ${timePart}`
}

/** Compute a MapView region that frames all route coordinates with padding. */
function getBoundingRegion(coords: { latitude: number; longitude: number }[]) {
  if (coords.length === 0) return null
  const lats = coords.map(c => c.latitude)
  const lngs = coords.map(c => c.longitude)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  return {
    latitude:      (minLat + maxLat) / 2,
    longitude:     (minLng + maxLng) / 2,
    latitudeDelta:  Math.max((maxLat - minLat) * 1.5, 0.008),
    longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.008),
  }
}

// ─── Route map (feed only) ────────────────────────────────────────────────────

function RouteMap({ route }: { route: Activity['route'] }) {
  const coords = route ?? []
  const region = useMemo(() => getBoundingRegion(coords), [coords])

  if (!region || coords.length < 2) return null

  return (
    <View style={mapStyles.container} pointerEvents="none">
      <MapView
        style={mapStyles.map}
        region={region}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        // Keeps tiles in dark/light sync with the rest of the app
        userInterfaceStyle="dark"
      >
        <Polyline
          coordinates={coords}
          strokeColor={Colors.primary}
          strokeWidth={4}
          lineCap="round"
          lineJoin="round"
        />

        {/* Start marker */}
        <Marker coordinate={coords[0]} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={mapStyles.startDot} />
        </Marker>

        {/* Finish marker */}
        <Marker coordinate={coords[coords.length - 1]} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={mapStyles.finishDot} />
        </Marker>
      </MapView>
    </View>
  )
}

const mapStyles = StyleSheet.create({
  container: {
    height: 200,
    overflow: 'hidden',
  },
  map: {
    flex: 1,
  },
  startDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.success ?? '#22c55e',
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  finishDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.danger ?? '#ef4444',
    borderWidth: 2.5,
    borderColor: '#fff',
  },
})

// ─── Component ────────────────────────────────────────────────────────────────

export function ActivityCard(props: ActivityCardProps) {
  const { item }  = props
  const isFeed    = props.variant === 'feed'

  // ── User info ──────────────────────────────────────────────────────────────
  const profile   = item.profiles as any
  // Fix: prefer full_name → username → 'Runner'
  const username  = profile?.full_name?.trim() || profile?.username?.trim() || 'Runner'
  const avatarUrl = profile?.avatar_url as string | null
  const initials  = username[0]?.toUpperCase() ?? '?'
  const groupName = (item.groups as any)?.name

  const dateDisplay = formatDisplayDate(item.started_at)
  const paceStr     = formatPaceStr(item.pace)

  // Kudos count with optimistic +1 for feed
  const kudosed = isFeed ? (props as FeedProps).kudosed : false
  const kudos   = (item.kudos_count ?? 0) + (kudosed ? 1 : 0)

  // ── Shared inner content ──────────────────────────────────────────────────
  const content = (
    <>
      {/* ── Header ── */}
      <View style={styles.cardHeader}>
        <View style={styles.avatarWrap}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={styles.avatarBadge}>
            <FontAwesome5 name="running" size={7} color="#fff" />
          </View>
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.username}>{username}</Text>
          <View style={styles.subRow}>
            <Text style={styles.date}>{dateDisplay}</Text>
            {groupName ? (
              <>
                <Text style={styles.dotSep}> · </Text>
                <FontAwesome5 name="users" size={10} color={Colors.primary} />
                <Text style={styles.groupTag}> {groupName}</Text>
              </>
            ) : null}
          </View>
        </View>

        {isFeed ? (
          <TouchableOpacity style={styles.moreBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <FontAwesome5 name="ellipsis-h" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        ) : (
          <FontAwesome5 name="chevron-right" size={13} color={Colors.textMuted} />
        )}
      </View>

      {/* ── Title ── */}
      <Text style={styles.activityTitle}>{item.title}</Text>

      {/* ── Stats ── */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Distance</Text>
          <Text style={styles.statValue}>
            {item.distance.toFixed(2)}{' '}
            <Text style={styles.statUnit}>km</Text>
          </Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Pace</Text>
          <Text style={styles.statValue}>{paceStr}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Time</Text>
          <Text style={styles.statValue}>{formatTime(item.duration)}</Text>
        </View>
      </View>

      {/* ── Route map (feed only, replaces placeholder) ── */}
      {isFeed && item.route && item.route.length > 1 && (
        <RouteMap route={item.route} />
      )}

      {/* ── Footer: kudos + comment (feed only) ── */}
      {isFeed && (
        <View style={styles.cardFooter}>
          {kudos > 0 && (
            <View style={styles.kudosAvatarsRow}>
              <View style={styles.kudosAvatarDot} />
              <Text style={styles.kudosGaveText}>{kudos} gave kudos</Text>
            </View>
          )}
          <View style={styles.footerActions}>
            <TouchableOpacity
              style={[styles.actionBtn, kudosed && styles.actionBtnActive]}
              onPress={() => (props as FeedProps).onKudos(item.id, kudosed)}
              activeOpacity={0.75}
            >
              <FontAwesome5
                name="bolt"
                size={14}
                color={kudosed ? '#f59e0b' : Colors.textMuted}
                solid={kudosed}
              />
              <Text style={[styles.actionBtnText, kudosed && styles.actionBtnTextActive]}>Kudos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionBtn}
              activeOpacity={0.75}
              onPress={() => router.push({ pathname: '/(tabs)/activity', params: { id: item.id } })}
            >
              <FontAwesome5 name="comment" size={14} color={Colors.textMuted} />
              <Text style={styles.actionBtnText}>
                {item.comment_count
                  ? `${item.comment_count} Comment${item.comment_count > 1 ? 's' : ''}`
                  : 'Comment'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </>
  )

  // ── Feed: plain card ───────────────────────────────────────────────────────
  if (isFeed) {
    return <View style={styles.card}>{content}</View>
  }

  // ── Profile: pressable flat row ────────────────────────────────────────────
  return (
    <TouchableOpacity
      style={[styles.card, styles.cardProfile]}
      onPress={() => (props as ProfileProps).onPress(item)}
      activeOpacity={0.75}
    >
      {content}
    </TouchableOpacity>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  // Profile variant: flat list style (no rounded corners, collapsed borders)
  cardProfile: {
    borderRadius: 0,
    marginBottom: 0,
    marginTop: -1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
  },

  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
  },
  avatarWrap: { position: 'relative', marginRight: 12 },
  avatarImg:  { width: 46, height: 46, borderRadius: 23 },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  avatarBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.card,
  },
  userInfo:  { flex: 1 },
  username:  { color: Colors.text, fontWeight: '700', fontSize: 15 },
  subRow:    { flexDirection: 'row', alignItems: 'center', marginTop: 2, flexWrap: 'wrap' },
  date:      { color: Colors.textMuted, fontSize: 12 },
  dotSep:    { color: Colors.textMuted, fontSize: 12 },
  groupTag:  { color: Colors.primary, fontSize: 12, fontWeight: '500' },
  moreBtn:   { padding: 4 },

  activityTitle: {
    color: Colors.text, fontSize: 22, fontWeight: '800',
    paddingHorizontal: 16, paddingBottom: 14, letterSpacing: -0.3,
  },

  statsRow:  { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 14, gap: 32 },
  stat:      { flexDirection: 'column' },
  statLabel: { color: Colors.textMuted, fontSize: 12, marginBottom: 1 },
  statValue: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  statUnit:  { fontSize: 14, fontWeight: '500', color: Colors.textMuted },

  cardFooter: {
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14,
    borderTopWidth: 1, borderColor: Colors.border,
  },
  kudosAvatarsRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10,
  },
  kudosAvatarDot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.card2, borderWidth: 1, borderColor: Colors.border,
  },
  kudosGaveText:       { color: Colors.textMuted, fontSize: 13 },
  footerActions:       { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    flex: 1, justifyContent: 'center',
    paddingVertical: 9, borderRadius: 10,
    backgroundColor: Colors.card2, borderWidth: 1, borderColor: Colors.border,
  },
  actionBtnActive:     { borderColor: '#f59e0b', backgroundColor: '#f59e0b18' },
  actionBtnText:       { color: Colors.textMuted, fontSize: 14, fontWeight: '600' },
  actionBtnTextActive: { color: '#f59e0b' },
})