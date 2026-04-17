import React, { useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Linking,
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../constants/colors'

const TRAINING_PLANS = [
  {
    id: '1',
    title: '5K Beginner',
    weeks: 6,
    runsPerWeek: 3,
    description: 'Perfect for new runners. Walk/run intervals building to a full 5K.',
    icon: 'seedling',
    level: 'Beginner',
    levelColor: Colors.success,
  },
  {
    id: '2',
    title: '10K Builder',
    weeks: 8,
    runsPerWeek: 4,
    description: 'Bridge from 5K to 10K with progressive long runs.',
    icon: 'bolt',
    level: 'Intermediate',
    levelColor: '#f59e0b',
  },
  {
    id: '3',
    title: 'Half Marathon',
    weeks: 12,
    runsPerWeek: 4,
    description: 'Structured plan with tempo runs, intervals, and a long run each week.',
    icon: 'fire',
    level: 'Advanced',
    levelColor: Colors.primary,
  },
]

const TIPS = [
  {
    icon: 'tint',
    title: 'Hydration',
    body: 'Drink 500ml of water 1–2 hours before your run. Sip 150–250ml every 20 min during long runs.',
  },
  {
    icon: 'moon',
    title: 'Recovery',
    body: 'Sleep is when your body repairs muscle tissue. Aim for 7–9 hours on training days.',
  },
  {
    icon: 'heartbeat',
    title: 'Heart rate zones',
    body: 'Run 80% of your miles at an easy conversational pace (zone 2). Save hard efforts for 20%.',
  },
  {
    icon: 'apple-alt',
    title: 'Pre-run fuel',
    body: 'Eat a light carb-rich snack 30–60 min before. A banana or toast works great.',
  },
  {
    icon: 'shoe-prints',
    title: 'Cadence',
    body: 'Aim for ~170–180 steps per minute. A higher cadence reduces injury risk and improves efficiency.',
  },
]

const CHALLENGES = [
  { id: '1', title: 'Run 3 days this week', icon: 'calendar-check', points: 50, completed: false },
  { id: '2', title: 'Hit 10 km total this week', icon: 'road', points: 75, completed: false },
  { id: '3', title: 'Log a run before 7am', icon: 'sun', points: 40, completed: false },
  { id: '4', title: 'Complete a 5 km run', icon: 'flag-checkered', points: 60, completed: false },
]

export default function ExploreScreen() {
  const [expandedTip, setExpandedTip] = useState<number | null>(null)
  const [completed, setCompleted] = useState<string[]>([])

  const toggleChallenge = (id: string) => {
    setCompleted(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Explore</Text>
        <Text style={styles.headerSub}>Training plans, tips & challenges</Text>
      </View>

      {/* ── Training Plans ── */}
      <Text style={styles.sectionTitle}>Training Plans</Text>
      {TRAINING_PLANS.map(plan => (
        <View key={plan.id} style={styles.planCard}>
          <View style={styles.planTop}>
            <View style={[styles.planIconCircle, { backgroundColor: Colors.card2 }]}>
              <FontAwesome5 name={plan.icon as any} size={18} color={Colors.primary} />
            </View>
            <View style={styles.planInfo}>
              <View style={styles.planTitleRow}>
                <Text style={styles.planTitle}>{plan.title}</Text>
                <View style={[styles.levelBadge, { borderColor: plan.levelColor }]}>
                  <Text style={[styles.levelText, { color: plan.levelColor }]}>{plan.level}</Text>
                </View>
              </View>
              <Text style={styles.planMeta}>
                {plan.weeks} weeks · {plan.runsPerWeek} runs/week
              </Text>
            </View>
          </View>
          <Text style={styles.planDesc}>{plan.description}</Text>
          <TouchableOpacity style={styles.planBtn}>
            <Text style={styles.planBtnText}>View Plan</Text>
            <FontAwesome5 name="chevron-right" size={12} color={Colors.primary} style={{ marginLeft: 6 }} />
          </TouchableOpacity>
        </View>
      ))}

      {/* ── Weekly Challenges ── */}
      <Text style={styles.sectionTitle}>Weekly Challenges</Text>
      <View style={styles.challengeGrid}>
        {CHALLENGES.map(c => {
          const done = completed.includes(c.id)
          return (
            <TouchableOpacity
              key={c.id}
              style={[styles.challengeCard, done && styles.challengeDone]}
              onPress={() => toggleChallenge(c.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.challengeIcon, done && styles.challengeIconDone]}>
                <FontAwesome5
                  name={done ? 'check' : (c.icon as any)}
                  size={14}
                  color={done ? '#fff' : Colors.primary}
                />
              </View>
              <Text style={[styles.challengeTitle, done && styles.challengeTitleDone]}>
                {c.title}
              </Text>
              <View style={styles.pointsBadge}>
                <FontAwesome5 name="star" size={9} color="#f59e0b" />
                <Text style={styles.pointsText}>{c.points} pts</Text>
              </View>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* ── Running Tips ── */}
      <Text style={styles.sectionTitle}>Running Tips</Text>
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
            <Text style={styles.tipTitle}>{tip.title}</Text>
            <FontAwesome5
              name={expandedTip === i ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={Colors.textMuted}
            />
          </View>
          {expandedTip === i && (
            <Text style={styles.tipBody}>{tip.body}</Text>
          )}
        </TouchableOpacity>
      ))}

      {/* ── Quick Links ── */}
      <Text style={styles.sectionTitle}>Resources</Text>
      <View style={styles.linksRow}>
        {[
          { label: 'Running calculator', icon: 'calculator', url: 'https://www.runningfastr.com' },
          { label: 'Strava community', icon: 'users', url: 'https://www.strava.com' },
          { label: 'Race finder', icon: 'map-marker-alt', url: 'https://www.runningintheusa.com' },
        ].map((link, i) => (
          <TouchableOpacity
            key={i}
            style={styles.linkCard}
            onPress={() => Linking.openURL(link.url)}
          >
            <FontAwesome5 name={link.icon as any} size={16} color={Colors.primary} style={{ marginBottom: 8 }} />
            <Text style={styles.linkLabel}>{link.label}</Text>
            <FontAwesome5 name="external-link-alt" size={10} color={Colors.textMuted} style={{ marginTop: 6 }} />
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 20 },

  header: {
    paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20,
  },
  headerTitle: { color: Colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  headerSub: { color: Colors.textMuted, fontSize: 14, marginTop: 4 },

  sectionTitle: {
    color: Colors.text, fontSize: 18, fontWeight: '700',
    paddingHorizontal: 20, marginTop: 24, marginBottom: 12,
  },

  // Plans
  planCard: {
    backgroundColor: Colors.card, borderRadius: 18,
    marginHorizontal: 16, marginBottom: 12,
    padding: 16, borderWidth: 1, borderColor: Colors.border,
  },
  planTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  planIconCircle: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border, marginRight: 12,
  },
  planInfo: { flex: 1 },
  planTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  planTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  levelBadge: {
    borderRadius: 6, borderWidth: 1,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  levelText: { fontSize: 11, fontWeight: '600' },
  planMeta: { color: Colors.textMuted, fontSize: 13 },
  planDesc: { color: Colors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 12 },
  planBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card2, borderRadius: 10,
    paddingVertical: 10, paddingHorizontal: 14,
    alignSelf: 'flex-start',
    borderWidth: 1, borderColor: Colors.border,
  },
  planBtnText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },

  // Challenges
  challengeGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginHorizontal: 12, gap: 10,
  },
  challengeCard: {
    width: '47%', backgroundColor: Colors.card,
    borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  challengeDone: { borderColor: Colors.success, backgroundColor: '#0a1f11' },
  challengeIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.card2,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 10,
  },
  challengeIconDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  challengeTitle: { color: Colors.text, fontSize: 13, fontWeight: '600', marginBottom: 8, lineHeight: 18 },
  challengeTitleDone: { color: Colors.success },
  pointsBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pointsText: { color: '#f59e0b', fontSize: 12, fontWeight: '600' },

  // Tips
  tipCard: {
    backgroundColor: Colors.card, borderRadius: 14,
    marginHorizontal: 16, marginBottom: 8,
    padding: 14, borderWidth: 1, borderColor: Colors.border,
  },
  tipRow: { flexDirection: 'row', alignItems: 'center' },
  tipIconCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.card2,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border, marginRight: 12,
  },
  tipTitle: { flex: 1, color: Colors.text, fontSize: 15, fontWeight: '600' },
  tipBody: {
    color: Colors.textMuted, fontSize: 13, lineHeight: 20,
    marginTop: 12, paddingLeft: 44,
  },

  // Links
  linksRow: {
    flexDirection: 'row', marginHorizontal: 16, gap: 10,
  },
  linkCard: {
    flex: 1, backgroundColor: Colors.card,
    borderRadius: 14, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  linkLabel: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', fontWeight: '500' },
})