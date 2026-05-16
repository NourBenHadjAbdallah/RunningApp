// components/Explore/ChallengesTab.tsx

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert, Animated,
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { activityService, Challenge } from '../../services/activityService'
import { Colors } from '../../constants/colors'

// ─── Tokens ───────────────────────────────────────────────────────────────────

const DIFF_COLOR: Record<Challenge['difficulty'], string> = {
  easy: Colors.success, medium: '#f59e0b', hard: Colors.danger,
}
const CAT_ICON: Record<Challenge['category'], string> = {
  distance: 'road', consistency: 'calendar-check', speed: 'wind', time: 'clock',
}
const CAT_COLOR: Record<Challenge['category'], string> = {
  distance: Colors.primary, consistency: '#6366f1', speed: Colors.danger, time: '#f59e0b',
}

function daysLeft(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
}

// ─── Summary banner ───────────────────────────────────────────────────────────

function SummaryBanner({ completed, total, points }: { completed: number; total: number; points: number }) {
  if (total === 0) return null
  return (
    <View style={s.banner}>
      <View style={s.bannerRow}>
        <View>
          <Text style={s.bannerLabel}>Your progress</Text>
          <Text>
            <Text style={s.bannerNum}>{completed}</Text>
            <Text style={s.bannerDen}> / {total} completed</Text>
          </Text>
        </View>
        {points > 0 && (
          <View style={s.pointsPill}>
            <FontAwesome5 name="star" size={11} color="#f59e0b" />
            <Text style={s.pointsText}>{points} pts</Text>
          </View>
        )}
      </View>
      <View style={s.track}>
        <View style={[s.trackFill, { width: `${(completed / total) * 100}%` as any }]} />
      </View>
    </View>
  )
}

// ─── Challenge card ───────────────────────────────────────────────────────────

