import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'

interface RouteActionButtonsProps {
  dist: number
  waypointCount: number
  onStartRun: () => void
}

export function RouteActionButtons({
  dist,
  waypointCount,
  onStartRun,
}: RouteActionButtonsProps) {
  const hasRoute = waypointCount >= 2

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={[styles.primaryBtn, !hasRoute && styles.primaryBtnDim]}
        onPress={onStartRun}
        activeOpacity={0.88}
      >
        <Text style={styles.primaryText}>
          {!hasRoute ? 'Add at least 2 points' : `Start  ·  ${dist.toFixed(2)} km`}
        </Text>
        {hasRoute && <FontAwesome5 name="arrow-right" size={14} color="#fff" />}
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnDim: { opacity: 0.45, shadowOpacity: 0 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
})