import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, Modal,
  ScrollView, Animated, PanResponder, Dimensions,
} from 'react-native'
import MapView, { Polyline, Marker } from 'react-native-maps'
import { FontAwesome5 } from '@expo/vector-icons'
import { supabase } from '../services/supabase'
import { activityService, Activity, Group } from '../services/activityService'
import { formatTime, formatDate, formatPace } from '../utils/calculations'
import { Colors } from '../constants/colors'

const SCREEN_HEIGHT = Dimensions.get('window').height
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.88

function getBoundingRegion(coords: { latitude: number; longitude: number }[]) {
  if (coords.length === 0) return null
  const lats = coords.map(c => c.latitude)
  const lngs = coords.map(c => c.longitude)
  const minLat = Math.min(...lats), maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.008),
    longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.008),
  }
}

interface Profile {
  username: string
  full_name: string
  total_distance: number
  total_runs: number
  created_at?: string
}

// ─── Run Detail Bottom Sheet ──────────────────────────────────────────────────

function RunDetailSheet({
  activity,
  onClose,
}: {
  activity: Activity | null
  onClose: () => void
}) {
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current
  const lastY = useRef(0)

  useEffect(() => {
    if (activity) {
      translateY.setValue(SHEET_HEIGHT)
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start()
    }
  }, [activity])

  const close = () => {
    Animated.timing(translateY, {
      toValue: SHEET_HEIGHT,
      duration: 260,
      useNativeDriver: true,
    }).start(onClose)
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        lastY.current = 0
      },
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateY.setValue(gs.dy)
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 100 || gs.vy > 0.5) {
          close()
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }).start()
        }
      },
    })
  ).current

  if (!activity) return null

  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      {/* Backdrop */}
      <TouchableOpacity style={sheet.backdrop} activeOpacity={1} onPress={close} />

      <Animated.View style={[sheet.container, { transform: [{ translateY }] }]}>
        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={sheet.handleArea}>
          <View style={sheet.handle} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
          // Let the inner ScrollView scroll without triggering the pan responder
          onStartShouldSetResponder={() => false}
        >
          {/* ── Map ── */}
          {(() => {
            const coords = activity.route ?? []
            const region = getBoundingRegion(coords) ?? {
              latitude: 36.8065, longitude: 10.1815,
              latitudeDelta: 0.015, longitudeDelta: 0.015,
            }
            return (
              <View style={sheet.mapContainer}>
                <MapView
                  style={sheet.map}
                  region={region}
                  scrollEnabled={false}
                  zoomEnabled={false}
                  rotateEnabled={false}
                  pitchEnabled={false}
                >
                  {coords.length > 1 && (
                    <Polyline
                      coordinates={coords}
                      strokeColor={Colors.primary}
                      strokeWidth={5}
                      lineCap="round"
                      lineJoin="round"
                    />
                  )}
                  {coords.length > 0 && (
                    <Marker coordinate={coords[0]} title="Start">
                      <View style={sheet.startDot} />
                    </Marker>
                  )}
                  {coords.length > 1 && (
                    <Marker coordinate={coords[coords.length - 1]} title="Finish">
                      <View style={sheet.finishDot} />
                    </Marker>
                  )}
                </MapView>

                {/* Distance badge over map */}
                <View style={sheet.mapBadge}>
                  <Text style={sheet.mapBadgeDist}>{activity.distance.toFixed(2)}</Text>
                  <Text style={sheet.mapBadgeUnit}>km</Text>
                </View>

                {/* Close button over map */}
                <TouchableOpacity onPress={close} style={sheet.mapCloseBtn}>
                  <FontAwesome5 name="times" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            )
          })()}

          {/* ── Title / date ── */}
          <View style={sheet.header}>
            <View style={sheet.iconCircle}>
              <FontAwesome5 name="running" size={18} color={Colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={sheet.title}>{activity.title}</Text>
              <Text style={sheet.date}>{formatDate(activity.started_at)}</Text>
            </View>
          </View>

          {/* ── Main stats ── */}
          <View style={sheet.statsRow}>
            <View style={sheet.statBox}>
              <Text style={sheet.statVal}>{activity.distance.toFixed(2)}</Text>
              <Text style={sheet.statLbl}>km</Text>
            </View>
            <View style={sheet.statDivider} />
            <View style={sheet.statBox}>
              <Text style={sheet.statVal}>{formatTime(activity.duration)}</Text>
              <Text style={sheet.statLbl}>time</Text>
            </View>
            <View style={sheet.statDivider} />
            <View style={sheet.statBox}>
              <Text style={sheet.statVal}>{formatPace(activity.pace)}</Text>
              <Text style={sheet.statLbl}>pace /km</Text>
            </View>
          </View>

          {/* ── Detail rows ── */}
          <View style={sheet.detailCard}>
            <DetailRow icon="fire" label="Calories" value={`${activity.calories} kcal`} />
            <DetailRow icon="route" label="Distance" value={`${activity.distance.toFixed(2)} km`} />
            <DetailRow icon="clock" label="Duration" value={formatTime(activity.duration)} />
            <DetailRow icon="tachometer-alt" label="Avg Pace" value={`${formatPace(activity.pace)} /km`} />
          </View>
        </ScrollView>
      </Animated.View>
    </Modal>
  )
}

function DetailRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={sheet.detailRow}>
      <View style={sheet.detailIcon}>
        <FontAwesome5 name={icon} size={14} color={Colors.primary} />
      </View>
      <Text style={sheet.detailLabel}>{label}</Text>
      <Text style={sheet.detailValue}>{value}</Text>
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [joinedGroups, setJoinedGroups] = useState<Group[]>([])
  const [email, setEmail] = useState<string>('')
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null)
  const [sheetVisible, setSheetVisible] = useState(false)

  const openSheet = (a: Activity) => {
    setSelectedActivity(a)
    setSheetVisible(true)
  }
  const closeSheet = () => setSheetVisible(false)

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) setEmail(user.email)

      const [profileData, activityData, allGroups] = await Promise.all([
        activityService.getMyProfile(),
        activityService.getMyActivities(),
        activityService.getGroups(),
      ])

      if (profileData) setProfile(profileData)
      setActivities(activityData)

      // Joined groups only
      setJoinedGroups(allGroups.filter(g => g.joined))

      // Followers / following counts
      if (user?.id) {
        const [{ count: followers }, { count: following }] = await Promise.all([
          supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', user.id),
          supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', user.id),
        ])
        setFollowersCount(followers ?? 0)
        setFollowingCount(following ?? 0)
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { fetchData() }, [])

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ])
  }

  const onRefresh = () => { setRefreshing(true); fetchData() }

  const totalDistance = activities.reduce((sum, a) => sum + (a.distance ?? 0), 0)
  const totalRuns = activities.length
  const totalCalories = activities.reduce((sum, a) => sum + (a.calories ?? 0), 0)
  const bestRun = activities.length > 0 ? Math.max(...activities.map(a => a.distance)) : 0
  const avgPace = activities.length > 0
    ? activities.reduce((sum, a) => sum + (a.pace ?? 0), 0) / activities.length
    : 0

  const weeklyData = (() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const today = new Date()
    const result = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() - (6 - i))
      return { label: days[d.getDay()], date: d.toDateString(), km: 0 }
    })
    activities.forEach(a => {
      const aDate = new Date(a.started_at).toDateString()
      const slot = result.find(r => r.date === aDate)
      if (slot) slot.km += a.distance ?? 0
    })
    return result
  })()

  const joinDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  const ListHeader = () => (
    <View>
      {/* ── Profile card ── */}
      <View style={styles.profileHeader}>
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.full_name?.[0]?.toUpperCase() ?? profile?.username?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
        </View>

        <Text style={styles.fullName}>{profile?.full_name ?? 'Runner'}</Text>
        <Text style={styles.username}>@{profile?.username ?? ''}</Text>

        {/* ── Followers / Following ── */}
        <View style={styles.followRow}>
          <View style={styles.followItem}>
            <Text style={styles.followCount}>{followersCount}</Text>
            <Text style={styles.followLabel}>Followers</Text>
          </View>
          <View style={styles.followDivider} />
          <View style={styles.followItem}>
            <Text style={styles.followCount}>{followingCount}</Text>
            <Text style={styles.followLabel}>Following</Text>
          </View>
        </View>

        {/* Email */}
        {email ? (
          <View style={styles.metaRow}>
            <FontAwesome5 name="envelope" size={11} color={Colors.textMuted} />
            <Text style={styles.metaText}>{email}</Text>
          </View>
        ) : null}

        {/* Join date */}
        {joinDate ? (
          <View style={styles.metaRow}>
            <FontAwesome5 name="calendar-alt" size={11} color={Colors.textMuted} />
            <Text style={styles.metaText}>Joined {joinDate}</Text>
          </View>
        ) : null}

        {/* Primary stats */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <FontAwesome5 name="road" size={15} color={Colors.primary} />
            <Text style={styles.statValue}>{totalDistance.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Total km</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <FontAwesome5 name="flag-checkered" size={15} color={Colors.primary} />
            <Text style={styles.statValue}>{totalRuns}</Text>
            <Text style={styles.statLabel}>Runs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <FontAwesome5 name="fire" size={15} color={Colors.primary} />
            <Text style={styles.statValue}>{totalCalories.toLocaleString()}</Text>
            <Text style={styles.statLabel}>kcal</Text>
          </View>
        </View>

        {/* Secondary stats */}
        <View style={styles.secondaryRow}>
          <View style={styles.secondaryCard}>
            <FontAwesome5 name="trophy" size={13} color={Colors.primary} style={styles.secIcon} />
            <Text style={styles.secondaryValue}>{bestRun.toFixed(2)} km</Text>
            <Text style={styles.secondaryLabel}>Best run</Text>
          </View>
          <View style={styles.secondaryCard}>
            <FontAwesome5 name="tachometer-alt" size={13} color={Colors.primary} style={styles.secIcon} />
            <Text style={styles.secondaryValue}>{formatPace(avgPace)}</Text>
            <Text style={styles.secondaryLabel}>Avg pace</Text>
          </View>
          <View style={styles.secondaryCard}>
            <FontAwesome5 name="chart-line" size={13} color={Colors.primary} style={styles.secIcon} />
            <Text style={styles.secondaryValue}>
              {totalRuns ? (totalDistance / totalRuns).toFixed(1) : '0.0'} km
            </Text>
            <Text style={styles.secondaryLabel}>Avg run</Text>
          </View>
        </View>
      </View>

      {/* ── Joined Groups ── */}
      {joinedGroups.length > 0 && (
        <View style={styles.groupsSection}>
          <Text style={styles.sectionTitle}>My Groups</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupsScroll}>
            {joinedGroups.map(g => (
              <View key={g.id} style={styles.groupChip}>
                <Text style={styles.groupIcon}>{g.icon}</Text>
                <View>
                  <Text style={styles.groupName} numberOfLines={1}>{g.name}</Text>
                  <Text style={styles.groupMembers}>{g.member_count} members</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Weekly chart ── */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>This Week</Text>
        <Text style={styles.chartSubtitle}>
          {weeklyData.reduce((s, d) => s + d.km, 0).toFixed(1)} km in 7 days
        </Text>
        <View style={styles.chartBars}>
          {(() => {
            const maxKm = Math.max(...weeklyData.map(d => d.km), 0.1)
            const todayLabel = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date().getDay()]
            return weeklyData.map((day, i) => (
              <View key={i} style={styles.barCol}>
                <Text style={styles.barKm}>{day.km > 0 ? day.km.toFixed(1) : ''}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { height: `${Math.round((day.km / maxKm) * 100)}%` },
                      day.label === todayLabel && styles.barFillToday,
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, day.label === todayLabel && styles.barLabelToday]}>
                  {day.label}
                </Text>
              </View>
            ))
          })()}
        </View>
      </View>

      <Text style={styles.sectionTitle}>My Runs</Text>
    </View>
  )

  return (
    <View style={styles.container}>
      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.activityCard} onPress={() => openSheet(item)} activeOpacity={0.75}>
            <View style={styles.activityIconCircle}>
              <FontAwesome5 name="running" size={15} color={Colors.primary} />
            </View>
            <View style={styles.activityMiddle}>
              <Text style={styles.activityTitle}>{item.title}</Text>
              <Text style={styles.activityDate}>{formatDate(item.started_at)}</Text>
            </View>
            <View style={styles.activityRight}>
              <Text style={styles.activityDistance}>{item.distance.toFixed(2)} km</Text>
              <Text style={styles.activityTime}>{formatTime(item.duration)}</Text>
              {item.pace > 0 && (
                <Text style={styles.activityPace}>{formatPace(item.pace)}/km</Text>
              )}
              <FontAwesome5 name="chevron-right" size={10} color={Colors.textDim} style={{ marginTop: 4 }} />
            </View>
          </TouchableOpacity>
        )}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconCircle}>
              <FontAwesome5 name="shoe-prints" size={26} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No runs yet</Text>
            <Text style={styles.emptyText}>Start your first run and it will appear here!</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Logout */}
      <View style={styles.logoutWrapper}>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <FontAwesome5 name="sign-out-alt" size={15} color={Colors.danger} style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      {/* Run detail bottom sheet */}
      {sheetVisible && (
        <RunDetailSheet activity={selectedActivity} onClose={closeSheet} />
      )}
    </View>
  )
}

