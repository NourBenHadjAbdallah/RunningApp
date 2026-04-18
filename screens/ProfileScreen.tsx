import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { supabase } from '../services/supabase'
import { activityService, Activity } from '../services/activityService'
import { formatTime, formatDate, formatPace } from '../utils/calculations'
import { Colors } from '../constants/colors'

interface Profile {
  username: string
  full_name: string
  total_distance: number
  total_runs: number
  created_at?: string
}

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [email, setEmail] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      // Fetch auth user for email + join date
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) setEmail(user.email)

      const [profileData, activityData] = await Promise.all([
        activityService.getMyProfile(),
        activityService.getMyActivities(),
      ])
      if (profileData) setProfile(profileData)
      setActivities(activityData)
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

  // Derive ALL stats from real activity data (not the RPC-cached profile columns
  // which only update when increment_stats succeeds)
  const totalDistance = activities.reduce((sum, a) => sum + (a.distance ?? 0), 0)
  const totalRuns = activities.length
  const totalCalories = activities.reduce((sum, a) => sum + (a.calories ?? 0), 0)
  const bestRun = activities.length > 0 ? Math.max(...activities.map(a => a.distance)) : 0
  const avgPace = activities.length > 0
    ? activities.reduce((sum, a) => sum + (a.pace ?? 0), 0) / activities.length
    : 0

  // Weekly chart — last 7 days, distance per day
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
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile?.full_name?.[0]?.toUpperCase() ?? profile?.username?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
        </View>

        <Text style={styles.fullName}>{profile?.full_name ?? 'Runner'}</Text>
        <Text style={styles.username}>@{profile?.username ?? ''}</Text>

        {/* Email row */}
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

        {/* ── Primary stats ── */}
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

        {/* ── Secondary stats ── */}
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


      {/* ── Weekly Distance Chart ── */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>This Week</Text>
        <Text style={styles.chartSubtitle}>
          {weeklyData.reduce((s, d) => s + d.km, 0).toFixed(1)} km in 7 days
        </Text>
        <View style={styles.chartBars}>
          {(() => {
            const maxKm = Math.max(...weeklyData.map(d => d.km), 0.1)
            const todayLabel = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()]
            return weeklyData.map((day, i) => (
              <View key={i} style={styles.barCol}>
                <Text style={styles.barKm}>
                  {day.km > 0 ? day.km.toFixed(1) : ''}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      { height: `${Math.round((day.km / maxKm) * 100)}%` },
                      day.label === todayLabel && styles.barFillToday,
                    ]}
                  />
                </View>
                <Text style={[
                  styles.barLabel,
                  day.label === todayLabel && styles.barLabelToday,
                ]}>
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
          <View style={styles.activityCard}>
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
            </View>
          </View>
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
    </View>
  )
}

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

  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 6,
  },
  metaText: { color: Colors.textMuted, fontSize: 13 },

  // Primary stats
  statsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card2, borderRadius: 16,
    paddingVertical: 18, width: '100%',
    borderWidth: 1, borderColor: Colors.border,
    marginTop: 20, marginBottom: 12,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 6 },
  statValue: { color: Colors.primary, fontSize: 22, fontWeight: '800' },
  statLabel: { color: Colors.textMuted, fontSize: 12 },
  statDivider: { width: 1, backgroundColor: Colors.border },

  // Secondary stats
  secondaryRow: { flexDirection: 'row', gap: 10, width: '100%' },
  secondaryCard: {
    flex: 1, alignItems: 'center',
    backgroundColor: Colors.card2, borderRadius: 14,
    paddingVertical: 14, borderWidth: 1, borderColor: Colors.border,
  },
  secIcon: { marginBottom: 6 },
  secondaryValue: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  secondaryLabel: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  sectionTitle: {
    color: Colors.text, fontSize: 18, fontWeight: '700',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 10,
  },

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


  // Weekly chart
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