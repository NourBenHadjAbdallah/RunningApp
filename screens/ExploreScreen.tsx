import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Linking, ActivityIndicator, Alert,
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { activityService, Challenge, TrainingProgram } from '../services/activityService'
import { Colors } from '../constants/colors'

type ExploreTab = 'challenges' | 'programs' | 'tips'

// ─── Static tips (no DB table needed) ────────────────────────────────────────

const TIPS = [
  {
    icon: 'tint',
    title: 'Hydration for runners',
    category: 'Nutrition',
    body: 'Drink 500ml of water 1–2 hours before your run. During long runs (60+ min), aim for 150–250ml every 20 minutes. After running, replace 150% of fluid lost.',
    read_time_min: 2,
  },
  {
    icon: 'moon',
    title: 'Sleep & recovery',
    category: 'Recovery',
    body: 'Sleep is when your body repairs micro-tears in muscle tissue. Aim for 7–9 hours on training days. Even one poor night raises perceived effort by 10–15%.',
    read_time_min: 2,
  },
  {
    icon: 'heartbeat',
    title: 'Training in heart rate zones',
    category: 'Training',
    body: 'Run 80% of your miles in zone 2 (conversational pace, ~60–70% max HR). Save 20% for zone 4–5 hard efforts. This polarised approach builds aerobic base while avoiding chronic fatigue.',
    read_time_min: 3,
  },
  {
    icon: 'apple-alt',
    title: 'Pre-run nutrition',
    category: 'Nutrition',
    body: 'Eat a light carb-rich snack 30–60 min before running — a banana, toast with honey, or a small bowl of oats. Avoid high-fat or high-fibre foods that slow gastric emptying.',
    read_time_min: 2,
  },
  {
    icon: 'shoe-prints',
    title: 'Optimising your cadence',
    category: 'Form',
    body: 'A cadence of 170–180 steps per minute reduces ground contact time and lowers injury risk. Increase it gradually by 5% over 2–3 weeks using a metronome app.',
    read_time_min: 2,
  },
  {
    icon: 'band-aid',
    title: 'Injury prevention basics',
    category: 'Recovery',
    body: 'Follow the 10% rule — never increase weekly mileage by more than 10% from the previous week. Add one rest day and 2x/week strength work focusing on glutes, hip flexors, and calves.',
    read_time_min: 3,
  },
  {
    icon: 'wind',
    title: 'Running economy',
    category: 'Form',
    body: 'Lean forward from the ankles (not the waist), relax your shoulders, keep elbows at ~90°, and land with your foot under your hips — not in front.',
    read_time_min: 2,
  },
]

// ─── Colour maps ──────────────────────────────────────────────────────────────

const DIFF_COLOR: Record<Challenge['difficulty'], string> = {
  easy:   Colors.success,
  medium: '#f59e0b',
  hard:   Colors.danger,
}

const CATEGORY_COLOR: Record<Challenge['category'], string> = {
  distance:    Colors.primary,
  consistency: '#6366f1',
  speed:       Colors.danger,
  time:        '#f59e0b',
}