// ─── Bottom sheet styles ──────────────────────────────────────────────────────

const sheet = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  container: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: Colors.card,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
  },
  handleArea: {
    width: '100%', alignItems: 'center',
    paddingTop: 12, paddingBottom: 6,
    zIndex: 10,
    backgroundColor: Colors.card,
  },
  handle: {
    width: 44, height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },

  // Map
  mapContainer: {
    height: 220,
    position: 'relative',
  },
  map: { flex: 1 },
  mapBadge: {
    position: 'absolute',
    bottom: 14, left: 16,
    flexDirection: 'row', alignItems: 'baseline',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 12,
    gap: 4,
  },
  mapBadgeDist: { color: '#fff', fontSize: 32, fontWeight: '800' },
  mapBadgeUnit: { color: '#fff', fontSize: 16 },
  mapCloseBtn: {
    position: 'absolute',
    top: 12, right: 12,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center', alignItems: 'center',
  },
  startDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.success ?? '#22c55e',
    borderWidth: 2, borderColor: '#fff',
  },
  finishDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.danger,
    borderWidth: 2, borderColor: '#fff',
  },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  iconCircle: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.card2,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  title: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  date: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },

  statsRow: {
    flexDirection: 'row',
    margin: 16,
    backgroundColor: Colors.card2,
    borderRadius: 18,
    paddingVertical: 18,
    borderWidth: 1, borderColor: Colors.border,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statVal: { color: Colors.primary, fontSize: 22, fontWeight: '800' },
  statLbl: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  statDivider: { width: 1, backgroundColor: Colors.border },

  detailCard: {
    marginHorizontal: 16,
    backgroundColor: Colors.card2,
    borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  detailIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: Colors.card,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  detailLabel: { flex: 1, color: Colors.textMuted, fontSize: 14 },
  detailValue: { color: Colors.text, fontSize: 15, fontWeight: '600' },
})

