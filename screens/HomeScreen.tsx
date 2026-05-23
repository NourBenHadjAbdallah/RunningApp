// screens/HomeScreen.tsx
//
// File breakdown:
//   - ActivityCard   — display only, inline (no state)
//   - GroupCard      — display only, inline (no state)
//   - EventCard      — display only, inline (no state)
//   - CreateGroupSheet — extracted to components/home/CreateGroupSheet.tsx
//     (owns PanResponder, spring animation, image upload, Supabase insert)

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, FlatList, StyleSheet,
  RefreshControl, ActivityIndicator, TouchableOpacity,
  ScrollView, Alert, Image, Linking, TextInput, Modal,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { router } from 'expo-router'
import { activityService, Activity, Group, RunEvent } from '../services/activityService'
import { myeventsService, Event as TunisianEvent } from '../services/myeventsService'
import { supabase } from '../services/supabase'
import { formatTime } from '../utils/calculations'
import { Colors } from '../constants/colors'
import CreateGroupSheet from '../components/Home/CreateGroupSheet'
import MapView, { Polyline, Marker } from 'react-native-maps'

// ─── Types ────────────────────────────────────────────────────────────────────

type FeedTab = 'activity' | 'groups' | 'events'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
}

// ─── Activity Card ────────────────────────────────────────────────────────────

interface Comment {
  id: string
  user_id: string
  body: string
  created_at: string
  profiles?: { username: string; full_name?: string | null; avatar_url?: string | null }
}

interface KudosGiver {
  user_id: string
  profiles?: { username: string; full_name?: string | null; avatar_url?: string | null }
}

function AvatarBubble({ url, name, size = 22 }: { url?: string | null; name: string; size?: number }) {
  if (url) {
    return <Image source={{ uri: url }} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: Colors.card }} />
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.card }}>
      <Text style={{ color: '#fff', fontSize: size * 0.45, fontWeight: '700' }}>{name[0]?.toUpperCase() ?? '?'}</Text>
    </View>
  )
}

interface ActivityCardProps {
  item: Activity
  kudosed: boolean
  onKudos: (id: string, currently: boolean) => void
  currentUserId: string | null
}

// Helper to normalise the `profiles` field returned by Supabase.
// PostgREST types a joined relation as an array in its generated types even
// when it returns a single object at runtime. This unwraps that array so our
// Comment / KudosGiver interfaces stay clean.
function normaliseProfiles<T extends { profiles?: unknown }>(rows: T[]): T[] {
  return rows.map((row) => ({
    ...row,
    profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? undefined : row.profiles,
  }))
}

