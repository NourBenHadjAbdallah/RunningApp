// components/Profile/ChallengesSection.tsx
//
// Horizontal slider showing challenges the user has joined or submitted,
// each card showing icon, title, progress bar, and trophy badge.
// Appears in the Stats tab of ProfileScreen, self-view only.

import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Dimensions,
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { activityService, Challenge, Activity } from '../../services/activityService'

const CARD_WIDTH = Dimensions.get('window').width * 0.72

// ── Difficulty colours ─────────────────────────────────────────────────────────

const DIFF_COLORS: Record<Challenge['difficulty'], string> = {
  easy:   '#22c55e',
  medium: '#f59e0b',
  hard:   '#ef4444',
}

const DIFF_LABELS: Record<Challenge['difficulty'], string> = {
  easy:   'Easy',
  medium: 'Medium',
  hard:   'Hard',
}

// ── Category icons ─────────────────────────────────────────────────────────────

const CAT_ICONS: Record<Challenge['category'], string> = {
  distance:    'road',
  consistency: 'calendar-check',
  speed:       'tachometer-alt',
  time:        'clock',
}

// ── Days remaining ─────────────────────────────────────────────────────────────

function daysLeft(endsAt: string): number {
  const diff = new Date(endsAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

// ── Progress calculation ───────────────────────────────────────────────────────
// For distance challenges: sum km in the challenge window.
// For consistency challenges: count distinct run days in the window.
// For speed / time challenges: count total runs in the window.

function computeProgress(
  challenge: Challenge,
  activities: Activity[],
): { current: number; target: number; pct: number } {
  const start = new Date(challenge.starts_at).getTime()
  const end   = new Date(challenge.ends_at).getTime()

  const inWindow = activities.filter(a => {
    const t = new Date(a.started_at).getTime()
    return t >= start && t <= end
  })

  let current = 0
  let target  = 1

  if (challenge.category === 'distance' && challenge.target_km) {
    current = inWindow.reduce((s, a) => s + (a.distance ?? 0), 0)
    target  = challenge.target_km
  } else if (challenge.category === 'consistency' && challenge.target_runs) {
    // Count distinct calendar days
    const days = new Set(
      inWindow.map(a => new Date(a.started_at).toDateString())
    )
    current = days.size
    target  = challenge.target_runs
  } else if (challenge.target_runs) {
    current = inWindow.length
    target  = challenge.target_runs
  } else if (challenge.target_km) {
    current = inWindow.reduce((s, a) => s + (a.distance ?? 0), 0)
    target  = challenge.target_km
  }

  const pct = Math.min(1, target > 0 ? current / target : 0)
  return { current, target, pct }
}

// ── Trophy mini-badge ──────────────────────────────────────────────────────────

function TrophyMini({ completed, diffColor }: { completed: boolean; diffColor: string }) {
  return (
    <View style={[styles.trophyMini, completed && { backgroundColor: `${diffColor}22`, borderColor: `${diffColor}55` }]}>
      <FontAwesome5
        name="trophy"
        size={14}
        color={completed ? diffColor : Colors.textMuted}
      />
    </View>
  )
}

// ── Single challenge card ─────────────────────────────────────────────────────

function ChallengeCard({
  challenge,
  activities,
}: {
  challenge: Challenge
  activities: Activity[]
}) {
  const diffColor = DIFF_COLORS[challenge.difficulty]
  const { current, target, pct } = computeProgress(challenge, activities)
  const left      = daysLeft(challenge.ends_at)
  const isExpired = left === 0

  const isDistanceCat = challenge.category === 'distance' || challenge.target_km != null
  const progressLabel = isDistanceCat
    ? `${current.toFixed(1)} / ${target.toFixed(0)} km`
    : `${current} / ${target} runs`

  return (
    <View style={[styles.card, challenge.completed && styles.cardCompleted]}>

      {/* Top row: icon circle + title + trophy */}
      <View style={styles.cardTop}>
        <View style={[styles.iconCircle, { backgroundColor: `${diffColor}18` }]}>
          <FontAwesome5
            name={challenge.icon ?? CAT_ICONS[challenge.category] ?? 'running'}
            size={18}
            color={diffColor}
          />
        </View>

        <View style={styles.cardMeta}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {challenge.title}
          </Text>
          <View style={styles.badgeRow}>
            <View style={[styles.diffBadge, { backgroundColor: `${diffColor}18`, borderColor: `${diffColor}44` }]}>
              <Text style={[styles.diffText, { color: diffColor }]}>
                {DIFF_LABELS[challenge.difficulty]}
              </Text>
            </View>
            {isExpired ? (
              <View style={styles.expiredBadge}>
                <Text style={styles.expiredText}>Ended</Text>
              </View>
            ) : (
              <View style={styles.daysBadge}>
                <FontAwesome5 name="clock" size={9} color={Colors.textMuted} />
                <Text style={styles.daysText}> {left}d left</Text>
              </View>
            )}
          </View>
        </View>

        <TrophyMini completed={!!challenge.completed} diffColor={diffColor} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressWrap}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width:           `${Math.round(pct * 100)}%` as any,
                backgroundColor: challenge.completed ? diffColor : Colors.primary,
              },
            ]}
          />
        </View>
        <Text style={styles.progressPct}>{Math.round(pct * 100)}%</Text>
      </View>

      {/* Bottom: detail */}
      <View style={styles.cardBottom}>
        <Text style={styles.progressLabel}>{progressLabel}</Text>
        {challenge.completed && (
          <View style={styles.completedPill}>
            <FontAwesome5 name="check-circle" size={10} color="#22c55e" />
            <Text style={styles.completedText}> Completed</Text>
          </View>
        )}
      </View>
    </View>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  activities: Activity[]
}