function ChallengeCard({ challenge, onToggle }: { challenge: Challenge; onToggle: (c: Challenge) => void }) {
  const scale     = useRef(new Animated.Value(1)).current
  const catColor  = CAT_COLOR[challenge.category]
  const diffColor = DIFF_COLOR[challenge.difficulty]
  const days      = daysLeft(challenge.ends_at)
  const dayColor  = days <= 2 ? Colors.danger : days <= 7 ? '#f59e0b' : Colors.textMuted

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1,    duration: 120, useNativeDriver: true }),
    ]).start()
    onToggle(challenge)
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity style={[s.card, challenge.completed && s.cardDone]} onPress={handlePress} activeOpacity={0.9}>
        <View style={[s.catIcon, { borderColor: catColor }]}>
          <FontAwesome5 name={CAT_ICON[challenge.category] as any} size={16} color={catColor} />
        </View>
        <View style={s.cardMid}>
          <Text style={s.cardTitle} numberOfLines={1}>{challenge.title}</Text>
          <Text style={s.cardDesc}  numberOfLines={2}>{challenge.description}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={[s.badge, { borderColor: diffColor + '60' }]}>
              <View style={[s.badgeDot, { backgroundColor: diffColor }]} />
              <Text style={[s.badgeText, { color: diffColor }]}>{challenge.difficulty.charAt(0).toUpperCase() + challenge.difficulty.slice(1)}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <FontAwesome5 name="clock" size={9} color={dayColor} />
              <Text style={[s.daysText, { color: dayColor }]}>{days === 0 ? 'Ends today' : `${days}d left`}</Text>
            </View>
          </View>
        </View>
        <View style={s.cardRight}>
          {challenge.completed ? (
            <View style={s.checkCircle}>
              <FontAwesome5 name="check" size={13} color={Colors.success} />
            </View>
          ) : (
            <>
              <FontAwesome5 name="star" size={11} color="#f59e0b" />
              <Text style={s.pts}>{challenge.points}</Text>
              <Text style={s.ptsLabel}>pts</Text>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ChallengesTab() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading,    setLoading]    = useState(true)
  const [toggling,   setToggling]   = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setChallenges(await activityService.getChallenges()) }
    catch (e) { console.error('Challenges error:', e) }
    finally    { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const handleToggle = async (challenge: Challenge) => {
    if (toggling) return
    setToggling(challenge.id)
    setChallenges(prev => prev.map(c => c.id === challenge.id ? { ...c, completed: !c.completed } : c))
    try {
      challenge.completed
        ? await activityService.uncompleteChallenge(challenge.id)
        : await activityService.completeChallenge(challenge.id, challenge.points)
    } catch (e: any) {
      Alert.alert('Error', e.message)
      setChallenges(prev => prev.map(c => c.id === challenge.id ? { ...c, completed: challenge.completed } : c))
    } finally {
      setToggling(null)
    }
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View>

  if (challenges.length === 0) {
    return (
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.empty}>
          <View style={s.emptyCircle}><FontAwesome5 name="trophy" size={28} color={Colors.textMuted} /></View>
          <Text style={s.emptyTitle}>No challenges yet</Text>
          <Text style={s.emptyText}>Active challenges will appear here once added by an admin.</Text>
        </View>
      </ScrollView>
    )
  }

  const active    = challenges.filter(c => !c.completed)
  const completed = challenges.filter(c =>  c.completed)
  const totalPts  = completed.reduce((acc, c) => acc + c.points, 0)

  const Section = ({ title, items }: { title: string; items: Challenge[] }) => items.length === 0 ? null : (
    <>
      <View style={s.groupHeader}>
        <Text style={s.groupTitle}>{title}</Text>
        <View style={s.groupCount}><Text style={s.groupCountText}>{items.length}</Text></View>
      </View>
      {items.map(c => <ChallengeCard key={c.id} challenge={c} onToggle={handleToggle} />)}
    </>
  )

  return (
    <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
      <SummaryBanner completed={completed.length} total={challenges.length} points={totalPts} />
      <Section title="Active"    items={active}    />
      <Section title="Completed" items={completed} />
      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 30 },

  // Banner
  banner:     { backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, padding: 16, marginBottom: 16 },
  bannerRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  bannerLabel:{ color: Colors.textMuted, fontSize: 11, fontWeight: '600', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  bannerNum:  { color: Colors.text, fontSize: 22, fontWeight: '800' },
  bannerDen:  { color: Colors.textMuted, fontSize: 15, fontWeight: '500' },
  pointsPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' },
  pointsText: { color: '#f59e0b', fontWeight: '700', fontSize: 14 },
  track:      { height: 6, borderRadius: 3, backgroundColor: Colors.card2, overflow: 'hidden' },
  trackFill:  { height: '100%', borderRadius: 3, backgroundColor: Colors.primary },

  // Group header
  groupHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, marginBottom: 10 },
  groupTitle:     { color: Colors.text, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  groupCount:     { backgroundColor: Colors.card2, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, borderWidth: 1, borderColor: Colors.border },
  groupCountText: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },

  // Card
  card:        { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  cardDone:    { borderColor: Colors.success + '55', backgroundColor: Colors.success + '08' },
  catIcon:     { width: 46, height: 46, borderRadius: 23, backgroundColor: Colors.card2, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, marginRight: 12, flexShrink: 0 },
  cardMid:     { flex: 1 },
  cardTitle:   { color: Colors.text, fontSize: 14, fontWeight: '700', marginBottom: 3 },
  cardDesc:    { color: Colors.textMuted, fontSize: 12, lineHeight: 16, marginBottom: 7 },
  badge:       { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  badgeDot:    { width: 5, height: 5, borderRadius: 3 },
  badgeText:   { fontSize: 11, fontWeight: '700' },
  daysText:    { fontSize: 11, fontWeight: '600' },
  cardRight:   { alignItems: 'center', marginLeft: 12, gap: 2 },
  pts:         { color: '#f59e0b', fontWeight: '800', fontSize: 19, lineHeight: 22 },
  ptsLabel:    { color: Colors.textMuted, fontSize: 10 },
  checkCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.success + '18', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: Colors.success + '55' },

  // Empty
  empty:       { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.card2, justifyContent: 'center', alignItems: 'center', marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  emptyTitle:  { color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptyText:   { color: Colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
})