// components/Explore/BattleTab/MyTerritoryCard.tsx

import React, { useEffect, useRef } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Colors } from '../../../constants/colors'
import { RED, GOLD, INDIGO } from './constants'

// Navigate to tracking tab with battle mode ON and seed the zone count
const goToBattleWithCount = (zoneCount: number) =>
  router.push({
    pathname: '/(tabs)/track',
    params: { battleMode: '1', myZoneCount: String(zoneCount) },
  })

const MyTerritoryCard = React.memo(function MyTerritoryCard({
  rank, zoneCount, squadRank,
}: { rank: number | null; zoneCount: number; squadRank: number | null }) {
  const pulse    = useRef(new Animated.Value(1)).current
  const hasZones = zoneCount > 0

  useEffect(() => {
    if (!hasZones) return
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.07, duration: 900, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1,    duration: 900, useNativeDriver: true }),
    ]))
    loop.start()
    return () => loop.stop()
  }, [hasZones])

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Animated.View style={[s.iconWrap, { transform: [{ scale: pulse }] }]}>
          <FontAwesome5 name="fist-raised" size={22} color={RED} />
        </Animated.View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Your Territory</Text>
          <Text style={s.sub}>{hasZones ? `Ranked #${rank ?? '—'} globally` : 'Start running to claim zones'}</Text>
        </View>
      </View>

      <View style={s.statsRow}>
        {[
          { val: zoneCount,   label: 'Zones owned', color: hasZones ? RED  : Colors.text },
          { val: rank ?? '—', label: 'Global rank',  color: Colors.text },
        ].map((stat, i) => (
          <React.Fragment key={i}>
            {i > 0 && <View style={s.divider} />}
            <View style={s.statBlock}>
              <Text style={[s.statVal, { color: stat.color }]}>{stat.val}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          </React.Fragment>
        ))}
        <View style={s.divider} />
        <View style={s.statBlock}>
          {squadRank !== null ? (
            <>
              <Text style={[s.statVal, { color: INDIGO }]}>#{squadRank}</Text>
              <Text style={s.statLabel}>Squad rank</Text>
            </>
          ) : (
            <>
              <View style={{ height: 30, justifyContent: 'center' }}>
                {hasZones
                  ? <FontAwesome5 name="exclamation-triangle" size={18} color={GOLD} />
                  : <Text style={[s.statVal, { color: Colors.textMuted }]}>—</Text>}
              </View>
              <Text style={s.statLabel}>Under threat</Text>
            </>
          )}
        </View>
      </View>

      {/* CTA — passes the current zoneCount so the HUD starts with the right number */}
      <TouchableOpacity
        style={s.cta}
        onPress={() => goToBattleWithCount(zoneCount)}
        activeOpacity={0.85}
      >
        <FontAwesome5 name="crosshairs" size={15} color="#fff" />
        <Text style={s.ctaText}>{hasZones ? 'Defend & expand territory' : 'Claim your first zone'}</Text>
        <FontAwesome5 name="chevron-right" size={12} color="rgba(255,255,255,0.55)" />
      </TouchableOpacity>
    </View>
  )
})

export default MyTerritoryCard

const s = StyleSheet.create({
  card:      { backgroundColor: Colors.card, borderRadius: 20, borderWidth: 1, borderColor: RED + '44', marginBottom: 12, overflow: 'hidden' },
  header:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  iconWrap:  { width: 46, height: 46, borderRadius: 14, backgroundColor: RED + '18', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: RED + '44' },
  title:     { color: Colors.text, fontSize: 16, fontWeight: '800' },
  sub:       { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  statsRow:  { flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  statBlock: { flex: 1, alignItems: 'center', gap: 3 },
  statVal:   { color: Colors.text, fontSize: 22, fontWeight: '800' },
  statLabel: { color: Colors.textMuted, fontSize: 11 },
  divider:   { width: 1, backgroundColor: Colors.border, marginHorizontal: 4 },
  cta:       { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: RED, paddingHorizontal: 16, paddingVertical: 15 },
  ctaText:   { flex: 1, color: '#fff', fontWeight: '700', fontSize: 14 },
})