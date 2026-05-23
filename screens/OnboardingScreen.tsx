// screens/OnboardingScreen.tsx
// Post-signup onboarding: goal selection → unit preference → first run CTA
// Show once after account creation, then mark as done in AsyncStorage / Supabase profile

import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Animated,
  Platform,
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { router } from 'expo-router'
import { supabase } from '../services/supabase'
import { Colors } from '../constants/colors'

const { width: SCREEN_W } = Dimensions.get('window')

// ─── Types ────────────────────────────────────────────────────────────────────

type RunGoal = 'lose_weight' | 'get_faster' | '5k' | '10k' | 'half_marathon' | 'marathon' | 'stay_active'
type DistanceUnit = 'km' | 'mi'

const GOALS: { key: RunGoal; icon: string; label: string; sub: string }[] = [
  { key: 'lose_weight',    icon: 'fire',          label: 'Lose Weight',      sub: 'Burn calories consistently' },
  { key: 'get_faster',     icon: 'tachometer-alt', label: 'Run Faster',      sub: 'Improve your pace & VO₂ max' },
  { key: '5k',             icon: 'road',           label: 'Complete a 5K',   sub: 'My first race goal' },
  { key: '10k',            icon: 'route',          label: 'Run 10K',         sub: 'Push beyond the basics' },
  { key: 'half_marathon',  icon: 'medal',          label: 'Half Marathon',   sub: '21.1 km of glory' },
  { key: 'marathon',       icon: 'trophy',         label: 'Full Marathon',   sub: 'The ultimate challenge' },
  { key: 'stay_active',    icon: 'heart',          label: 'Stay Active',     sub: 'Just keep moving every day' },
]

// ─── Step Components ──────────────────────────────────────────────────────────

