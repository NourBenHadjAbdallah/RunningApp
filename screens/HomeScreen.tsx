import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet,
  RefreshControl, ActivityIndicator, TouchableOpacity,
  ScrollView, Alert,
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { activityService, Activity, Group, RunEvent } from '../services/activityService'
import { myeventsService, Event as TunisianEvent } from '../services/myeventsService'
import { Image, Linking } from 'react-native'
import { formatTime, formatDate } from '../utils/calculations'
import { Colors } from '../constants/colors'

type FeedTab = 'activity' | 'groups' | 'events'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<Group['category'], string> = {
  running: Colors.primary,
  trail: Colors.success,
  marathon: '#f59e0b',
  casual: '#6366f1',
}

const EVENT_TYPE_META: Record<RunEvent['type'], { label: string; color: string; icon: string }> = {
  race:      { label: 'Race',      color: Colors.danger,  icon: 'trophy' },
  group_run: { label: 'Group Run', color: Colors.primary, icon: 'users'  },
  virtual:   { label: 'Virtual',   color: '#6366f1',      icon: 'globe'  },
}

function formatEventDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatEventTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function daysUntil(iso: string) {
  const diff = new Date(iso).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

// ─── Activity Card ────────────────────────────────────────────────────────────

interface ActivityCardProps {
  item: Activity
  kudosed: boolean
  onKudos: (id: string, currently: boolean) => void
}

function ActivityCard({ item, kudosed, onKudos }: ActivityCardProps) {
  const initials = (item.profiles as any)?.username?.[0]?.toUpperCase() ?? '?'
  const kudos = (item.kudos_count ?? 0) + (kudosed ? 1 : 0)
  const groupName = (item.groups as any)?.name

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.username}>{(item.profiles as any)?.username ?? 'Runner'}</Text>
          <View style={styles.subRow}>
            {groupName && (
              <>
                <FontAwesome5 name="users" size={10} color={Colors.primary} />
                <Text style={styles.groupTag}> {groupName} · </Text>
              </>
            )}
            <Text style={styles.date}>{formatDate(item.started_at)}</Text>
          </View>
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

      <View style={styles.cardFooter}>
        <TouchableOpacity
          style={styles.kudosBtn}
          onPress={() => onKudos(item.id, kudosed)}
          activeOpacity={0.75}
        >
          <FontAwesome5 name="bolt" size={13} color={kudosed ? '#f59e0b' : Colors.textMuted} solid={kudosed} />
          <Text style={[styles.kudosText, kudosed && styles.kudosActive]}>
            {kudos > 0 ? `${kudos} Kudos` : 'Give Kudos'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.commentBtn}>
          <FontAwesome5 name="comment" size={13} color={Colors.textMuted} />
          <Text style={styles.commentText}>
            {item.comment_count ? `${item.comment_count}` : 'Comment'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ─── Group Card ───────────────────────────────────────────────────────────────

function GroupCard({ group, onToggle }: { group: Group; onToggle: (g: Group) => void }) {
  const accent = CATEGORY_COLORS[group.category]
  return (
    <View style={styles.groupCard}>
      <View style={[styles.groupIconCircle, { borderColor: accent }]}>
        <FontAwesome5 name={group.icon as any} size={18} color={accent} />
      </View>
      <View style={styles.groupInfo}>
        <Text style={styles.groupName}>{group.name}</Text>
        {group.description ? (
          <Text style={styles.groupDesc} numberOfLines={2}>{group.description}</Text>
        ) : null}
        <View style={styles.groupMeta}>
          <FontAwesome5 name="users" size={11} color={Colors.textMuted} />
          <Text style={styles.groupMetaText}> {group.member_count} members</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.joinBtn, group.joined && styles.joinBtnJoined]}
        onPress={() => onToggle(group)}
        activeOpacity={0.8}
      >
        <Text style={[styles.joinBtnText, group.joined && styles.joinBtnTextJoined]}>
          {group.joined ? 'Joined' : 'Join'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ event, onToggle }: { event: RunEvent; onToggle: (e: RunEvent) => void }) {
  const meta = EVENT_TYPE_META[event.type]
  const days = daysUntil(event.event_date)
  const spotsLeft = event.spots_total != null
    ? Math.max(0, event.spots_total - (event.rsvp_count ?? 0))
    : null

  return (
    <View style={styles.eventCard}>
      <View style={styles.eventTop}>
        <View style={[styles.eventTypeBadge, { borderColor: meta.color }]}>
          <FontAwesome5 name={meta.icon as any} size={10} color={meta.color} />
          <Text style={[styles.eventTypeText, { color: meta.color }]}>{meta.label}</Text>
        </View>
        <Text style={[styles.daysLeft, days <= 3 && { color: Colors.danger }]}>
          {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`}
        </Text>
      </View>

      <Text style={styles.eventTitle}>{event.title}</Text>
      {event.description ? (
        <Text style={styles.eventDesc} numberOfLines={2}>{event.description}</Text>
      ) : null}

      <View style={styles.eventMeta}>
        <View style={styles.eventMetaItem}>
          <FontAwesome5 name="calendar" size={11} color={Colors.textMuted} />
          <Text style={styles.eventMetaText}>{formatEventDate(event.event_date)}</Text>
        </View>
        {event.type !== 'virtual' && (
          <View style={styles.eventMetaItem}>
            <FontAwesome5 name="clock" size={11} color={Colors.textMuted} />
            <Text style={styles.eventMetaText}>{formatEventTime(event.event_date)}</Text>
          </View>
        )}
        {event.location && (
          <View style={styles.eventMetaItem}>
            <FontAwesome5 name="map-marker-alt" size={11} color={Colors.textMuted} />
            <Text style={styles.eventMetaText}>{event.location}</Text>
          </View>
        )}
        {event.distance_km && (
          <View style={styles.eventMetaItem}>
            <FontAwesome5 name="road" size={11} color={Colors.textMuted} />
            <Text style={styles.eventMetaText}>{event.distance_km} km</Text>
          </View>
        )}
      </View>

      <View style={styles.eventFooter}>
        <View>
          {event.organizer ? (
            <Text style={styles.eventOrganizer}>by {event.organizer}</Text>
          ) : null}
          {spotsLeft !== null && spotsLeft <= 10 && (
            <Text style={styles.spotsText}>{spotsLeft} spots left!</Text>
          )}
          <Text style={styles.rsvpCount}>{event.rsvp_count ?? 0} going</Text>
        </View>
        <TouchableOpacity
          style={[styles.goingBtn, event.going && styles.goingBtnActive]}
          onPress={() => onToggle(event)}
          activeOpacity={0.8}
        >
          <FontAwesome5 name={event.going ? 'check' : 'plus'} size={11} color={event.going ? '#fff' : Colors.primary} />
          <Text style={[styles.goingBtnText, event.going && styles.goingBtnTextActive]}>
            {event.going ? "I'm going" : 'Join'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [tab, setTab] = useState<FeedTab>('activity')

  // Activity feed
  const [activities, setActivities] = useState<Activity[]>([])
  const [kudosedIds, setKudosedIds] = useState<Set<string>>(new Set())
  const [feedLoading, setFeedLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Groups
  const [groups, setGroups] = useState<Group[]>([])
  const [groupsLoading, setGroupsLoading] = useState(true)

  // Events (live from myevents.tn)
  const [events, setEvents] = useState<TunisianEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventsError, setEventsError] = useState<string | null>(null)

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadFeed = useCallback(async () => {
    try {
      const data = await activityService.getFriendsFeed()
      setActivities(data)
      // Fetch which ones the current user has kudosed
      const ids = data.map((a) => a.id)
      const kudosed = await activityService.getMyKudos(ids)
      setKudosedIds(kudosed)
    } catch (e) {
      console.error('Feed error:', e)
    }
    setFeedLoading(false)
    setRefreshing(false)
  }, [])

  const loadGroups = useCallback(async () => {
    try {
      const data = await activityService.getGroups()
      setGroups(data)
    } catch (e) {
      console.error('Groups error:', e)
    }
    setGroupsLoading(false)
  }, [])

  const loadEvents = useCallback(async () => {
    setEventsError(null)
    try {
      const data = await myeventsService.getUpcomingEvents()
      setEvents(data)
    } catch (e: any) {
      console.error('Events error:', e)
      setEventsError(e.message ?? 'Failed to load events')
    }
    setEventsLoading(false)
  }, [])

  useEffect(() => {
    loadFeed()
    loadGroups()
    loadEvents()
  }, [])

  const onRefresh = () => {
    setRefreshing(true)
    loadFeed()
    loadGroups()
    loadEvents()
  }

  // ── Kudos toggle ───────────────────────────────────────────────────────────

  const handleKudos = async (activityId: string, currently: boolean) => {
    // Optimistic update
    setKudosedIds((prev) => {
      const next = new Set(prev)
      currently ? next.delete(activityId) : next.add(activityId)
      return next
    })
    try {
      if (currently) {
        await activityService.removeKudos(activityId)
      } else {
        await activityService.giveKudos(activityId)
      }
    } catch {
      // Revert on error
      setKudosedIds((prev) => {
        const next = new Set(prev)
        currently ? next.add(activityId) : next.delete(activityId)
        return next
      })
    }
  }

  // ── Group toggle ───────────────────────────────────────────────────────────

  const handleGroupToggle = async (group: Group) => {
    // Optimistic update
    setGroups((prev) =>
      prev.map((g) =>
        g.id === group.id
          ? { ...g, joined: !g.joined, member_count: g.joined ? g.member_count - 1 : g.member_count + 1 }
          : g
      )
    )
    try {
      if (group.joined) {
        await activityService.leaveGroup(group.id)
      } else {
        await activityService.joinGroup(group.id)
      }
    } catch (e: any) {
      Alert.alert('Error', e.message)
      // Revert
      setGroups((prev) =>
        prev.map((g) =>
          g.id === group.id
            ? { ...g, joined: group.joined, member_count: group.member_count }
            : g
        )
      )
    }
  }



  // ── Render ─────────────────────────────────────────────────────────────────

  const TABS: { key: FeedTab; label: string; icon: string }[] = [
    { key: 'activity', label: 'Activity', icon: 'running' },
    { key: 'groups',   label: 'Groups',   icon: 'users' },
    { key: 'events',   label: 'Events',   icon: 'calendar-alt' },
  ]

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Feed</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <FontAwesome5 name="sync-alt" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabBar}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.8}
          >
            <FontAwesome5 name={t.icon as any} size={13} color={tab === t.key ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.tabLabel, tab === t.key && styles.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Activity tab ── */}
      {tab === 'activity' && (
        feedLoading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
        ) : (
          <FlatList
            data={activities}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ActivityCard
                item={item}
                kudosed={kudosedIds.has(item.id)}
                onKudos={handleKudos}
              />
            )}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <View style={styles.emptyIconCircle}>
                  <FontAwesome5 name="user-friends" size={32} color={Colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>No activity yet</Text>
                <Text style={styles.emptyText}>Follow friends or join a group to see their runs here!</Text>
              </View>
            }
            contentContainerStyle={activities.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          />
        )
      )}

      {/* ── Groups tab ── */}
      {tab === 'groups' && (
        groupsLoading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {groups.filter((g) => g.joined).length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Your Groups</Text>
                {groups.filter((g) => g.joined).map((g) => (
                  <GroupCard key={g.id} group={g} onToggle={handleGroupToggle} />
                ))}
              </>
            )}
            <Text style={styles.sectionLabel}>
              {groups.filter((g) => g.joined).length > 0 ? 'Discover Groups' : 'All Groups'}
            </Text>
            {groups.filter((g) => !g.joined).length === 0 && groups.filter((g) => g.joined).length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIconCircle}>
                  <FontAwesome5 name="users" size={28} color={Colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>No groups yet</Text>
                <Text style={styles.emptyText}>Groups will appear here once created.</Text>
              </View>
            ) : (
              groups.filter((g) => !g.joined).map((g) => (
                <GroupCard key={g.id} group={g} onToggle={handleGroupToggle} />
              ))
            )}
          </ScrollView>
        )
      )}

      {/* ── Events tab (live from myevents.tn) ── */}
      {tab === 'events' && (
        eventsLoading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
        ) : eventsError ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconCircle}>
              <FontAwesome5 name="exclamation-circle" size={28} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Could not load events</Text>
            <Text style={styles.emptyText}>{eventsError}</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
            <View style={styles.eventsHeader}>
              <Text style={styles.sectionLabel}>🇹🇳 Upcoming Races</Text>
              <Text style={styles.eventsSource}>myevents.tn</Text>
            </View>
            {events.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIconCircle}>
                  <FontAwesome5 name="calendar-alt" size={28} color={Colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>No upcoming events</Text>
                <Text style={styles.emptyText}>Check back soon for races near you.</Text>
              </View>
            ) : (
              events.map((event, i) => {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                const eventDate = new Date(event.date)
                const days = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                const formattedDate = eventDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
                const isVerySoon = days <= 7

                return (
                  <TouchableOpacity
                    key={i}
                    style={styles.tunisianEventCard}
                    onPress={() => Linking.openURL(event.url)}
                    activeOpacity={0.85}
                  >
                    {event.image ? (
                      <Image source={{ uri: event.image }} style={styles.tunisianEventImage} resizeMode="cover" />
                    ) : (
                      <View style={[styles.tunisianEventImage, styles.tunisianEventImagePlaceholder]}>
                        <FontAwesome5 name="running" size={24} color={Colors.textMuted} />
                      </View>
                    )}
                    <View style={[styles.tunisianCountdown, isVerySoon ? styles.tunisianCountdownSoon : styles.tunisianCountdownNormal]}>
                      <Text style={styles.tunisianCountdownText}>
                        {days === 0 ? 'TODAY' : days === 1 ? 'TOMORROW' : `${days}d`}
                      </Text>
                    </View>
                    <View style={styles.tunisianEventInfo}>
                      <Text style={styles.tunisianEventTitle} numberOfLines={2}>{event.title}</Text>
                      {event.location ? (
                        <View style={styles.tunisianMetaRow}>
                          <FontAwesome5 name="map-marker-alt" size={11} color={Colors.primary} />
                          <Text style={styles.tunisianLocation} numberOfLines={1}>{event.location}</Text>
                        </View>
                      ) : null}
                      <View style={styles.tunisianMetaRow}>
                        <FontAwesome5 name="calendar-alt" size={11} color={Colors.textMuted} />
                        <Text style={styles.tunisianDate}>{formattedDate}</Text>
                      </View>
                      <View style={styles.tunisianFooter}>
                        <Text style={styles.tunisianRegister}>View & Register</Text>
                        <FontAwesome5 name="external-link-alt" size={10} color={Colors.primary} />
                      </View>
                    </View>
                  </TouchableOpacity>
                )
              })
            )}
          </ScrollView>
        )
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 60, paddingBottom: 12, paddingHorizontal: 20,
  },
  headerTitle: { color: Colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  refreshBtn: { padding: 6 },

  tabBar: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 14,
    backgroundColor: Colors.card, borderRadius: 14, padding: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 11,
  },
  tabBtnActive: { backgroundColor: Colors.card2 },
  tabLabel: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  tabLabelActive: { color: Colors.primary },

  sectionLabel: {
    color: Colors.text, fontSize: 16, fontWeight: '700',
    paddingHorizontal: 20, marginTop: 12, marginBottom: 10,
  },

  // Activity card
  card: {
    backgroundColor: Colors.card, borderRadius: 20, padding: 18,
    marginHorizontal: 16, marginBottom: 14, borderWidth: 1, borderColor: Colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: 10,
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  userInfo: { flex: 1 },
  username: { color: Colors.text, fontWeight: '600', fontSize: 15 },
  subRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  groupTag: { color: Colors.primary, fontSize: 12 },
  date: { color: Colors.textMuted, fontSize: 12 },
  activityBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card2, paddingHorizontal: 10,
    paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
  },
  activityBadgeText: { color: Colors.textMuted, fontSize: 12, fontWeight: '500' },
  activityTitle: { color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 14 },
  statsRow: { flexDirection: 'row', backgroundColor: Colors.card2, borderRadius: 14, paddingVertical: 12 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: Colors.primary, fontSize: 20, fontWeight: '700' },
  statLabel: { color: Colors.textMuted, fontSize: 11, marginTop: 2, letterSpacing: 0.5 },
  statDivider: { width: 1, backgroundColor: Colors.border },
  cardFooter: {
    flexDirection: 'row', gap: 10, marginTop: 14,
    paddingTop: 12, borderTopWidth: 1, borderColor: Colors.border,
  },
  kudosBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.card2, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border, flex: 1, justifyContent: 'center',
  },
  kudosText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  kudosActive: { color: '#f59e0b' },
  commentBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.card2, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border, flex: 1, justifyContent: 'center',
  },
  commentText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },

  // Group card
  groupCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: 18,
    marginHorizontal: 16, marginBottom: 10,
    padding: 16, borderWidth: 1, borderColor: Colors.border,
  },
  groupIconCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.card2, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, marginRight: 12,
  },
  groupInfo: { flex: 1, marginRight: 10 },
  groupName: { color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 3 },
  groupDesc: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 5 },
  groupMeta: { flexDirection: 'row', alignItems: 'center' },
  groupMetaText: { color: Colors.textMuted, fontSize: 12 },
  joinBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: Colors.primary },
  joinBtnJoined: { backgroundColor: Colors.primary },
  joinBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  joinBtnTextJoined: { color: '#fff' },

  // Event card
  eventCard: {
    backgroundColor: Colors.card, borderRadius: 18,
    marginHorizontal: 16, marginBottom: 12,
    padding: 16, borderWidth: 1, borderColor: Colors.border,
  },
  eventTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  eventTypeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4,
  },
  eventTypeText: { fontSize: 11, fontWeight: '700' },
  daysLeft: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  spotsText: { color: Colors.danger, fontSize: 11, fontWeight: '600', marginTop: 2 },
  eventTitle: { color: Colors.text, fontSize: 17, fontWeight: '700', marginBottom: 5 },
  eventDesc: { color: Colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 12 },
  eventMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  eventMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  eventMetaText: { color: Colors.textMuted, fontSize: 12 },
  eventFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderColor: Colors.border, paddingTop: 12,
  },
  eventOrganizer: { color: Colors.textMuted, fontSize: 12 },
  rsvpCount: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  goingBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1.5, borderColor: Colors.primary,
  },
  goingBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  goingBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  goingBtnTextActive: { color: '#fff' },

  // Empty
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingVertical: 48 },
  emptyIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.card2, justifyContent: 'center', alignItems: 'center',
    marginBottom: 16, borderWidth: 1, borderColor: Colors.border,
  },
  emptyTitle: { color: Colors.text, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: Colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  // Tunisian events
  eventsHeader: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, paddingRight: 20 },
  eventsSource: { color: Colors.textMuted, fontSize: 11 },
  tunisianEventCard: {
    backgroundColor: Colors.card, borderRadius: 18,
    marginHorizontal: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' as const,
  },
  tunisianEventImage: { width: '100%', height: 150 },
  tunisianEventImagePlaceholder: {
    backgroundColor: Colors.card2, justifyContent: 'center' as const, alignItems: 'center' as const,
  },
  tunisianCountdown: {
    position: 'absolute' as const, top: 10, right: 10,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  tunisianCountdownSoon: { backgroundColor: Colors.danger },
  tunisianCountdownNormal: { backgroundColor: 'rgba(0,0,0,0.65)' },
  tunisianCountdownText: { color: '#fff', fontSize: 11, fontWeight: '800' as const },
  tunisianEventInfo: { padding: 14, gap: 6 },
  tunisianEventTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' as const, lineHeight: 20 },
  tunisianMetaRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 7 },
  tunisianLocation: { color: Colors.primary, fontSize: 12, flex: 1 },
  tunisianDate: { color: Colors.textMuted, fontSize: 12 },
  tunisianFooter: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, marginTop: 4 },
  tunisianRegister: { color: Colors.primary, fontSize: 12, fontWeight: '700' as const },
})