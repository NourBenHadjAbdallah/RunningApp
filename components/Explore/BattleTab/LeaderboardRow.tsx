// components/Explore/BattleTab/LeaderboardRow.tsx

import React from 'react'
import { View, Text, StyleSheet, Image } from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../../../constants/colors'
import { RED, GREEN, RANK_COLORS, initials, sharedStyles } from './constants'
import { EnrichedEntry } from './types'

// ─── Shared zone pill ─────────────────────────────────────────────────────────

export const ZonePill = React.memo(function ZonePill({
  count, color, isActive,
}: { count: number; color: string; isActive: boolean }) {
  return (
    <View style={[sharedStyles.pill, isActive && { backgroundColor: color + '18', borderColor: color + '44' }]}>
      <FontAwesome5 name="flag" size={10} color={isActive ? color : Colors.textMuted} />
      <Text style={[sharedStyles.pillTxt, isActive && { color }]}>{count}</Text>
    </View>
  )
})

// ─── Row ─────────────────────────────────────────────────────────────────────

const LeaderboardRow = React.memo(function LeaderboardRow({
  entry, rank, isMe,
}: { entry: EnrichedEntry; rank: number; isMe: boolean }) {
  const rankColor = RANK_COLORS[rank - 1] ?? Colors.textMuted
  const isTop3    = rank <= 3

  return (
    <View style={[s.row, isMe && s.rowMe]}>
      <View style={s.rankWrap}>
        {isTop3
          ? <FontAwesome5 name="medal" size={20} color={rankColor} />
          : <Text style={[s.rank, { color: rankColor }]}>{rank}</Text>}
        {isTop3 && rank === 1 && (
          <FontAwesome5 name="crown" size={9} color={rankColor} style={{ marginTop: 2 }} />
        )}
      </View>

      {entry.avatar_url
        ? <Image source={{ uri: entry.avatar_url }} style={s.avatar} />
        : (
          <View style={[s.avatarFb, isMe && s.avatarFbMe]}>
            <Text style={s.avatarTxt}>{initials(entry.owner_name ?? '?')}</Text>
          </View>
        )}

      <View style={s.mid}>
        <Text style={[s.name, isMe && s.nameMe]} numberOfLines={1}>
          {isMe ? 'You' : entry.owner_name}
        </Text>
        {!!entry.delta && entry.delta !== 0 && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <FontAwesome5 name={entry.delta > 0 ? 'arrow-up' : 'arrow-down'} size={9} color={entry.delta > 0 ? GREEN : RED} />
            <Text style={[s.delta, { color: entry.delta > 0 ? GREEN : RED }]}>{Math.abs(entry.delta)}</Text>
          </View>
        )}
      </View>

      <ZonePill count={entry.zone_count} color={Colors.primary} isActive={isMe} />
    </View>
  )
})

export default LeaderboardRow

const s = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: Colors.card, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  rowMe:    { borderColor: Colors.primary + '55', backgroundColor: Colors.primary + '0a' },
  rankWrap: { width: 68, alignItems: 'center' },
  rank:     { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  avatar:   { width: 40, height: 40, borderRadius: 20 },
  avatarFb: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.card2, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  avatarFbMe: { backgroundColor: Colors.primary + '18', borderColor: Colors.primary + '55' },
  avatarTxt:  { color: Colors.textMuted, fontSize: 14, fontWeight: '700' },
  mid:      { flex: 1 },
  name:     { color: Colors.text, fontSize: 14, fontWeight: '600' },
  nameMe:   { color: Colors.primary, fontWeight: '800' },
  delta:    { fontSize: 11, fontWeight: '700' },
})