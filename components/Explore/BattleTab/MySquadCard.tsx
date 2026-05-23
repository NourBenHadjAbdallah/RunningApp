// components/Explore/BattleTab/MySquadCard.tsx

import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../../../constants/colors'
import { Squad } from '../../../services/squadService'
import { INDIGO } from './constants'

const MySquadCard = React.memo(function MySquadCard({
  squad, zoneCount, onOpenModal, onLeave,
}: { squad: Squad | null; zoneCount: number; onOpenModal: () => void; onLeave: () => void }) {
  if (!squad) {
    return (
      <TouchableOpacity style={s.emptyCard} onPress={onOpenModal} activeOpacity={0.85}>
        <View style={s.emptyIcon}>
          <FontAwesome5 name="users" size={18} color={INDIGO} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.emptyTitle}>No squad yet</Text>
          <Text style={s.emptySub}>Create or join a squad to battle together</Text>
        </View>
        <View style={s.emptyPlus}>
          <FontAwesome5 name="plus" size={13} color={INDIGO} />
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={s.card}>
      {squad.photo_url
        ? <Image source={{ uri: squad.photo_url }} style={s.cover} />
        : <View style={[s.cover, s.coverFallback]}><Text style={{ fontSize: 38 }}>{squad.emoji}</Text></View>}

      <View style={s.info}>
        <View style={s.infoRow}>
          <Text style={{ fontSize: 24 }}>{squad.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.name} numberOfLines={1}>{squad.name}</Text>
            {squad.city ? <Text style={s.city}>{squad.city}</Text> : null}
          </View>
          <View style={s.zonePill}>
            <FontAwesome5 name="flag" size={10} color={INDIGO} />
            <Text style={s.zoneCount}>{zoneCount}</Text>
          </View>
        </View>

        {squad.description ? <Text style={s.desc} numberOfLines={2}>{squad.description}</Text> : null}

        <View style={s.footer}>
          <View style={s.codePill}>
            <FontAwesome5 name="link" size={10} color={INDIGO} />
            <Text style={s.codeLabel}>Invite: </Text>
            <Text style={s.code}>{squad.invite_code}</Text>
          </View>
          <TouchableOpacity style={s.leaveBtn} onPress={onLeave}>
            <Text style={s.leaveTxt}>Leave</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  )
})

export default MySquadCard

const s = StyleSheet.create({
  emptyCard:  { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 12 },
  emptyIcon:  { width: 42, height: 42, borderRadius: 12, backgroundColor: INDIGO + '18', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: INDIGO + '44' },
  emptyTitle: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  emptySub:   { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  emptyPlus:  { width: 32, height: 32, borderRadius: 10, backgroundColor: INDIGO + '18', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: INDIGO + '44' },
  card:          { backgroundColor: Colors.card, borderRadius: 18, borderWidth: 1, borderColor: INDIGO + '55', marginBottom: 12, overflow: 'hidden' },
  cover:         { width: '100%', height: 100 },
  coverFallback: { backgroundColor: INDIGO + '22', justifyContent: 'center', alignItems: 'center' },
  info:          { padding: 14 },
  infoRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  name:          { color: Colors.text, fontSize: 16, fontWeight: '800' },
  city:          { color: Colors.textMuted, fontSize: 12, marginTop: 1 },
  zonePill:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: INDIGO + '18', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: INDIGO + '44' },
  zoneCount:     { color: INDIGO, fontSize: 13, fontWeight: '800' },
  desc:          { color: Colors.textMuted, fontSize: 13, lineHeight: 18, marginBottom: 10 },
  footer:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codePill:      { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: INDIGO + '10', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 7, borderWidth: 1, borderColor: INDIGO + '33' },
  codeLabel:     { color: INDIGO, fontSize: 12 },
  code:          { color: INDIGO, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  leaveBtn:      { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 9, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.card2 },
  leaveTxt:      { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
})