// components/Explore/BattleTab/EmptyLeaderboard.tsx

import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../../../constants/colors'
import { RED, INDIGO, goToBattle } from './constants'
import { LbMode } from './types'

interface Props {
  mode: LbMode
}

function EmptyLeaderboardComponent({ mode }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={[
        styles.circle,
        mode === 'groups' && { borderColor: INDIGO + '44', backgroundColor: INDIGO + '18' },
      ]}>
        <FontAwesome5
          name={mode === 'groups' ? 'users' : 'fist-raised'}
          size={36}
          color={mode === 'groups' ? INDIGO : RED}
        />
      </View>
      <Text style={styles.title}>
        {mode === 'groups' ? 'No squads yet' : 'No territory claimed yet'}
      </Text>
      <Text style={styles.text}>
        {mode === 'groups'
          ? "Create or join a squad above, then run in Battle Mode to build your squad's territory."
          : 'Enable Battle Mode on the tracking screen and run to claim your first hexagon.'}
      </Text>
      <TouchableOpacity
        style={[styles.btn, { backgroundColor: mode === 'groups' ? INDIGO : RED }]}
        onPress={goToBattle}
        activeOpacity={0.85}
      >
        <FontAwesome5 name="running" size={14} color="#fff" />
        <Text style={styles.btnTxt}>Go claim territory</Text>
      </TouchableOpacity>
    </View>
  )
}

const EmptyLeaderboard = React.memo(EmptyLeaderboardComponent)
export default EmptyLeaderboard

const styles = StyleSheet.create({
  wrap:   { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 20 },
  circle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: RED + '18', justifyContent: 'center', alignItems: 'center',
    marginBottom: 14, borderWidth: 1, borderColor: RED + '44',
  },
  title:  { color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  text:   { color: Colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14,
  },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
})