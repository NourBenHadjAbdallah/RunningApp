// components/StatGridItem.tsx
import React from 'react'
import { View, Text, StyleSheet, Dimensions } from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'

const SCREEN_WIDTH = Dimensions.get('window').width

interface Props {
  icon: string
  value: string
  unit: string
}

export function StatGridItem({ icon, value, unit }: Props) {
  return (
    <View style={styles.statGridItem}>
      <View style={styles.statIconCircle}>
        <FontAwesome5 name={icon} size={14} color={Colors.primary} />
      </View>
      <Text style={styles.statGridValue}>{value}</Text>
      <Text style={styles.statGridUnit}>{unit}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  statGridItem: {
    width: (SCREEN_WIDTH - 42) / 2,
    backgroundColor: Colors.card,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 18, paddingHorizontal: 16,
    alignItems: 'flex-start', gap: 6,
  },
  statIconCircle: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: `${Colors.primary}18`,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 4,
  },
  statGridValue: { color: Colors.text, fontSize: 22, fontWeight: '800' },
  statGridUnit:  { color: Colors.textMuted, fontSize: 12 },
})