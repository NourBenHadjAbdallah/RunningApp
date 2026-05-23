import React from 'react'
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native'
import { Colors } from '../../constants/colors'

interface RouteStatsRowProps {
  dist: number
  waypointCount: number
  elevationGain: number
  isSnapping: boolean
}

export function RouteStatsRow({ dist, waypointCount, elevationGain, isSnapping }: RouteStatsRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.stat}>
        <Text style={styles.label}>Distance</Text>
        {isSnapping ? (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 2 }} />
        ) : (
          <Text style={styles.value}>
            {dist > 0 ? dist.toFixed(2) : '–'}{' '}
            <Text style={styles.unit}>km</Text>
          </Text>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.stat}>
        <Text style={styles.label}>Elevation</Text>
        {isSnapping ? (
          <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 2 }} />
        ) : (
          <Text style={styles.value}>
            {elevationGain > 0 ? `+${elevationGain}` : '–'}{' '}
            {elevationGain > 0 && <Text style={styles.unit}>m</Text>}
          </Text>
        )}
      </View>

      <View style={styles.divider} />

      <View style={styles.stat}>
        <Text style={styles.label}>Points</Text>
        <Text style={styles.value}>{waypointCount}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    marginBottom: 6,
  },
  stat: { flex: 1, alignItems: 'center' },
  divider: { width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.1)' },
  label: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  value: { fontSize: 21, fontWeight: '700', color: '#fff', letterSpacing: -0.3 },
  unit: { fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.45)' },
})