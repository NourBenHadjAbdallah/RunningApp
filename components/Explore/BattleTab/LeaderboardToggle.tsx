// components/Explore/BattleTab/LeaderboardToggle.tsx

import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../../../constants/colors'
import { GOLD, INDIGO, RED } from './constants'
import { LbMode } from './types'

const MODES: { key: LbMode; icon: string; label: string; color: string }[] = [
  { key: 'individual', icon: 'user',  label: 'Individual', color: RED   },
  { key: 'groups',     icon: 'users', label: 'Groups',     color: INDIGO },
]

const LeaderboardToggle = React.memo(function LeaderboardToggle({
  lbMode, setLbMode, individualCount, groupCount,
}: {
  lbMode: LbMode
  setLbMode: (m: LbMode) => void
  individualCount: number
  groupCount: number
}) {
  return (
    <>
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
          <FontAwesome5 name="trophy" size={14} color={GOLD} />
          <Text style={s.title}>Leaderboard</Text>
        </View>
        <View style={s.toggle}>
          {MODES.map(m => {
            const active = lbMode === m.key
            return (
              <TouchableOpacity key={m.key} style={[s.tBtn, active && s.tBtnActive]} onPress={() => setLbMode(m.key)} activeOpacity={0.8}>
                <FontAwesome5 name={m.icon as any} size={11} color={active ? m.color : Colors.textMuted} />
                <Text style={[s.tLabel, active && { color: m.color }]}>{m.label}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>
      <Text style={s.sub}>
        {lbMode === 'individual' ? `${individualCount} active runners` : `${groupCount} squads competing`}
      </Text>
    </>
  )
})

export default LeaderboardToggle

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, marginTop: 4 },
  title:  { color: Colors.text, fontSize: 16, fontWeight: '800' },
  sub:    { color: Colors.textMuted, fontSize: 12, marginBottom: 10 },
  toggle: { flexDirection: 'row', backgroundColor: Colors.card2, borderRadius: 12, padding: 3, borderWidth: 1, borderColor: Colors.border },
  tBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 9 },
  tBtnActive: { backgroundColor: Colors.card },
  tLabel:    { color: Colors.textMuted, fontSize: 12, fontWeight: '700' },
})