// ─── Screen styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  profileHeader: {
    alignItems: 'center',
    paddingTop: 60, paddingBottom: 24, paddingHorizontal: 20,
    backgroundColor: Colors.card,
    borderBottomWidth: 1, borderColor: Colors.border,
    marginBottom: 8,
  },
  avatarWrap: { marginBottom: 14 },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: Colors.background,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: '800' },

  fullName: { color: Colors.text, fontSize: 22, fontWeight: '700', marginBottom: 3 },
  username: { color: Colors.textMuted, fontSize: 14, marginBottom: 12 },

  // Followers / Following
  followRow: {
    flexDirection: 'row',
    backgroundColor: Colors.card2,
    borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 14,
    width: '100%',
    marginBottom: 14,
  },
  followItem: { flex: 1, alignItems: 'center' },
  followCount: { color: Colors.primary, fontSize: 22, fontWeight: '800' },
  followLabel: { color: Colors.textMuted, fontSize: 12, marginTop: 3 },
  followDivider: { width: 1, backgroundColor: Colors.border },

  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 6,
  },
  metaText: { color: Colors.textMuted, fontSize: 13 },

  statsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card2, borderRadius: 16,
    paddingVertical: 18, width: '100%',
    borderWidth: 1, borderColor: Colors.border,
    marginTop: 16, marginBottom: 12,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 6 },
  statValue: { color: Colors.primary, fontSize: 22, fontWeight: '800' },
  statLabel: { color: Colors.textMuted, fontSize: 12 },
  statDivider: { width: 1, backgroundColor: Colors.border },

  secondaryRow: { flexDirection: 'row', gap: 10, width: '100%' },
  secondaryCard: {
    flex: 1, alignItems: 'center',
    backgroundColor: Colors.card2, borderRadius: 14,
    paddingVertical: 14, borderWidth: 1, borderColor: Colors.border,
  },
  secIcon: { marginBottom: 6 },
  secondaryValue: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  secondaryLabel: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  // Groups
  groupsSection: { marginTop: 8 },
  groupsScroll: { paddingHorizontal: 16, paddingVertical: 4, gap: 10 },
  groupChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.border,
    minWidth: 140,
  },
  groupIcon: { fontSize: 22 },
  groupName: { color: Colors.text, fontSize: 13, fontWeight: '700', maxWidth: 110 },
  groupMembers: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  sectionTitle: {
    color: Colors.text, fontSize: 18, fontWeight: '700',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10,
  },

  // Activity list
  activityCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card,
    marginHorizontal: 16, marginBottom: 10,
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  activityIconCircle: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.card2,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
    marginRight: 12,
  },
  activityMiddle: { flex: 1 },
  activityTitle: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  activityDate: { color: Colors.textMuted, fontSize: 12, marginTop: 3 },
  activityRight: { alignItems: 'flex-end' },
  activityDistance: { color: Colors.primary, fontSize: 16, fontWeight: '700' },
  activityTime: { color: Colors.textMuted, fontSize: 12, marginTop: 3 },
  activityPace: { color: Colors.textDim, fontSize: 11, marginTop: 2 },

  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 40 },
  emptyIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.card2, justifyContent: 'center',
    alignItems: 'center', marginBottom: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  emptyTitle: { color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptyText: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  chartCard: {
    backgroundColor: Colors.card,
    marginHorizontal: 16, marginTop: 8, marginBottom: 4,
    borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: Colors.border,
  },
  chartTitle: { color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 2 },
  chartSubtitle: { color: Colors.textMuted, fontSize: 12, marginBottom: 16 },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', height: 110, gap: 6 },
  barCol: { flex: 1, alignItems: 'center' },
  barKm: { color: Colors.primary, fontSize: 9, fontWeight: '700', marginBottom: 3, height: 12 },
  barTrack: {
    width: '100%', flex: 1,
    backgroundColor: Colors.card2,
    borderRadius: 6, overflow: 'hidden',
    justifyContent: 'flex-end',
    borderWidth: 1, borderColor: Colors.border,
  },
  barFill: {
    width: '100%', backgroundColor: Colors.primary,
    borderRadius: 6, minHeight: 3,
  },
  barFillToday: { backgroundColor: Colors.primary, opacity: 1 },
  barLabel: { color: Colors.textMuted, fontSize: 10, marginTop: 5 },
  barLabelToday: { color: Colors.primary, fontWeight: '700' },

  logoutWrapper: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 20, backgroundColor: Colors.background,
    borderTopWidth: 1, borderColor: Colors.border,
  },
  logoutBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: 14,
    paddingVertical: 14, borderWidth: 1, borderColor: Colors.danger,
  },
  logoutText: { color: Colors.danger, fontWeight: '700', fontSize: 16 },
})