function ActivityCard({ item, kudosed, onKudos, currentUserId }: ActivityCardProps) {
  const profile   = item.profiles as any
  const username  = profile?.full_name?.trim() || profile?.username?.trim() || 'Runner'
  const avatarUrl = profile?.avatar_url as string | null
  const initials  = username[0]?.toUpperCase() ?? '?'
  const kudos     = (item.kudos_count ?? 0) + (kudosed ? 1 : 0)
  const groupName = (item.groups as any)?.name

  // ── Comment sheet state ────────────────────────────────────────────────────
  const [commentOpen,    setCommentOpen]    = useState(false)
  const [comments,       setComments]       = useState<Comment[]>([])
  const [commentText,    setCommentText]    = useState('')
  const [commenting,     setCommenting]     = useState(false)
  const [commentsLoaded, setCommentsLoaded] = useState(false)

  // ── Kudos givers state ─────────────────────────────────────────────────────
  const [kudosGivers, setKudosGivers] = useState<KudosGiver[]>([])
  const [kudosLoaded, setKudosLoaded] = useState(false)

  React.useEffect(() => {
    if (kudos > 0 && !kudosLoaded) {
      supabase
        .from('kudos')
        .select('user_id, profiles:profiles(username, full_name, avatar_url)')
        .eq('activity_id', item.id)
        .limit(5)
        .then(({ data }) => {
          if (data) setKudosGivers(normaliseProfiles(data) as unknown as KudosGiver[])
          setKudosLoaded(true)
        })
    }
  }, [kudos])

  const loadComments = async () => {
    const { data } = await supabase
      .from('comments')
      .select('id, user_id, body, created_at, profiles:profiles(username, full_name, avatar_url)')
      .eq('activity_id', item.id)
      .order('created_at', { ascending: true })
    if (data) setComments(normaliseProfiles(data) as unknown as Comment[])
    setCommentsLoaded(true)
  }

  const openComments = () => {
    setCommentOpen(true)
    if (!commentsLoaded) loadComments()
  }

  const submitComment = async () => {
    const text = commentText.trim()
    if (!text) return
    setCommenting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('comments')
        .insert({ activity_id: item.id, user_id: user.id, body: text })
        .select('id, user_id, body, created_at, profiles:profiles(username, full_name, avatar_url)')
        .single()
      if (error) throw error
      const normalised = normaliseProfiles([data])[0] as unknown as Comment
      setComments(prev => [...prev, normalised])
      setCommentText('')
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not post comment.')
    } finally {
      setCommenting(false)
    }
  }

  const goToDetail  = () => router.push({ pathname: '/(tabs)/activity', params: { id: item.id, source: 'home' } })
  const goToProfile = () => {
    if (item.user_id === currentUserId) {
      router.push('/(tabs)/profile')
    } else {
      router.push(`/profile/${item.user_id}` as any)
    }
  }

  const dateObj     = new Date(item.started_at)
  const datePart    = dateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const timePart    = dateObj.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  const dateDisplay = `${datePart} at ${timePart}`

  const paceMin = Math.floor(item.pace)
  const paceSec = Math.round((item.pace - paceMin) * 60)
  const paceStr = item.pace > 0 ? `${paceMin}'${paceSec.toString().padStart(2, '0')}" /km` : '--'

  const commentCount = comments.length > 0 ? comments.length : (item.comment_count ?? 0)

  return (
    <View style={styles.card}>
      {/* Header: avatar + name + date */}
      <View style={styles.cardHeader}>
        <TouchableOpacity style={styles.avatarWrap} onPress={goToProfile} activeOpacity={0.8}>
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
        </TouchableOpacity>

        <TouchableOpacity style={styles.userInfo} onPress={goToProfile} activeOpacity={0.8}>
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
        </TouchableOpacity>

        <TouchableOpacity style={styles.moreBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <FontAwesome5 name="ellipsis-h" size={14} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Title */}
      <TouchableOpacity onPress={goToDetail} activeOpacity={0.8}>
        <Text style={styles.activityTitle}>{item.title}</Text>
      </TouchableOpacity>

      {/* Stats row */}
      <TouchableOpacity onPress={goToDetail} activeOpacity={0.8}>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Distance</Text>
            <Text style={styles.statValue}>
              {item.distance.toFixed(2)} <Text style={styles.statUnit}>km</Text>
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
      </TouchableOpacity>

      {/* Route map */}
      {item.route && item.route.length > 1 && (() => {
        const coords = item.route
        const lats = coords.map(c => c.latitude)
        const lngs = coords.map(c => c.longitude)
        const region = {
          latitude:      (Math.min(...lats) + Math.max(...lats)) / 2,
          longitude:     (Math.min(...lngs) + Math.max(...lngs)) / 2,
          latitudeDelta:  Math.max((Math.max(...lats) - Math.min(...lats)) * 1.5, 0.008),
          longitudeDelta: Math.max((Math.max(...lngs) - Math.min(...lngs)) * 1.5, 0.008),
        }
        return (
          <TouchableOpacity onPress={goToDetail} activeOpacity={0.85} style={styles.mapContainer}>
            <MapView
              style={styles.map}
              region={region}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              userInterfaceStyle="dark"
              pointerEvents="none"
            >
              <Polyline
                coordinates={coords}
                strokeColor={Colors.primary}
                strokeWidth={4}
                lineCap="round"
                lineJoin="round"
              />
              <Marker coordinate={coords[0]} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.startDot} />
              </Marker>
              <Marker coordinate={coords[coords.length - 1]} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.finishDot} />
              </Marker>
            </MapView>
          </TouchableOpacity>
        )
      })()}

      {/* Footer: kudos givers + action buttons */}
      <View style={styles.cardFooter}>
        {kudos > 0 && (
          <View style={styles.kudosAvatarsRow}>
            {kudosGivers.slice(0, 5).map((kg, idx) => {
              const p = kg.profiles as any
              const n = p?.full_name?.trim() || p?.username?.trim() || '?'
              return (
                <View key={kg.user_id} style={[styles.kudosBubble, { marginLeft: idx === 0 ? 0 : -7, zIndex: 5 - idx }]}>
                  <AvatarBubble url={p?.avatar_url} name={n} size={24} />
                </View>
              )
            })}
            {kudosLoaded && kudosGivers.length === 0 && <View style={styles.kudosAvatarDot} />}
            <Text style={styles.kudosGaveText}>
              {kudos} {kudos === 1 ? 'person' : 'people'} gave kudos
            </Text>
          </View>
        )}
        <View style={styles.footerActions}>
          <TouchableOpacity
            style={[styles.actionBtn, kudosed && styles.actionBtnActive]}
            onPress={() => onKudos(item.id, kudosed)}
            activeOpacity={0.75}
          >
            <FontAwesome5 name="bolt" size={14} color={kudosed ? '#f59e0b' : Colors.textMuted} solid={kudosed} />
            <Text style={[styles.actionBtnText, kudosed && styles.actionBtnTextActive]}>Kudos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} activeOpacity={0.75} onPress={openComments}>
            <FontAwesome5 name="comment" size={14} color={commentOpen ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.actionBtnText, commentOpen && { color: Colors.primary }]}>
              {commentCount > 0 ? `${commentCount} Comment${commentCount > 1 ? 's' : ''}` : 'Comment'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Inline comment section */}
      {commentOpen && (
        <View style={styles.commentSection}>
          {/* Existing comments */}
          {!commentsLoaded ? (
            <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 12 }} />
          ) : comments.length === 0 ? (
            <Text style={styles.noCommentsText}>No comments yet. Be the first!</Text>
          ) : (
            comments.map(c => {
              const cp = c.profiles as any
              const cn = cp?.full_name?.trim() || cp?.username?.trim() || 'Runner'
              const cDate = new Date(c.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
              return (
                <View key={c.id} style={styles.commentRow}>
                  <AvatarBubble url={cp?.avatar_url} name={cn} size={30} />
                  <View style={styles.commentBubble}>
                    <View style={styles.commentMeta}>
                      <Text style={styles.commentAuthor}>{cn}</Text>
                      <Text style={styles.commentTime}>{cDate}</Text>
                    </View>
                    <Text style={styles.commentText}>{c.body}</Text>
                  </View>
                </View>
              )
            })
          )}

          {/* Input row */}
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder="Write a comment..."
              placeholderTextColor={Colors.textMuted}
              value={commentText}
              onChangeText={setCommentText}
              multiline
              maxLength={300}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!commentText.trim() || commenting) && styles.sendBtnDisabled]}
              onPress={submitComment}
              disabled={!commentText.trim() || commenting}
              activeOpacity={0.75}
            >
              {commenting
                ? <ActivityIndicator size="small" color="#fff" />
                : <FontAwesome5 name="paper-plane" size={13} color="#fff" />
              }
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  )
}
// ─── Group Card ───────────────────────────────────────────────────────────────

