// components/Explore/BattleTab/constants.ts

import { StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { Colors } from '../../../constants/colors'

// ─── Tokens ───────────────────────────────────────────────────────────────────

export const RED    = '#ef4444'
export const GOLD   = '#f59e0b'
export const INDIGO = '#6366f1'
export const GREEN  = Colors.success ?? '#22c55e'

export const RANK_COLORS = ['#f59e0b', '#94a3b8', '#cd7f32']

export const EMOJIS = [
  '⚡', '🔥', '🏃', '💪', '🛡️', '⚔️', '🌪️', '🎯',
  '👊', '🚀', '🦅', '🐺', '🦁', '🐉', '⭐',
]

export const HOW_STEPS = [
  { icon: 'shield-alt', color: RED,           text: 'Enable Battle Mode on the tracking map' },
  { icon: 'running',    color: Colors.primary, text: 'Run to claim hexagonal territory zones' },
  { icon: 'crosshairs', color: '#f97316',      text: 'Enter enemy zones to steal them' },
  { icon: 'trophy',     color: GOLD,           text: 'Own the most zones → top the leaderboard' },
  { icon: 'users',      color: INDIGO,         text: 'Your zones automatically count for your squad' },
] as const

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const goToBattle = () =>
  router.push({ pathname: '/(tabs)/track', params: { battleMode: '1' } })

export function initials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Shared styles ────────────────────────────────────────────────────────────

export const sharedStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.card2, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.border,
  },
  pillTxt: { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
})