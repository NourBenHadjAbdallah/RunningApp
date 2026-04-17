import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet,
  RefreshControl, ActivityIndicator, TouchableOpacity,
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { activityService, Activity } from '../services/activityService'
import { formatTime, formatDate } from '../utils/calculations'
import { Colors } from '../constants/colors'

export default function HomeScreen() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchActivities = useCallback(async () => {
    try {
      const data = await activityService.getFeed()
      setActivities(data)
    } catch (e) { console.error(e) }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { fetchActivities() }, [])

  const onRefresh = () => { setRefreshing(true); fetchActivities() }

  const renderItem = ({ item }: { item: Activity }) => {
    const initials = item.profiles?.username?.[0]?.toUpperCase() ?? '?'
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.username}>{item.profiles?.username ?? 'Runner'}</Text>
            <Text style={styles.date}>{formatDate(item.started_at)}</Text>
          </View>
          <View style={styles.activityBadge}>
            <FontAwesome5 name="running" size={11} color={Colors.textMuted} />
            <Text style={styles.activityBadgeText}> Run</Text>
          </View>
        </View>

        <Text style={styles.activityTitle}>{item.title}</Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{item.distance.toFixed(2)}</Text>
            <Text style={styles.statLabel}>km</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatTime(item.duration)}</Text>
            <Text style={styles.statLabel}>time</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{item.calories}</Text>
            <Text style={styles.statLabel}>kcal</Text>
          </View>
        </View>
      </View>
    )
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Feed</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <FontAwesome5 name="sync-alt" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={activities}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconCircle}>
              <FontAwesome5 name="running" size={32} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No activities yet</Text>
            <Text style={styles.emptyText}>Go for a run and your activity will appear here!</Text>
          </View>
        }
        contentContainerStyle={activities.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20,
  },
  headerTitle: { color: Colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  refreshBtn: { padding: 6 },
  card: {
    backgroundColor: Colors.card, borderRadius: 20, padding: 18,
    marginHorizontal: 16, marginBottom: 14, borderWidth: 1, borderColor: Colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.primary, justifyContent: 'center',
    alignItems: 'center', marginRight: 10,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  userInfo: { flex: 1 },
  username: { color: Colors.text, fontWeight: '600', fontSize: 15 },
  date: { color: Colors.textMuted, fontSize: 12, marginTop: 1 },
  activityBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card2, paddingHorizontal: 10,
    paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
  },
  activityBadgeText: { color: Colors.textMuted, fontSize: 12, fontWeight: '500' },
  activityTitle: { color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 16 },
  statsRow: { flexDirection: 'row', backgroundColor: Colors.card2, borderRadius: 14, paddingVertical: 12 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: Colors.primary, fontSize: 20, fontWeight: '700' },
  statLabel: { color: Colors.textMuted, fontSize: 11, marginTop: 2, letterSpacing: 0.5 },
  statDivider: { width: 1, backgroundColor: Colors.border },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  emptyIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.card2, justifyContent: 'center',
    alignItems: 'center', marginBottom: 16,
    borderWidth: 1, borderColor: Colors.border,
  },
  emptyTitle: { color: Colors.text, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: Colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22 },
})