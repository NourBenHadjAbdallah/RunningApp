// components/Explore/BattleTab/GroupLeaderboardRow.tsx

import React from 'react'
import { View, Text, StyleSheet, Image } from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../../../constants/colors'
import { GREEN, RED, INDIGO, RANK_COLORS } from './constants'
import { SquadLeaderboardEntry } from '../../../services/squadService'
import { ZonePill } from './LeaderboardRow'

const GroupLeaderboardRow = React.memo(function GroupLeaderboardRow({
  entry, rank, isMySquad,
}: { entry: SquadLeaderboardEntry; rank: number; isMySquad: boolean }) {
  const rankColor = RANK_COLORS[rank - 1] ?? Colors.textMuted

  return (
    <View style={[s.row, isMySquad && s.rowMine]}>
      <View style={s.rankWrap}>
        {rank <= 3
          ? <FontAwesome5 name="medal" size={20} color={rankColor} />
          : <Text style={[s.rank, { color: rankColor }]}>{rank}</Text>}
      </View>

      {entry.squad_photo_url
        ? <Image source={{ uri: entry.squad_photo_url }} style={s.photo} />
        : (
          <View style={[s.photo, s.photoFb, isMySquad && s.photoFbMine]}>
            <Text style={{ fontSize: 20 }}>{entry.squad_emoji}</Text>
          </View>
        )}

      <View style={s.mid}>
        <Text style={[s.name, isMySquad && s.nameMine]} numberOfLines={1}>
          {entry.squad_name}{isMySquad ? ' (you)' : ''}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <FontAwesome5 name="users" size={9} color={Colors.textMuted} />
          <Text style={s.meta}>{entry.member_count} members</Text>
          {!!entry.delta && entry.delta !== 0 && (
            <>
              <Text style={s.meta}>·</Text>
              <FontAwesome5 name={entry.delta > 0 ? 'arrow-up' : 'arrow-down'} size={9} color={entry.delta > 0 ? GREEN : RED} />
              <Text style={[s.meta, { color: entry.delta > 0 ? GREEN : RED }]}>{Math.abs(entry.delta)}</Text>
            </>
          )}
        </View>
      </View>

      <ZonePill count={entry.zone_count} color={INDIGO} isActive={isMySquad} />
    </View>
  )
})

export default GroupLeaderboardRow

const s = StyleSheet.create({
  row:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: Colors.card, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: Colors.border },
  rowMine:     { borderColor: INDIGO + '55', backgroundColor: INDIGO + '0a' },
  rankWrap:    { width: 36, alignItems: 'center' },
  rank:        { fontSize: 16, fontWeight: '700', color: Colors.textMuted, textAlign: 'center' },
  photo:       { width: 44, height: 44, borderRadius: 12 },
  photoFb:     { backgroundColor: Colors.card2, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  photoFbMine: { backgroundColor: INDIGO + '18', borderColor: INDIGO + '55' },
  mid:         { flex: 1 },
  name:        { color: Colors.text, fontSize: 14, fontWeight: '700' },
  nameMine:    { color: INDIGO, fontWeight: '800' },
  meta:        { color: Colors.textMuted, fontSize: 11 },
})