// screens/SearchScreen.tsx
// Full-screen search — people, groups, events
// Navigated to programmatically via router.push('/(tabs)/search')

import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  FlatList, ActivityIndicator, Linking,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { router } from 'expo-router'
import { supabase } from '../services/supabase'
import { activityService, Group } from '../services/activityService'
import { myeventsService, Event as TunisianEvent } from '../services/myeventsService'
import { followService } from '../services/followService'
import { Colors } from '../constants/colors'

// ─── Types ────────────────────────────────────────────────────────────────────

type ResultKind = 'person' | 'group' | 'event'

interface PersonResult {
  kind: 'person'
  id: string
  username: string
}

interface GroupResult {
  kind: 'group'
  data: Group
}

interface EventResult {
  kind: 'event'
  data: TunisianEvent
}

type SearchResult = PersonResult | GroupResult | EventResult

// ─── Component ────────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const inputRef = useRef<TextInput>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [events, setEvents] = useState<TunisianEvent[]>([])

  // Map of profileId → following state + per-button loading
  const [followMap, setFollowMap] = useState<Record<string, boolean>>({})
  const [followLoading, setFollowLoading] = useState<Record<string, boolean>>({})

  // Current viewer id (to hide the Follow button on own row)
  const [meId, setMeId] = useState<string | null>(null)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    myeventsService.getUpcomingEvents().then(setEvents).catch(() => {})
    followService.currentUserId().then(setMeId).catch(() => {})
    setTimeout(() => inputRef.current?.focus(), 80)
  }, [])

  // BUG FIX 4: The original effect bailed early when meId was null (not yet
  // resolved), and never re-ran once meId arrived because results hadn't
  // changed. Fixed by including meId in the dependency array AND removing the
  // early-bail — we load follow states as soon as we have both results and meId.
  useEffect(() => {
    const people = results.filter((r): r is PersonResult => r.kind === 'person')
    if (!people.length || !meId) return

    Promise.allSettled(
      people.map((p) =>
        followService.isFollowing(p.id).then((val: boolean) => ({ id: p.id, val }))
      )
    ).then((settled) => {
      const patch: Record<string, boolean> = {}
      for (const r of settled) {
        if (r.status === 'fulfilled') patch[r.value.id] = r.value.val
      }
      setFollowMap((prev) => ({ ...prev, ...patch }))
    })
  }, [results, meId]) // meId added to deps so this re-runs once auth resolves

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (!trimmed) { setResults([]); setLoading(false); return }
    setLoading(true)

    try {
      const pattern = `%${trimmed}%`

      const [{ data: people }, { data: grps }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username')
          .ilike('username', pattern)
          .limit(6),
        supabase
          .from('groups')
          .select('*')
          .ilike('name', pattern)
          .limit(5),
      ])

      const matchedEvents = events.filter((e) =>
        e.title.toLowerCase().includes(trimmed.toLowerCase()) ||
        (e.location ?? '').toLowerCase().includes(trimmed.toLowerCase())
      ).slice(0, 5)

      const combined: SearchResult[] = [
        ...(people ?? []).map((p: any): PersonResult => ({
          kind: 'person', id: p.id, username: p.username,
        })),
        ...(grps ?? []).map((g: any): GroupResult => ({ kind: 'group', data: g as Group })),
        ...matchedEvents.map((e): EventResult => ({ kind: 'event', data: e })),
      ]

      setResults(combined)
    } catch (e) {
      console.error('Search error:', e)
    }
    setLoading(false)
  }, [events])

  const handleChange = (text: string) => {
    setQuery(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(text), 280)
  }

  const clear = () => { setQuery(''); setResults([]) }

  // ── Follow toggle ─────────────────────────────────────────────────────────

  const handleFollow = async (personId: string) => {
    setFollowLoading((prev) => ({ ...prev, [personId]: true }))
    try {
      const next = await followService.toggle(personId, !!followMap[personId])
      setFollowMap((prev) => ({ ...prev, [personId]: next }))
    } catch (e) {
      console.error('Follow error:', e)
    } finally {
      setFollowLoading((prev) => ({ ...prev, [personId]: false }))
    }
  }

  // ── Result row renderer ───────────────────────────────────────────────────

  const renderItem = ({ item }: { item: SearchResult }) => {
    if (item.kind === 'person') {
      const isSelf = item.id === meId
      const following = !!followMap[item.id]
      const btnLoading = !!followLoading[item.id]

      return (
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.75}
          onPress={() => router.push(`/profile/${item.id}` as any)}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.username[0]?.toUpperCase()}</Text>
          </View>

          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>@{item.username}</Text>
            <Text style={styles.rowSub}>Runner</Text>
          </View>

          {!isSelf && (
            <TouchableOpacity
              style={[styles.followBtn, following && styles.followingBtn]}
              onPress={() => handleFollow(item.id)}
              disabled={btnLoading}
              activeOpacity={0.8}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              {btnLoading ? (
                <ActivityIndicator
                  size="small"
                  color={following ? Colors.primary : '#fff'}
                  style={{ width: 38 }}
                />
              ) : (
                <Text style={[styles.followBtnText, following && styles.followingBtnText]}>
                  {following ? 'Following' : 'Follow'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      )
    }

    if (item.kind === 'group') {
      const g = item.data
      return (
        <TouchableOpacity style={styles.row} activeOpacity={0.75}>
          <View style={[styles.avatar, styles.avatarIcon]}>
            <FontAwesome5 name="users" size={16} color={Colors.primary} />
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle}>{g.name}</Text>
            <Text style={styles.rowSub}>{g.member_count} members{g.description ? ` · ${g.description}` : ''}</Text>
          </View>
          <View style={styles.kindBadge}>
            <FontAwesome5 name="users" size={10} color="#6366f1" />
            <Text style={[styles.kindText, { color: '#6366f1' }]}>Group</Text>
          </View>
        </TouchableOpacity>
      )
    }

    if (item.kind === 'event') {
      const e = item.data
      return (
        <TouchableOpacity style={styles.row} activeOpacity={0.75} onPress={() => Linking.openURL(e.url)}>
          <View style={[styles.avatar, styles.avatarIcon]}>
            <FontAwesome5 name="flag-checkered" size={15} color={Colors.primary} />
          </View>
          <View style={styles.rowInfo}>
            <Text style={styles.rowTitle} numberOfLines={1}>{e.title}</Text>
            <Text style={styles.rowSub}>{e.location ?? ''}{e.location && e.date ? ' · ' : ''}{e.date}</Text>
          </View>
          <View style={styles.kindBadge}>
            <FontAwesome5 name="calendar" size={10} color="#f59e0b" />
            <Text style={[styles.kindText, { color: '#f59e0b' }]}>Event</Text>
          </View>
        </TouchableOpacity>
      )
    }

    return null
  }

  // ── Section headers injected into FlatList via data ───────────────────────

  type ListItem = { _header: ResultKind } | SearchResult

  const listData: ListItem[] = (() => {
    const people = results.filter((r) => r.kind === 'person')
    const groups = results.filter((r) => r.kind === 'group')
    const evts   = results.filter((r) => r.kind === 'event')
    const out: ListItem[] = []
    if (people.length) { out.push({ _header: 'person' }); out.push(...people) }
    if (groups.length) { out.push({ _header: 'group'  }); out.push(...groups) }
    if (evts.length)   { out.push({ _header: 'event'  }); out.push(...evts) }
    return out
  })()

  const HEADER_LABELS: Record<ResultKind, string> = {
    person: 'People',
    group: 'Groups',
    event: 'Events',
  }

  const renderListItem = ({ item }: { item: ListItem }) => {
    if ('_header' in item) {
      return <Text style={styles.sectionHeader}>{HEADER_LABELS[item._header]}</Text>
    }
    return renderItem({ item })
  }

  const hasResults = results.length > 0
  const searched = query.trim().length > 0

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <FontAwesome5 name="arrow-left" size={16} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.inputWrap}>
          <FontAwesome5 name="search" size={14} color={Colors.primary} style={styles.inputIcon} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Search people, groups, events…"
            placeholderTextColor={Colors.textMuted}
            value={query}
            onChangeText={handleChange}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={clear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <FontAwesome5 name="times-circle" size={15} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Body ── */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.hint}>Searching…</Text>
        </View>
      ) : !searched ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <FontAwesome5 name="search" size={32} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>Find anything</Text>
          <Text style={styles.hint}>Search for runners, groups or upcoming races</Text>
        </View>
      ) : !hasResults ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <FontAwesome5 name="inbox" size={32} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>No results</Text>
          <Text style={styles.hint}>Nothing matched {query}</Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderListItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </KeyboardAvoidingView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 58,
    paddingBottom: 14,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.card,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  inputIcon: {},
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: 15,
    paddingVertical: 0,
  },

  sectionHeader: {
    color: Colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 6,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 14,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarIcon: { backgroundColor: Colors.card2, borderWidth: 1, borderColor: Colors.border },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 17 },
  rowInfo: { flex: 1 },
  rowTitle: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  rowSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  followBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minWidth: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followingBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  followBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  followingBtnText: { color: Colors.primary },

  kindBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.card2,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  kindText: { color: Colors.primary, fontSize: 11, fontWeight: '600' },

  separator: { height: 1, backgroundColor: Colors.border, marginLeft: 78 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingHorizontal: 40 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.card2,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 8,
  },
  emptyTitle: { color: Colors.text, fontSize: 20, fontWeight: '700' },
  hint: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
})