export function ChallengesSection({ activities }: Props) {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    activityService.getChallenges()
      .then(data => {
        // Show only challenges the user joined or completed
        setChallenges(data.filter(c => c.completed !== undefined))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  // Joined = any challenge returned (the service already filters by enrollment);
  // if all are returned regardless, show all — the user can decide.
  const visible = challenges

  if (loading) {
    return (
      <View style={styles.section}>
        <View style={styles.header}>
          <FontAwesome5 name="dumbbell" size={14} color={Colors.primary} />
          <Text style={styles.headerTitle}>Challenges</Text>
        </View>
        <ActivityIndicator
          size="small"
          color={Colors.primary}
          style={{ marginVertical: 24 }}
        />
      </View>
    )
  }

  if (visible.length === 0) {
    return (
      <View style={styles.section}>
        <View style={styles.header}>
          <FontAwesome5 name="dumbbell" size={14} color={Colors.primary} />
          <Text style={styles.headerTitle}>Challenges</Text>
        </View>
        <View style={styles.emptyCard}>
          <FontAwesome5 name="dumbbell" size={24} color={Colors.textMuted} />
          <Text style={styles.emptyText}>
            Join a challenge to track your progress here!
          </Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.section}>
      {/* Section header */}
      <View style={styles.header}>
        <FontAwesome5 name="dumbbell" size={14} color={Colors.primary} />
        <Text style={styles.headerTitle}>Challenges</Text>
        <Text style={styles.headerCount}>{visible.length}</Text>
      </View>

      {/* Horizontal slider */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.slider}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + 12}
        snapToAlignment="start"
      >
        {visible.map(challenge => (
          <ChallengeCard
            key={challenge.id}
            challenge={challenge}
            activities={activities}
          />
        ))}
        {/* trailing spacer so last card isn't flush with edge */}
        <View style={{ width: 4 }} />
      </ScrollView>
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  section: {
    marginTop: 20,
  },

  header: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            8,
    paddingHorizontal: 16,
    marginBottom:   12,
  },
  headerTitle: {
    color:      Colors.text,
    fontSize:   15,
    fontWeight: '700',
    flex:       1,
  },
  headerCount: {
    color:      Colors.textMuted,
    fontSize:   13,
    fontWeight: '600',
  },

  slider: {
    paddingLeft:  16,
    paddingRight: 12,
    gap:          12,
  },

  // ── Card ──────────────────────────────────────────────────────────────────────

  card: {
    width:           CARD_WIDTH,
    backgroundColor: Colors.card,
    borderRadius:    18,
    borderWidth:     1,
    borderColor:     Colors.border,
    padding:         16,
    gap:             12,
  },
  cardCompleted: {
    borderColor: 'rgba(34,197,94,0.35)',
  },

  cardTop: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           12,
  },
  iconCircle: {
    width:          46,
    height:         46,
    borderRadius:   14,
    justifyContent: 'center',
    alignItems:     'center',
    flexShrink:     0,
  },
  cardMeta: {
    flex: 1,
    gap:  5,
  },
  cardTitle: {
    color:      Colors.text,
    fontSize:   14,
    fontWeight: '700',
    lineHeight: 19,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           6,
    flexWrap:      'wrap',
  },
  diffBadge: {
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      8,
    borderWidth:       1,
  },
  diffText: {
    fontSize:   11,
    fontWeight: '700',
  },
  daysBadge: {
    flexDirection: 'row',
    alignItems:    'center',
    paddingHorizontal: 7,
    paddingVertical:   3,
    borderRadius:  8,
    backgroundColor: Colors.card2,
    borderWidth:   1,
    borderColor:   Colors.border,
  },
  daysText: {
    color:      Colors.textMuted,
    fontSize:   11,
    fontWeight: '600',
  },
  expiredBadge: {
    paddingHorizontal: 7,
    paddingVertical:   3,
    borderRadius:      8,
    backgroundColor:   'rgba(239,68,68,0.10)',
    borderWidth:       1,
    borderColor:       'rgba(239,68,68,0.25)',
  },
  expiredText: {
    color:      '#ef4444',
    fontSize:   11,
    fontWeight: '600',
  },

  // ── Trophy mini ───────────────────────────────────────────────────────────────
  trophyMini: {
    width:          34,
    height:         34,
    borderRadius:   10,
    backgroundColor: Colors.card2,
    borderWidth:    1,
    borderColor:    Colors.border,
    justifyContent: 'center',
    alignItems:     'center',
    flexShrink:     0,
  },

  // ── Progress ──────────────────────────────────────────────────────────────────
  progressWrap: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
  },
  progressTrack: {
    flex:            1,
    height:          7,
    backgroundColor: Colors.border,
    borderRadius:    4,
    overflow:        'hidden',
  },
  progressFill: {
    height:       '100%',
    borderRadius: 4,
    minWidth:     4,
  },
  progressPct: {
    color:      Colors.text,
    fontSize:   12,
    fontWeight: '700',
    width:      34,
    textAlign:  'right',
  },

  // ── Bottom row ────────────────────────────────────────────────────────────────
  cardBottom: {
    flexDirection: 'row',
    alignItems:    'center',
    justifyContent: 'space-between',
  },
  progressLabel: {
    color:      Colors.textMuted,
    fontSize:   12,
    fontWeight: '500',
  },
  completedPill: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 8,
    paddingVertical:   3,
    borderRadius:      8,
    backgroundColor:   'rgba(34,197,94,0.10)',
    borderWidth:       1,
    borderColor:       'rgba(34,197,94,0.3)',
  },
  completedText: {
    color:      '#22c55e',
    fontSize:   11,
    fontWeight: '700',
  },

  // ── Empty ─────────────────────────────────────────────────────────────────────
  emptyCard: {
    marginHorizontal: 16,
    backgroundColor:  Colors.card,
    borderRadius:     16,
    borderWidth:      1,
    borderColor:      Colors.border,
    alignItems:       'center',
    gap:              10,
    paddingVertical:  24,
    paddingHorizontal: 20,
  },
  emptyText: {
    color:     Colors.textMuted,
    fontSize:  13,
    textAlign: 'center',
  },
})