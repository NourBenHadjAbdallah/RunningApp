import React from 'react'
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'

interface LatLng {
  latitude: number
  longitude: number
}

interface WaypointChipsProps {
  waypoints: LatLng[]
  onClear: () => void
}

export function WaypointChips({ waypoints, onClear }: WaypointChipsProps) {
  if (waypoints.length === 0) {
    return (
      <View style={styles.empty}>
        <FontAwesome5 name="map" size={13} color="rgba(255,255,255,0.2)" />
        <Text style={styles.emptyText}>Tap the map to add waypoints</Text>
      </View>
    )
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
    >
      {waypoints.map((_, i) => (
        <View key={i} style={[
          styles.chip,
          i === 0 && styles.chipStart,
          i === waypoints.length - 1 && i > 0 && styles.chipEnd,
        ]}>
          <Text style={[
            styles.chipText,
            i === 0 && styles.chipTextStart,
            i === waypoints.length - 1 && i > 0 && styles.chipTextEnd,
          ]}>
            {i === 0 ? 'Start' : i === waypoints.length - 1 ? 'End' : `P${i}`}
          </Text>
        </View>
      ))}

      <TouchableOpacity style={styles.clearChip} onPress={onClear} activeOpacity={0.7}>
        <FontAwesome5 name="trash-alt" size={10} color="#ff3b30" />
        <Text style={styles.clearText}>Clear</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
  },
  emptyText: { color: 'rgba(255,255,255,0.25)', fontSize: 13 },

  chips: { alignItems: 'center', gap: 6, paddingRight: 4 },

  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chipStart: {
    backgroundColor: Colors.primary + '22',
    borderColor: Colors.primary + '60',
  },
  chipEnd: {
    backgroundColor: '#ff3b3022',
    borderColor: '#ff3b3060',
  },
  chipText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
  chipTextStart: { color: Colors.primary },
  chipTextEnd:   { color: '#ff3b30' },

  clearChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#ff3b3015',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#ff3b3040',
  },
  clearText: { color: '#ff3b30', fontSize: 12, fontWeight: '600' },
})