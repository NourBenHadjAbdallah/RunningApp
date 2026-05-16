// components/Explore/BattleTab/HowItWorksCard.tsx

import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../../../constants/colors'
import { RED, HOW_STEPS, goToBattle } from './constants'

function HowItWorksCardComponent() {
  const [open, setOpen] = useState(false)

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.toggle}
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.8}
      >
        <Text style={styles.heading}>How Battle Zone works</Text>
        <FontAwesome5
          name={open ? 'chevron-up' : 'chevron-down'}
          size={12}
          color={Colors.textMuted}
        />
      </TouchableOpacity>

      {open && (
        <>
          {HOW_STEPS.map((s, i) => (
            <View key={i} style={styles.row}>
              <View style={[styles.iconBox, { backgroundColor: s.color + '1a' }]}>
                <FontAwesome5 name={s.icon as any} size={13} color={s.color} />
              </View>
              <Text style={styles.text}>{s.text}</Text>
            </View>
          ))}
          <TouchableOpacity style={styles.btn} onPress={goToBattle} activeOpacity={0.85}>
            <FontAwesome5 name="map-marked-alt" size={13} color="#fff" />
            <Text style={styles.btnTxt}>Open Tracking Map</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  )
}

const HowItWorksCard = React.memo(HowItWorksCardComponent)
export default HowItWorksCard

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    padding: 16, marginBottom: 16, gap: 12,
  },
  toggle:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 32, height: 32, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  text:    { color: Colors.textMuted, fontSize: 13, flex: 1, lineHeight: 18 },
  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: RED, borderRadius: 12, paddingVertical: 12, marginTop: 4,
  },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
})