function GroupCard({ group, onToggle }: { group: Group; onToggle: (g: Group) => void }) {
  return (
    <TouchableOpacity
      style={styles.groupCard}
      activeOpacity={0.75}
      onPress={() => router.push({ pathname: '/(tabs)/group-detail', params: { id: group.id } })}
    >
      {(group as any).image_url ? (
        <Image source={{ uri: (group as any).image_url }} style={styles.groupImage} resizeMode="cover" />
      ) : (
        <View style={styles.groupImageFallback}>
          <FontAwesome5 name="users" size={20} color={Colors.textMuted} />
        </View>
      )}
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
        onPress={() => router.push({ pathname: '/(tabs)/group-detail', params: { id: group.id } })}
      >
        <FontAwesome5
          name={group.joined ? 'check' : 'plus'}
          size={11}
          color={group.joined ? '#fff' : Colors.primary}
          style={{ marginRight: 4 }}
        />
        <Text style={[styles.joinBtnText, group.joined && styles.joinBtnTextJoined]}>
          {group.joined ? 'Joined' : 'Join'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
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
          {event.organizer ? <Text style={styles.eventOrganizer}>by {event.organizer}</Text> : null}
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

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIconCircle}>
        <FontAwesome5 name={icon as any} size={28} color={Colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

const TABS: { key: FeedTab; label: string; icon: string }[] = [
  { key: 'activity', label: 'Activity', icon: 'running' },
  { key: 'groups',   label: 'Groups',   icon: 'users' },
  { key: 'events',   label: 'Events',   icon: 'calendar-alt' },
]

export default function HomeScreen() {
  const [tab, setTab] = useState<FeedTab>('activity')

  // Activity
  const [activities,   setActivities]   = useState<Activity[]>([])
  const [kudosedIds,   setKudosedIds]   = useState<Set<string>>(new Set())
  const [feedLoading,  setFeedLoading]  = useState(true)
  const [refreshing,   setRefreshing]   = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // Groups
  const [groups,           setGroups]           = useState<Group[]>([])
  const [groupsLoading,    setGroupsLoading]    = useState(true)
  const [showCreateGroup,  setShowCreateGroup]  = useState(false)
  const [groupsSubTab,     setGroupsSubTab]     = useState<'feed' | 'discover'>('feed')

  // Group feed
  const [groupFeed,        setGroupFeed]        = useState<Activity[]>([])
  const [groupFeedLoading, setGroupFeedLoading] = useState(true)
  const [groupFeedKudos,   setGroupFeedKudos]   = useState<Set<string>>(new Set())

  // Events
  const [events,        setEvents]       = useState<TunisianEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventsError,   setEventsError]  = useState<string | null>(null)

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadFeed = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUserId(user?.id ?? null)
      const data    = await activityService.getFriendsFeed()
      setActivities(data)
      const kudosed = await activityService.getMyKudos(data.map((a) => a.id))
      setKudosedIds(kudosed)
    } catch (e) { console.error('Feed error:', e) }
    setFeedLoading(false)
    setRefreshing(false)
  }, [])

  const loadGroups = useCallback(async () => {
    try {
      setGroups(await activityService.getGroups())
    } catch (e) { console.error('Groups error:', e) }
    setGroupsLoading(false)
  }, [])

  const loadGroupFeed = useCallback(async () => {
    setGroupFeedLoading(true)
    try {
      const data = await activityService.getGroupFeed()
      setGroupFeed(data)
      const kudosed = await activityService.getMyKudos(data.map((a) => a.id))
      setGroupFeedKudos(kudosed)
    } catch (e) { console.error('Group feed error:', e) }
    setGroupFeedLoading(false)
  }, [])

  const loadEvents = useCallback(async () => {
    setEventsError(null)
    try {
      setEvents(await myeventsService.getUpcomingEvents())
    } catch (e: any) {
      setEventsError(e.message ?? 'Failed to load events')
    }
    setEventsLoading(false)
  }, [])

  useEffect(() => { loadFeed(); loadGroups(); loadGroupFeed(); loadEvents() }, [])

  const onRefresh = () => { setRefreshing(true); loadFeed(); loadGroups(); loadGroupFeed(); loadEvents() }

  // ── Kudos toggle ───────────────────────────────────────────────────────────

  const handleKudos = async (activityId: string, currently: boolean) => {
    setKudosedIds((prev) => {
      const next = new Set(prev)
      currently ? next.delete(activityId) : next.add(activityId)
      return next
    })
    try {
      currently
        ? await activityService.removeKudos(activityId)
        : await activityService.giveKudos(activityId)
    } catch {
      // Revert optimistic update
      setKudosedIds((prev) => {
        const next = new Set(prev)
        currently ? next.add(activityId) : next.delete(activityId)
        return next
      })
    }
  }

  const handleGroupFeedKudos = async (activityId: string, currently: boolean) => {
    setGroupFeedKudos((prev) => {
      const next = new Set(prev)
      currently ? next.delete(activityId) : next.add(activityId)
      return next
    })
    try {
      currently
        ? await activityService.removeKudos(activityId)
        : await activityService.giveKudos(activityId)
    } catch {
      setGroupFeedKudos((prev) => {
        const next = new Set(prev)
        currently ? next.add(activityId) : next.delete(activityId)
        return next
      })
    }
  }

  // ── Group toggle ───────────────────────────────────────────────────────────

  const handleGroupToggle = async (group: Group) => {
    // Optimistic update
    setGroups((prev) => prev.map((g) =>
      g.id === group.id
        ? { ...g, joined: !g.joined, member_count: g.joined ? g.member_count - 1 : g.member_count + 1 }
        : g
    ))
    try {
      group.joined
        ? await activityService.leaveGroup(group.id)
        : await activityService.joinGroup(group.id)
    } catch (e: any) {
      Alert.alert('Error', e.message)
      // Revert
      setGroups((prev) => prev.map((g) =>
        g.id === group.id ? { ...g, joined: group.joined, member_count: group.member_count } : g
      ))
    }
  }

  const handleGroupCreated = (newGroup: Group) => setGroups((prev) => [newGroup, ...prev])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Feed</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.searchIconBtn}
            onPress={() => router.push('/(tabs)/search')}
            activeOpacity={0.75}
          >
            <FontAwesome5 name="search" size={16} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
            <FontAwesome5 name="sync-alt" size={18} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab bar */}
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

      {/* ── Activity tab ─────────────────────────────────────────────────── */}
      {tab === 'activity' && (
        feedLoading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
        ) : (
          <FlatList
            data={activities}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <ActivityCard item={item} kudosed={kudosedIds.has(item.id)} onKudos={handleKudos} currentUserId={currentUserId} />
            )}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            ListEmptyComponent={
              <EmptyState
                icon="user-friends"
                title="No activity yet"
                text="Follow friends or join a group to see their runs here!"
              />
            }
            contentContainerStyle={activities.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
            showsVerticalScrollIndicator={false}
          />
        )
      )}

      {/* ── Groups tab ───────────────────────────────────────────────────── */}
      {tab === 'groups' && (
        groupsLoading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
        ) : (
          <View style={{ flex: 1 }}>
            {/* Sub-tab bar */}
            <View style={styles.subTabBar}>
              <TouchableOpacity
                style={[styles.subTabBtn, groupsSubTab === 'feed' && styles.subTabBtnActive]}
                onPress={() => setGroupsSubTab('feed')}
                activeOpacity={0.8}
              >
                <FontAwesome5
                  name="stream"
                  size={12}
                  color={groupsSubTab === 'feed' ? Colors.primary : Colors.textMuted}
                />
                <Text style={[styles.subTabLabel, groupsSubTab === 'feed' && styles.subTabLabelActive]}>
                  Group Feed
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.subTabBtn, groupsSubTab === 'discover' && styles.subTabBtnActive]}
                onPress={() => setGroupsSubTab('discover')}
                activeOpacity={0.8}
              >
                <FontAwesome5
                  name="compass"
                  size={12}
                  color={groupsSubTab === 'discover' ? Colors.primary : Colors.textMuted}
                />
                <Text style={[styles.subTabLabel, groupsSubTab === 'discover' && styles.subTabLabelActive]}>
                  Discover
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── Group Feed sub-tab ────────────────────────────────────── */}
            {groupsSubTab === 'feed' && (
              groupFeedLoading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
              ) : (
                <FlatList
                  data={groupFeed}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <ActivityCard
                      item={item}
                      kudosed={groupFeedKudos.has(item.id)}
                      onKudos={handleGroupFeedKudos}
                      currentUserId={currentUserId}
                    />
                  )}
                  refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
                  }
                  ListEmptyComponent={
                    <EmptyState
                      icon="users"
                      title="No group posts yet"
                      text="Join a group and runs posted there will appear here."
                    />
                  }
                  contentContainerStyle={groupFeed.length === 0 ? { flex: 1 } : { paddingBottom: 20 }}
                  showsVerticalScrollIndicator={false}
                />
              )
            )}

            {/* ── Discover sub-tab ─────────────────────────────────────── */}
            {groupsSubTab === 'discover' && (
              <View style={{ flex: 1 }}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                  {/* Your groups */}
                  {groups.filter((g) => g.joined).length > 0 && (
                    <>
                      <Text style={styles.sectionLabel}>Your Groups</Text>
                      {groups.filter((g) => g.joined).map((g) => (
                        <GroupCard key={g.id} group={g} onToggle={handleGroupToggle} />
                      ))}
                    </>
                  )}

                  {/* Discover */}
                  <Text style={styles.sectionLabel}>
                    {groups.filter((g) => g.joined).length > 0 ? 'Discover Groups' : 'All Groups'}
                  </Text>
                  {groups.length === 0 ? (
                    <EmptyState
                      icon="users"
                      title="No groups yet"
                      text="Be the first — create a group below!"
                    />
                  ) : (
                    groups.filter((g) => !g.joined).map((g) => (
                      <GroupCard key={g.id} group={g} onToggle={handleGroupToggle} />
                    ))
                  )}
                </ScrollView>

                {/* Create group FAB */}
                <TouchableOpacity
                  style={styles.createGroupFab}
                  onPress={() => router.push('/(tabs)/create-group')}
                  activeOpacity={0.85}
                >
                  <FontAwesome5 name="plus" size={15} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.createGroupFabText}>Create Group</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )
      )}

      {/* ── Events tab ───────────────────────────────────────────────────── */}
      {tab === 'events' && (
        eventsLoading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
        ) : eventsError ? (
          <EmptyState
            icon="exclamation-circle"
            title="Could not load events"
            text={eventsError}
          />
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
            <View style={styles.eventsHeader}>
              <Text style={styles.sectionLabel}>🇹🇳 Upcoming Races</Text>
              <Text style={styles.eventsSource}>myevents.tn</Text>
            </View>
            {events.length === 0 ? (
              <EmptyState
                icon="calendar-alt"
                title="No upcoming events"
                text="Check back soon for races near you."
              />
            ) : (
              events.map((event, i) => {
                const today = new Date(); today.setHours(0, 0, 0, 0)
                const eventDate = new Date(event.date)
                const days = Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
                const formattedDate = eventDate.toLocaleDateString('en-GB', {
                  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                })
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
                    <View style={[
                      styles.tunisianCountdown,
                      isVerySoon ? styles.tunisianCountdownSoon : styles.tunisianCountdownNormal,
                    ]}>
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

      {/* Create Group Sheet */}
      <CreateGroupSheet
        visible={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreated={handleGroupCreated}
      />
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingTop: 60, paddingBottom: 12, paddingHorizontal: 20,
  },
  headerTitle:   { color: Colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchIconBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.card,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  refreshBtn: { padding: 6 },

  // Tab bar
  tabBar: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 14,
    backgroundColor: Colors.card, borderRadius: 14, padding: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 11,
  },
  tabBtnActive:   { backgroundColor: Colors.card2 },
  tabLabel:       { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  tabLabelActive: { color: Colors.primary },

  sectionLabel: {
    color: Colors.text, fontSize: 16, fontWeight: '700',
    paddingHorizontal: 20, marginTop: 12, marginBottom: 10,
  },

  // Activity card
  card: {
    backgroundColor: Colors.card,
    marginBottom: 8,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
  },
  avatarWrap:   { position: 'relative', marginRight: 12 },
  avatarImg:    { width: 46, height: 46, borderRadius: 23 },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
  },
  avatarText:  { color: '#fff', fontWeight: '700', fontSize: 18 },
  avatarBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.card,
  },
  userInfo: { flex: 1 },
  username: { color: Colors.text, fontWeight: '700', fontSize: 15 },
  subRow:   { flexDirection: 'row', alignItems: 'center', marginTop: 2, flexWrap: 'wrap' },
  date:     { color: Colors.textMuted, fontSize: 12 },
  dotSep:   { color: Colors.textMuted, fontSize: 12 },
  groupTag: { color: Colors.primary, fontSize: 12, fontWeight: '500' },
  moreBtn:  { padding: 4 },

  activityTitle: {
    color: Colors.text, fontSize: 22, fontWeight: '800',
    paddingHorizontal: 16, paddingBottom: 14, letterSpacing: -0.3,
  },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 14, gap: 32 },
  stat:      { flexDirection: 'column' },
  statLabel: { color: Colors.textMuted, fontSize: 12, marginBottom: 1 },
  statValue: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  statUnit:  { fontSize: 14, fontWeight: '500', color: Colors.textMuted },

  mapContainer: { height: 200, overflow: 'hidden' },
  map:          { flex: 1 },
  startDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.success ?? '#22c55e',
    borderWidth: 2.5, borderColor: '#fff',
  },
  finishDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.danger ?? '#ef4444',
    borderWidth: 2.5, borderColor: '#fff',
  },

  cardFooter: {
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 14,
    borderTopWidth: 1, borderColor: Colors.border,
  },
  kudosAvatarsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  kudosAvatarDot: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.card2, borderWidth: 1, borderColor: Colors.border,
  },
  kudosBubble: { position: 'relative' },
  kudosGaveText: { color: Colors.textMuted, fontSize: 13, marginLeft: 6 },

  // ── Inline comment section ─────────────────────────────────────────────────
  commentSection: {
    borderTopWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14,
    backgroundColor: Colors.card,
    gap: 10,
  },
  noCommentsText: { color: Colors.textMuted, fontSize: 13, textAlign: 'center', paddingVertical: 8 },
  commentRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  commentBubble: {
    flex: 1, backgroundColor: Colors.card2,
    borderRadius: 14, borderTopLeftRadius: 4,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.border,
  },
  commentMeta:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  commentAuthor: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  commentTime:   { color: Colors.textMuted, fontSize: 11 },
  commentText:   { color: Colors.text, fontSize: 14, lineHeight: 19 },
  commentInputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 4,
  },
  commentInput: {
    flex: 1, backgroundColor: Colors.card2,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 10,
    color: Colors.text, fontSize: 14, maxHeight: 80,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  sendBtnDisabled: { opacity: 0.4 },
  footerActions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    flex: 1, justifyContent: 'center',
    paddingVertical: 9, borderRadius: 10,
    backgroundColor: Colors.card2, borderWidth: 1, borderColor: Colors.border,
  },
  actionBtnActive:     { borderColor: '#f59e0b', backgroundColor: '#f59e0b18' },
  actionBtnText:       { color: Colors.textMuted, fontSize: 14, fontWeight: '600' },
  actionBtnTextActive: { color: '#f59e0b' },

  // Group sub-tabs
  subTabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    backgroundColor: Colors.card2,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  subTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  subTabBtnActive: {
    backgroundColor: Colors.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  subTabLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  subTabLabelActive: {
    color: Colors.primary,
  },

  // Group card
  groupCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: 18,
    marginHorizontal: 16, marginBottom: 10,
    padding: 14, borderWidth: 1, borderColor: Colors.border,
  },
  groupImage:        { width: 56, height: 56, borderRadius: 14, marginRight: 12 },
  groupImageFallback: {
    width: 56, height: 56, borderRadius: 14, marginRight: 12,
    backgroundColor: Colors.card2,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  groupInfo:     { flex: 1, marginRight: 10 },
  groupName:     { color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 3 },
  groupDesc:     { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginBottom: 5 },
  groupMeta:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  groupMetaText: { color: Colors.textMuted, fontSize: 12 },
  joinBtn: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1.5, borderColor: Colors.primary,
  },
  joinBtnJoined:     { backgroundColor: Colors.primary },
  joinBtnText:       { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  joinBtnTextJoined: { color: '#fff' },

  createGroupFab: {
    position: 'absolute', bottom: 20, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.primary, borderRadius: 50,
    paddingHorizontal: 24, paddingVertical: 14,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  createGroupFabText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Event card
  eventCard: {
    backgroundColor: Colors.card, borderRadius: 18,
    marginHorizontal: 16, marginBottom: 12,
    padding: 16, borderWidth: 1, borderColor: Colors.border,
  },
  eventTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  eventTypeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 8, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4,
  },
  eventTypeText:  { fontSize: 11, fontWeight: '700' },
  daysLeft:       { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  spotsText:      { color: Colors.danger, fontSize: 11, fontWeight: '600', marginTop: 2 },
  eventTitle:     { color: Colors.text, fontSize: 17, fontWeight: '700', marginBottom: 5 },
  eventDesc:      { color: Colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 12 },
  eventMeta:      { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  eventMetaItem:  { flexDirection: 'row', alignItems: 'center', gap: 5 },
  eventMetaText:  { color: Colors.textMuted, fontSize: 12 },
  eventFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderColor: Colors.border, paddingTop: 12,
  },
  eventOrganizer: { color: Colors.textMuted, fontSize: 12 },
  rsvpCount:      { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  goingBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1.5, borderColor: Colors.primary,
  },
  goingBtnActive:     { backgroundColor: Colors.primary, borderColor: Colors.primary },
  goingBtnText:       { color: Colors.primary, fontSize: 13, fontWeight: '700' },
  goingBtnTextActive: { color: '#fff' },

  // Empty state
  empty: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 40, paddingVertical: 48,
  },
  emptyIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.card2,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16, borderWidth: 1, borderColor: Colors.border,
  },
  emptyTitle: { color: Colors.text, fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptyText:  { color: Colors.textMuted, fontSize: 15, textAlign: 'center', lineHeight: 22 },

  // Tunisian events
  eventsHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 20 },
  eventsSource:   { color: Colors.textMuted, fontSize: 11 },
  tunisianEventCard: {
    backgroundColor: Colors.card, borderRadius: 18,
    marginHorizontal: 16, marginBottom: 12,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  tunisianEventImage:            { width: '100%', height: 150 },
  tunisianEventImagePlaceholder: { backgroundColor: Colors.card2, justifyContent: 'center', alignItems: 'center' },
  tunisianCountdown:       { position: 'absolute', top: 10, right: 10, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  tunisianCountdownSoon:   { backgroundColor: Colors.danger },
  tunisianCountdownNormal: { backgroundColor: 'rgba(0,0,0,0.65)' },
  tunisianCountdownText:   { color: '#fff', fontSize: 11, fontWeight: '800' },
  tunisianEventInfo:       { padding: 14, gap: 6 },
  tunisianEventTitle:      { color: Colors.text, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  tunisianMetaRow:         { flexDirection: 'row', alignItems: 'center', gap: 7 },
  tunisianLocation:        { color: Colors.primary, fontSize: 12, flex: 1 },
  tunisianDate:            { color: Colors.textMuted, fontSize: 12 },
  tunisianFooter:          { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  tunisianRegister:        { color: Colors.primary, fontSize: 12, fontWeight: '700' },
})