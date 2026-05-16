// screens/ExploreScreen.tsx

import React, { useCallback, useEffect, useState } from 'react'
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { activityService, TrainingProgram } from '../services/activityService'
import { Colors } from '../constants/colors'
import ChallengesTab from '../components/Explore/ChallengesTab'
import BattleTab     from '../components/Explore/BattleTab/BattleTab'

type ExploreTab = 'challenges' | 'programs' | 'battle'

const LEVEL_COLOR: Record<TrainingProgram['level'], string> = {
  Beginner: Colors.success, Intermediate: '#f59e0b', Advanced: Colors.primary,
}
const BATTLE_RED = '#ef4444'

const TABS: { key: ExploreTab; label: string; icon: string }[] = [
  { key: 'challenges', label: 'Challenges', icon: 'trophy'    },
  { key: 'programs',   label: 'Programs',   icon: 'list-alt'  },
  { key: 'battle',     label: 'Battle',     icon: 'shield-alt'},
]

// ─── Programs tab ─────────────────────────────────────────────────────────────

function ProgramsTab() {
  const [programs,        setPrograms]        = useState<TrainingProgram[]>([])
  const [loading,         setLoading]         = useState(true)
  const [expandedProgram, setExpandedProgram] = useState<string | null>(null)

  const load = useCallback(async () => {
    try { setPrograms(await activityService.getPrograms()) }
    catch (e) { console.error('Programs error:', e) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleToggle = async (p: TrainingProgram) => {
    setPrograms(prev => prev.map(x => x.id === p.id ? { ...x, enrolled: !x.enrolled } : x))
    try {
      if (p.enrolled) await activityService.unenrollProgram(p.id)
      else { await activityService.enrollProgram(p.id); Alert.alert('Enrolled!', `You've started "${p.title}". Good luck!`) }
    } catch (e: any) {
      Alert.alert('Error', e.message)
      setPrograms(prev => prev.map(x => x.id === p.id ? { ...x, enrolled: p.enrolled } : x))
    }
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={Colors.primary} /></View>

  if (programs.length === 0) {
    return (
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.empty}>
          <View style={s.emptyIcon}><FontAwesome5 name="list-alt" size={28} color={Colors.textMuted} /></View>
          <Text style={s.emptyTitle}>No programs yet</Text>
          <Text style={s.emptyText}>Training programs will appear here once added.</Text>
        </View>
      </ScrollView>
    )
  }

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
      {programs.map(p => {
        const expanded   = expandedProgram === p.id
        const levelColor = LEVEL_COLOR[p.level]
        return (
          <View key={p.id} style={s.programCard}>
            <View style={s.programTop}>
              <View style={[s.programIcon, { borderColor: levelColor }]}>
                <FontAwesome5 name={p.icon as any} size={18} color={levelColor} />
              </View>
              <View style={s.programInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <Text style={s.programTitle}>{p.title}</Text>
                  <View style={[s.levelBadge, { borderColor: levelColor }]}>
                    <Text style={[s.levelTxt, { color: levelColor }]}>{p.level}</Text>
                  </View>
                </View>
                {p.subtitle ? <Text style={s.programSub}>{p.subtitle}</Text> : null}
                <Text style={s.programMeta}>{p.weeks} weeks · {p.runs_per_week} runs/week</Text>
              </View>
            </View>

            {p.description ? <Text style={s.programDesc}>{p.description}</Text> : null}

            {expanded && Array.isArray(p.phases) && p.phases.length > 0 && (
              <View style={s.phasesWrap}>
                <Text style={s.phasesTitle}>Training Phases</Text>
                {p.phases.map((ph: any, i: number) => (
                  <View key={i} style={s.phaseRow}>
                    <View style={s.phaseDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.phaseName}>{ph.name} <Text style={s.phaseWeeks}>({ph.weeks} wk)</Text></Text>
                      <Text style={s.phaseFocus}>{ph.focus}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={s.programFooter}>
              {Array.isArray(p.phases) && p.phases.length > 0 && (
                <TouchableOpacity style={s.detailsBtn} onPress={() => setExpandedProgram(expanded ? null : p.id)}>
                  <Text style={s.detailsBtnTxt}>{expanded ? 'Hide' : 'View phases'}</Text>
                  <FontAwesome5 name={expanded ? 'chevron-up' : 'chevron-down'} size={11} color={Colors.primary} style={{ marginLeft: 6 }} />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[s.enrollBtn, p.enrolled && s.enrollBtnActive]} onPress={() => handleToggle(p)}>
                <Text style={[s.enrollTxt, p.enrolled && s.enrollTxtActive]}>{p.enrolled ? '✓ Enrolled' : 'Start Program'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )
      })}
    </ScrollView>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ExploreScreen() {
  const [tab, setTab] = useState<ExploreTab>('challenges')

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>Explore</Text>
          <Text style={s.headerSub}>{tab === 'battle' ? 'Territory conquest leaderboard' : 'Challenges, programs & training'}</Text>
        </View>
      </View>

      <View style={s.tabBar}>
        {TABS.map(t => {
          const active  = tab === t.key
          const color   = t.key === 'battle' ? BATTLE_RED : Colors.primary
          return (
            <TouchableOpacity key={t.key} style={[s.tabBtn, active && s.tabBtnActive]} onPress={() => setTab(t.key)} activeOpacity={0.8}>
              <FontAwesome5 name={t.icon as any} size={13} color={active ? color : Colors.textMuted} />
              <Text style={[s.tabLabel, active && { color }]}>{t.label}</Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <View style={{ flex: 1 }}>
        {tab === 'challenges' && <ChallengesTab />}
        {tab === 'programs'   && <ProgramsTab  />}
        {tab === 'battle'     && <BattleTab    />}
      </View>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { paddingHorizontal: 16, paddingBottom: 30 },

  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 60, paddingBottom: 14, paddingHorizontal: 20 },
  headerTitle: { color: Colors.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  headerSub:   { color: Colors.textMuted, fontSize: 14, marginTop: 3 },

  tabBar:      { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: Colors.card, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: Colors.border },
  tabBtn:      { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 11 },
  tabBtnActive:{ backgroundColor: Colors.card2 },
  tabLabel:    { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },

  // Empty
  empty:      { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 20 },
  emptyIcon:  { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.card2, justifyContent: 'center', alignItems: 'center', marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  emptyTitle: { color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptyText:  { color: Colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // Program card
  programCard:  { backgroundColor: Colors.card, borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  programTop:   { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  programIcon:  { width: 50, height: 50, borderRadius: 25, backgroundColor: Colors.card2, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, marginRight: 12 },
  programInfo:  { flex: 1 },
  programTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  levelBadge:   { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2 },
  levelTxt:     { fontSize: 11, fontWeight: '600' },
  programSub:   { color: Colors.textMuted, fontSize: 13, marginBottom: 3 },
  programMeta:  { color: Colors.textMuted, fontSize: 12 },
  programDesc:  { color: Colors.textMuted, fontSize: 13, lineHeight: 20, marginBottom: 14 },

  phasesWrap:  { backgroundColor: Colors.card2, borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: Colors.border },
  phasesTitle: { color: Colors.text, fontSize: 13, fontWeight: '700', marginBottom: 12 },
  phaseRow:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  phaseDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 5, marginRight: 10, flexShrink: 0 },
  phaseName:   { color: Colors.text, fontSize: 13, fontWeight: '600' },
  phaseWeeks:  { color: Colors.textMuted, fontWeight: '400' },
  phaseFocus:  { color: Colors.textMuted, fontSize: 12, lineHeight: 16, marginTop: 2 },

  programFooter: { flexDirection: 'row', gap: 10 },
  detailsBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card2, borderRadius: 10, paddingVertical: 10, borderWidth: 1, borderColor: Colors.border },
  detailsBtnTxt: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
  enrollBtn:     { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.primary, borderRadius: 10, paddingVertical: 10 },
  enrollBtnActive:{ backgroundColor: Colors.card2, borderWidth: 1, borderColor: Colors.success },
  enrollTxt:     { color: '#fff', fontSize: 13, fontWeight: '700' },
  enrollTxtActive:{ color: Colors.success },
})