function WelcomeStep({ onNext, name }: { onNext: () => void; name: string }) {
  return (
    <View style={step.container}>
      <View style={step.iconBig}>
        <FontAwesome5 name="running" size={48} color={Colors.primary} />
      </View>
      <Text style={step.heading}>Welcome{name ? `, ${name}` : ''}! 👋</Text>
      <Text style={step.body}>
        You re just a few steps away from your first run. Let s personalise your experience.
      </Text>
      <View style={step.featureList}>
        {[
          { icon: 'map-marked-alt', label: 'Track every km in real-time' },
          { icon: 'users',          label: 'Join groups & compete' },
          { icon: 'flag-checkered', label: 'Discover local races in Tunisia' },
          { icon: 'chart-line',     label: 'Watch your stats grow' },
        ].map((f) => (
          <View key={f.icon} style={step.featureRow}>
            <View style={step.featureIcon}>
              <FontAwesome5 name={f.icon} size={15} color={Colors.primary} solid />
            </View>
            <Text style={step.featureText}>{f.label}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity style={step.primaryBtn} onPress={onNext} activeOpacity={0.85}>
        <Text style={step.primaryBtnText}>Get Started</Text>
        <FontAwesome5 name="arrow-right" size={14} color="#fff" style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    </View>
  )
}

function GoalStep({
  selected,
  onSelect,
  onNext,
  onBack,
}: {
  selected: RunGoal | null
  onSelect: (g: RunGoal) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <View style={step.container}>
      <Text style={step.stepLabel}>STEP 1 OF 3</Text>
      <Text style={step.heading}>What s your main goal?</Text>
      <Text style={step.body}>We ll tailor tips and training insights around this.</Text>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ width: '100%' }}
        contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
      >
        {GOALS.map((g) => {
          const active = selected === g.key
          return (
            <TouchableOpacity
              key={g.key}
              style={[step.goalCard, active && step.goalCardActive]}
              onPress={() => onSelect(g.key)}
              activeOpacity={0.8}
            >
              <View style={[step.goalIcon, active && step.goalIconActive]}>
                <FontAwesome5 name={g.icon} size={16} color={active ? '#fff' : Colors.primary} solid />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[step.goalLabel, active && step.goalLabelActive]}>{g.label}</Text>
                <Text style={step.goalSub}>{g.sub}</Text>
              </View>
              {active && (
                <View style={step.checkCircle}>
                  <FontAwesome5 name="check" size={10} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </ScrollView>

      <View style={step.navRow}>
        <TouchableOpacity style={step.backBtn} onPress={onBack}>
          <FontAwesome5 name="arrow-left" size={14} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[step.primaryBtn, { flex: 1, marginLeft: 12 }, !selected && step.btnDisabled]}
          onPress={onNext}
          disabled={!selected}
          activeOpacity={0.85}
        >
          <Text style={step.primaryBtnText}>Continue</Text>
          <FontAwesome5 name="arrow-right" size={14} color="#fff" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

function UnitStep({
  selected,
  onSelect,
  onNext,
  onBack,
}: {
  selected: DistanceUnit
  onSelect: (u: DistanceUnit) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <View style={step.container}>
      <Text style={step.stepLabel}>STEP 2 OF 3</Text>
      <Text style={step.heading}>Which unit do you prefer?</Text>
      <Text style={step.body}>You can change this anytime in Settings.</Text>

      <View style={{ width: '100%', gap: 14, marginTop: 8 }}>
        {([
          { key: 'km' as DistanceUnit, label: 'Kilometres', sub: 'Used in most of the world', flag: '🌍' },
          { key: 'mi' as DistanceUnit, label: 'Miles',       sub: 'Used in the US & UK',       flag: '🇺🇸' },
        ]).map((u) => {
          const active = selected === u.key
          return (
            <TouchableOpacity
              key={u.key}
              style={[step.unitCard, active && step.unitCardActive]}
              onPress={() => onSelect(u.key)}
              activeOpacity={0.8}
            >
              <Text style={step.unitFlag}>{u.flag}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[step.unitLabel, active && { color: Colors.primary }]}>{u.label}</Text>
                <Text style={step.unitSub}>{u.sub}</Text>
              </View>
              <View style={[step.radioOuter, active && step.radioOuterActive]}>
                {active && <View style={step.radioInner} />}
              </View>
            </TouchableOpacity>
          )
        })}
      </View>

      <View style={{ flex: 1 }} />

      <View style={step.navRow}>
        <TouchableOpacity style={step.backBtn} onPress={onBack}>
          <FontAwesome5 name="arrow-left" size={14} color={Colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[step.primaryBtn, { flex: 1, marginLeft: 12 }]}
          onPress={onNext}
          activeOpacity={0.85}
        >
          <Text style={step.primaryBtnText}>Continue</Text>
          <FontAwesome5 name="arrow-right" size={14} color="#fff" style={{ marginLeft: 8 }} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

function ReadyStep({ goal, unit, onFinish }: { goal: RunGoal | null; unit: DistanceUnit; onFinish: () => void }) {
  const goalMeta = GOALS.find((g) => g.key === goal)
  return (
    <View style={step.container}>
      <Text style={step.stepLabel}>STEP 3 OF 3</Text>
      <View style={step.successBadge}>
        <FontAwesome5 name="check" size={36} color="#fff" />
      </View>
      <Text style={step.heading}>You re all set! 🎉</Text>
      <Text style={step.body}>Here s your setup summary:</Text>

      <View style={step.summaryCard}>
        <View style={step.summaryRow}>
          <View style={step.summaryIcon}>
            <FontAwesome5 name={goalMeta?.icon ?? 'running'} size={14} color={Colors.primary} solid />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={step.summaryLabel}>Goal</Text>
            <Text style={step.summaryValue}>{goalMeta?.label ?? 'Stay Active'}</Text>
          </View>
        </View>
        <View style={[step.summaryRow, { borderBottomWidth: 0 }]}>
          <View style={step.summaryIcon}>
            <FontAwesome5 name="ruler" size={14} color={Colors.primary} solid />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={step.summaryLabel}>Distance unit</Text>
            <Text style={step.summaryValue}>{unit === 'km' ? 'Kilometres (km)' : 'Miles (mi)'}</Text>
          </View>
        </View>
      </View>

      <View style={step.tipsCard}>
        <Text style={step.tipsTitle}>💡 Quick tips to get started</Text>
        <Text style={step.tipItem}>• Tap the <Text style={{ color: Colors.primary, fontWeight: '700' }}>Track</Text> tab to record your first run</Text>
        <Text style={step.tipItem}>• Use <Text style={{ color: Colors.primary, fontWeight: '700' }}>Plan Route</Text> to map out a run in advance</Text>
        <Text style={step.tipItem}>• Join a <Text style={{ color: Colors.primary, fontWeight: '700' }}>Group</Text> to train with runners near you</Text>
      </View>

      <View style={{ flex: 1 }} />

      <TouchableOpacity style={step.primaryBtn} onPress={onFinish} activeOpacity={0.85}>
        <FontAwesome5 name="running" size={16} color="#fff" style={{ marginRight: 8 }} />
        <Text style={step.primaryBtnText}>Go to the App</Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

const TOTAL_STEPS = 4

export default function OnboardingScreen() {
  const [currentStep, setCurrentStep] = useState(0)
  const [goal, setGoal] = useState<RunGoal | null>(null)
  const [unit, setUnit] = useState<DistanceUnit>('km')
  const [username, setUsername] = useState('')

  const slideX = useRef(new Animated.Value(0)).current

  const animateTo = (nextStep: number) => {
    const dir = nextStep > currentStep ? 1 : -1
    // Slide current out
    Animated.sequence([
      Animated.timing(slideX, { toValue: -dir * SCREEN_W, duration: 220, useNativeDriver: true }),
    ]).start(() => {
      slideX.setValue(dir * SCREEN_W)
      setCurrentStep(nextStep)
      Animated.spring(slideX, { toValue: 0, useNativeDriver: true, tension: 70, friction: 12 }).start()
    })
  }

  const goNext = () => animateTo(currentStep + 1)
  const goBack = () => animateTo(currentStep - 1)

  const handleFinish = async () => {
    // Save preferences to Supabase profile
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.id) {
        await supabase.from('profiles').update({
          onboarding_done: true,
          distance_unit: unit,
          run_goal: goal,
        }).eq('id', session.user.id)
      }
    } catch (e) {
      console.error('Failed to save onboarding prefs', e)
    }
    router.replace('/(tabs)')
  }

  // Progress dots
  const dots = Array.from({ length: TOTAL_STEPS })

  return (
    <View style={styles.container}>
      {/* Progress dots */}
      <View style={styles.dotsRow}>
        {dots.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === currentStep && styles.dotActive,
              i < currentStep && styles.dotDone,
            ]}
          />
        ))}
      </View>

      {/* Skip (only on non-final steps) */}
      {currentStep < TOTAL_STEPS - 1 && (
        <TouchableOpacity style={styles.skipBtn} onPress={handleFinish}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Animated slide area */}
      <Animated.View style={[styles.slide, { transform: [{ translateX: slideX }] }]}>
        {currentStep === 0 && <WelcomeStep onNext={goNext} name={username} />}
        {currentStep === 1 && (
          <GoalStep selected={goal} onSelect={setGoal} onNext={goNext} onBack={goBack} />
        )}
        {currentStep === 2 && (
          <UnitStep selected={unit} onSelect={setUnit} onNext={goNext} onBack={goBack} />
        )}
        {currentStep === 3 && (
          <ReadyStep goal={goal} unit={unit} onFinish={handleFinish} />
        )}
      </Animated.View>
    </View>
  )
}

// ─── Outer Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: Colors.primary,
  },
  dotDone: {
    backgroundColor: Colors.primary + '60',
  },
  skipBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 58 : 42,
    right: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.card2,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  skipText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  slide: {
    flex: 1,
  },
})

// ─── Step Styles (shared across step components) ──────────────────────────────

const step = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 24,
    alignItems: 'center',
  },
  stepLabel: {
    color: Colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  heading: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  body: {
    color: Colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    alignSelf: 'flex-start',
    marginBottom: 24,
  },

  iconBig: {
    width: 110, height: 110, borderRadius: 28,
    backgroundColor: Colors.primary + '18',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 24, marginTop: 8,
    borderWidth: 1.5, borderColor: Colors.primary + '30',
  },

  featureList: { width: '100%', gap: 14, marginBottom: 32 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: Colors.primary + '18',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.primary + '30',
  },
  featureText: { color: Colors.text, fontSize: 15, fontWeight: '500', flex: 1 },

  primaryBtn: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },

  navRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  backBtn: {
    width: 48, height: 52, borderRadius: 14,
    backgroundColor: Colors.card2,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },

  // Goals
  goalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 14,
    gap: 14,
  },
  goalCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '0E',
  },
  goalIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: Colors.primary + '18',
    justifyContent: 'center', alignItems: 'center',
  },
  goalIconActive: { backgroundColor: Colors.primary },
  goalLabel: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  goalLabelActive: { color: Colors.primary },
  goalSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },

  // Units
  unitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
    padding: 18,
    gap: 14,
  },
  unitCardActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '0E',
  },
  unitFlag: { fontSize: 28 },
  unitLabel: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  unitSub: { color: Colors.textMuted, fontSize: 12, marginTop: 3 },
  radioOuter: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  radioOuterActive: { borderColor: Colors.primary },
  radioInner: {
    width: 11, height: 11, borderRadius: 6,
    backgroundColor: Colors.primary,
  },

  // Ready
  successBadge: {
    width: 100, height: 100, borderRadius: 25,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 24, marginTop: 8,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 16, elevation: 10,
  },
  summaryCard: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  summaryIcon: {
    width: 34, height: 34, borderRadius: 8,
    backgroundColor: Colors.primary + '18',
    justifyContent: 'center', alignItems: 'center',
  },
  summaryLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },
  summaryValue: { color: Colors.text, fontSize: 15, fontWeight: '700', marginTop: 2 },

  tipsCard: {
    width: '100%',
    backgroundColor: Colors.card2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 8,
  },
  tipsTitle: { color: Colors.text, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  tipItem: { color: Colors.textMuted, fontSize: 13, lineHeight: 20 },
})