const LEVEL_COLOR: Record<TrainingProgram['level'], string> = {
  Beginner:     Colors.success,
  Intermediate: '#f59e0b',
  Advanced:     Colors.primary,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysLeft(iso: string) {
  const diff = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

// ─── Explore Screen ───────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const [tab, setTab] = useState<ExploreTab>('challenges')

  // Challenges
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [challengesLoading, setChallengesLoading] = useState(true)

  // Programs
  const [programs, setPrograms] = useState<TrainingProgram[]>([])
  const [programsLoading, setProgramsLoading] = useState(true)
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null)

  // Tips (static — no loading needed)
  const [expandedTip, setExpandedTip] = useState<number | null>(null)

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadChallenges = useCallback(async () => {
    try {
      const data = await activityService.getChallenges()
      setChallenges(data)
    } catch (e) {
      console.error('Challenges error:', e)
    }
    setChallengesLoading(false)
  }, [])

  const loadPrograms = useCallback(async () => {
    try {
      const data = await activityService.getPrograms()
      setPrograms(data)
    } catch (e) {
      console.error('Programs error:', e)
    }
    setProgramsLoading(false)
  }, [])

  useEffect(() => {
    loadChallenges()
    loadPrograms()
  }, [])

  // ── Challenge toggle ───────────────────────────────────────────────────────

  const handleChallengeToggle = async (challenge: Challenge) => {
    // Optimistic update
    setChallenges((prev) =>
      prev.map((c) => (c.id === challenge.id ? { ...c, completed: !c.completed } : c))
    )
    try {
      if (challenge.completed) {
        await activityService.uncompleteChallenge(challenge.id)
      } else {
        await activityService.completeChallenge(challenge.id, challenge.points)
      }
    } catch (e: any) {
      Alert.alert('Error', e.message)
      // Revert
      setChallenges((prev) =>
        prev.map((c) => (c.id === challenge.id ? { ...c, completed: challenge.completed } : c))
      )
    }
  }

  // ── Program enroll toggle ──────────────────────────────────────────────────

  const handleProgramToggle = async (program: TrainingProgram) => {
    setPrograms((prev) =>
      prev.map((p) => (p.id === program.id ? { ...p, enrolled: !p.enrolled } : p))
    )
    try {
      if (program.enrolled) {
        await activityService.unenrollProgram(program.id)
      } else {
        await activityService.enrollProgram(program.id)
        Alert.alert('Enrolled!', `You've started "${program.title}". Good luck!`)
      }
    } catch (e: any) {
      Alert.alert('Error', e.message)
      setPrograms((prev) =>
        prev.map((p) => (p.id === program.id ? { ...p, enrolled: program.enrolled } : p))
      )
    }
  }

  // ── Derived stats ──────────────────────────────────────────────────────────

  const completedCount = challenges.filter((c) => c.completed).length
  const totalPoints = challenges
    .filter((c) => c.completed)
    .reduce((sum, c) => sum + c.points, 0)

  const TABS: { key: ExploreTab; label: string; icon: string }[] = [
    { key: 'challenges', label: 'Challenges', icon: 'trophy'    },
    { key: 'programs',   label: 'Programs',   icon: 'list-alt'  },
    { key: 'tips',       label: 'Tips',       icon: 'lightbulb' },
  ]

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Explore</Text>
          <Text style={styles.headerSub}>Challenges, programs & tips</Text>
        </View>
        {tab === 'challenges' && totalPoints > 0 && (
          <View style={styles.pointsPill}>
            <FontAwesome5 name="star" size={11} color="#f59e0b" />
            <Text style={styles.pointsPillText}>{totalPoints} pts</Text>
          </View>
        )}
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

      {/* ── Challenges ── */}
      {tab === 'challenges' && (
        challengesLoading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {challenges.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIconCircle}>
                  <FontAwesome5 name="trophy" size={28} color={Colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>No challenges yet</Text>
                <Text style={styles.emptyText}>Active challenges will appear here once added by an admin.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.sectionNote}>
                  {completedCount}/{challenges.length} completed
                </Text>
                {challenges.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.challengeCard, c.completed && styles.challengeDone]}
                    onPress={() => handleChallengeToggle(c)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.challengeIconWrap, { borderColor: c.completed ? Colors.success : CATEGORY_COLOR[c.category] }]}>
                      <FontAwesome5
                        name={(c.completed ? 'check' : c.icon) as any}
                        size={16}
                        color={c.completed ? Colors.success : CATEGORY_COLOR[c.category]}
                      />
                    </View>
                    <View style={styles.challengeMiddle}>
                      <Text style={[styles.challengeTitle, c.completed && { color: Colors.success }]}>
                        {c.title}
                      </Text>
                      {c.description ? (
                        <Text style={styles.challengeDesc}>{c.description}</Text>
                      ) : null}
                      <View style={styles.challengeMeta}>
                        <View style={[styles.diffBadge, { borderColor: DIFF_COLOR[c.difficulty] }]}>
                          <Text style={[styles.diffText, { color: DIFF_COLOR[c.difficulty] }]}>
                            {c.difficulty.charAt(0).toUpperCase() + c.difficulty.slice(1)}
                          </Text>
                        </View>
                        <Text style={styles.endsIn}>
                          <FontAwesome5 name="clock" size={10} color={Colors.textMuted} /> {daysLeft(c.ends_at)}d left
                        </Text>
                      </View>
                    </View>
                    <View style={styles.challengeRight}>
                      <FontAwesome5 name="star" size={11} color="#f59e0b" />
                      <Text style={styles.challengePoints}>{c.points}</Text>
                      <Text style={styles.ptsLabel}>pts</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </ScrollView>
        )
      )}

      {/* ── Programs ── */}
      {tab === 'programs' && (
        programsLoading ? (
          <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {programs.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIconCircle}>
                  <FontAwesome5 name="list-alt" size={28} color={Colors.textMuted} />
                </View>
                <Text style={styles.emptyTitle}>No programs yet</Text>
                <Text style={styles.emptyText}>Training programs will appear here once added.</Text>
              </View>
            ) : (
              programs.map((p) => {
                const expanded = expandedProgram === p.id
                const levelColor = LEVEL_COLOR[p.level]
                return (
                  <View key={p.id} style={styles.programCard}>
                    <View style={styles.programTop}>
                      <View style={[styles.programIconCircle, { borderColor: levelColor }]}>
                        <FontAwesome5 name={p.icon as any} size={18} color={levelColor} />
                      </View>
                      <View style={styles.programInfo}>
                        <View style={styles.programTitleRow}>
                          <Text style={styles.programTitle}>{p.title}</Text>
                          <View style={[styles.levelBadge, { borderColor: levelColor }]}>
                            <Text style={[styles.levelText, { color: levelColor }]}>{p.level}</Text>
                          </View>
                        </View>
                        {p.subtitle ? <Text style={styles.programSubtitle}>{p.subtitle}</Text> : null}
                        <Text style={styles.programMeta}>{p.weeks} weeks · {p.runs_per_week} runs/week</Text>
                      </View>
                    </View>

                    {p.description ? <Text style={styles.programDesc}>{p.description}</Text> : null}

                    {expanded && Array.isArray(p.phases) && p.phases.length > 0 && (
                      <View style={styles.phasesWrap}>
                        <Text style={styles.phasesTitle}>Training Phases</Text>
                        {p.phases.map((ph: any, i: number) => (
                          <View key={i} style={styles.phaseRow}>
                            <View style={styles.phaseDot} />
                            <View style={styles.phaseText}>
                              <Text style={styles.phaseName}>
                                {ph.name} <Text style={styles.phaseWeeks}>({ph.weeks} wk)</Text>
                              </Text>
                              <Text style={styles.phaseFocus}>{ph.focus}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    <View style={styles.programFooter}>
                      {Array.isArray(p.phases) && p.phases.length > 0 && (
                        <TouchableOpacity
                          style={styles.detailsBtn}
                          onPress={() => setExpandedProgram(expanded ? null : p.id)}
                        >
                          <Text style={styles.detailsBtnText}>{expanded ? 'Hide' : 'View phases'}</Text>
                          <FontAwesome5 name={expanded ? 'chevron-up' : 'chevron-down'} size={11} color={Colors.primary} style={{ marginLeft: 6 }} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        style={[styles.startProgramBtn, p.enrolled && styles.startProgramBtnEnrolled]}
                        onPress={() => handleProgramToggle(p)}
                      >
                        <Text style={[styles.startProgramText, p.enrolled && styles.startProgramTextEnrolled]}>
                          {p.enrolled ? '✓ Enrolled' : 'Start Program'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )
              })
            )}
          </ScrollView>
        )
      )}

      {/* ── Tips (static) ── */}
      {tab === 'tips' && (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {TIPS.map((tip, i) => (
            <TouchableOpacity
              key={i}
              style={styles.tipCard}
              onPress={() => setExpandedTip(expandedTip === i ? null : i)}
              activeOpacity={0.85}
            >
              <View style={styles.tipRow}>
                <View style={styles.tipIconCircle}>
                  <FontAwesome5 name={tip.icon as any} size={14} color={Colors.primary} />
                </View>
                <View style={styles.tipMeta}>
                  <Text style={styles.tipTitle}>{tip.title}</Text>
                  <View style={styles.tipMetaRow}>
                    <View style={styles.tipCategoryBadge}>
                      <Text style={styles.tipCategory}>{tip.category}</Text>
                    </View>
                    <Text style={styles.tipReadTime}>{tip.read_time_min} min read</Text>
                  </View>
                </View>
                <FontAwesome5 name={expandedTip === i ? 'chevron-up' : 'chevron-down'} size={12} color={Colors.textMuted} />
              </View>
              {expandedTip === i && <Text style={styles.tipBody}>{tip.body}</Text>}
            </TouchableOpacity>
          ))}

          <Text style={styles.resourcesTitle}>Resources</Text>
          <View style={styles.linksRow}>
            {[
              { label: 'Pace calculator', icon: 'calculator', url: 'https://www.runningfastr.com' },
              { label: 'Strava community', icon: 'users', url: 'https://www.strava.com' },
              { label: 'Race finder', icon: 'map-marker-alt', url: 'https://www.runningintheusa.com' },
            ].map((link, i) => (
              <TouchableOpacity key={i} style={styles.linkCard} onPress={() => Linking.openURL(link.url)}>
                <FontAwesome5 name={link.icon as any} size={16} color={Colors.primary} style={{ marginBottom: 8 }} />
                <Text style={styles.linkLabel}>{link.label}</Text>
                <FontAwesome5 name="external-link-alt" size={10} color={Colors.textMuted} style={{ marginTop: 6 }} />
              </TouchableOpacity>
            ))}
          </View>
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    paddingTop: 60, paddingBottom: 14, paddingHorizontal: 20,
  },
  headerTitle: { color: Colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { color: Colors.textMuted, fontSize: 14, marginTop: 3 },
  pointsPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.card, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 7,
    borderWidth: 1, borderColor: '#f59e0b',
  },
  pointsPillText: { color: '#f59e0b', fontWeight: '700', fontSize: 14 },

  tabBar: {
    flexDirection: 'row', marginHorizontal: 16, marginBottom: 12,
    backgroundColor: Colors.card, borderRadius: 14, padding: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 11,
  },
  tabBtnActive: { backgroundColor: Colors.card2 },
  tabLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  tabLabelActive: { color: Colors.primary },

  scrollContent: { paddingHorizontal: 16, paddingBottom: 30 },
  sectionNote: { color: Colors.textMuted, fontSize: 13, marginBottom: 12, marginTop: 4 },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 20 },
  emptyIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.card2, justifyContent: 'center', alignItems: 'center',
    marginBottom: 14, borderWidth: 1, borderColor: Colors.border,
  },
  emptyTitle: { color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptyText: { color: Colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // Challenge card
  challengeCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: 16,
    padding: 14, marginBottom: 10, borderWidth: 1, borderColor: Colors.border,
  },
  challengeDone: { borderColor: Colors.success, backgroundColor: '#0a1a0e' },
  challengeIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.card2, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, marginRight: 12, flexShrink: 0,
  },
  challengeMiddle: { flex: 1 },
  challengeTitle: { color: Colors.text, fontSize: 14, fontWeight: '700', marginBottom: 3 },
  challengeDesc: { color: Colors.textMuted, fontSize: 12, lineHeight: 16, marginBottom: 6 },
  challengeMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  diffBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 2 },
  diffText: { fontSize: 11, fontWeight: '600' },
  endsIn: { color: Colors.textMuted, fontSize: 11 },
  challengeRight: { alignItems: 'center', marginLeft: 10 },
  challengePoints: { color: '#f59e0b', fontWeight: '800', fontSize: 18, marginTop: 2 },
  ptsLabel: { color: Colors.textMuted, fontSize: 10 },

  // Program card
  programCard: {
    backgroundColor: Colors.card, borderRadius: 18,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border,
  },
  programTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  programIconCircle: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: Colors.card2, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, marginRight: 12,
  },
  programInfo: { flex: 1 },
  programTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  programTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  levelBadge: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  levelText: { fontSize: 11, fontWeight: '600' },
  programSubtitle: { color: Colors.textMuted, fontSize: 13, marginBottom: 3 },
  programMeta: { color: Colors.textMuted, fontSize: 12 },
  programDesc: { color: Colors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 14 },

  phasesWrap: {
    backgroundColor: Colors.card2, borderRadius: 12, padding: 14, marginBottom: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  phasesTitle: { color: Colors.text, fontSize: 13, fontWeight: '700', marginBottom: 12 },
  phaseRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  phaseDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary,
    marginTop: 5, marginRight: 10, flexShrink: 0,
  },
  phaseText: { flex: 1 },
  phaseName: { color: Colors.text, fontSize: 13, fontWeight: '600' },
  phaseWeeks: { color: Colors.textMuted, fontWeight: '400' },
  phaseFocus: { color: Colors.textMuted, fontSize: 12, lineHeight: 16, marginTop: 2 },

  programFooter: { flexDirection: 'row', gap: 10 },
  detailsBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.card2, borderRadius: 10, paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  detailsBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  startProgramBtn: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 10,
  },
  startProgramBtnEnrolled: { backgroundColor: Colors.card2, borderWidth: 1, borderColor: Colors.success },
  startProgramText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  startProgramTextEnrolled: { color: Colors.success },

  // Tips
  tipCard: {
    backgroundColor: Colors.card, borderRadius: 14, marginBottom: 8, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  tipRow: { flexDirection: 'row', alignItems: 'center' },
  tipIconCircle: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.card2,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border, marginRight: 12,
  },
  tipMeta: { flex: 1 },
  tipTitle: { color: Colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  tipMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipCategoryBadge: {
    backgroundColor: Colors.card2, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: 1, borderColor: Colors.border,
  },
  tipCategory: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },
  tipReadTime: { color: Colors.textMuted, fontSize: 11 },
  tipBody: { color: Colors.textMuted, fontSize: 13, lineHeight: 21, marginTop: 12, paddingLeft: 48 },

  resourcesTitle: { color: Colors.text, fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 10 },
  linksRow: { flexDirection: 'row', gap: 10 },
  linkCard: {
    flex: 1, backgroundColor: Colors.card, borderRadius: 14, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  linkLabel: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', fontWeight: '500' },
})