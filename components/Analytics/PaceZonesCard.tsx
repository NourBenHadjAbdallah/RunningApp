// components/Analytics/PaceZonesCard.tsx
import React from 'react'
import { View, Text, StyleSheet, Dimensions } from 'react-native'
import { Colors } from '../../constants/colors'

const SCREEN_W   = Dimensions.get('window').width
const MAX_BAR_W  = SCREEN_W - 180

export interface PaceZone {
  zone: number           // 1–6
  percentage: number     // 0–100
  pace_range?: string    // e.g. "5:05–5:40"
}

const ZONE_COLORS = [
  '#93c5fd', // Z1 — light blue
  '#60a5fa', // Z2
  '#3b82f6', // Z3
  '#2563eb', // Z4
  '#1d4ed8', // Z5
  '#1e3a8a', // Z6 — deep blue
]

interface Props {
  zones: PaceZone[]
  /** Optional: predicted 5K time string shown as subtitle */
  predicted5K?: string
}

export function PaceZonesCard({ zones, predicted5K }: Props) {
  if (!zones || zones.length === 0) return null

  // Sort Z6 → Z1 (highest intensity first, matching Strava layout)
  const sorted = [...zones].sort((a, b) => b.zone - a.zone)
  const maxPct  = Math.max(...sorted.map(z => z.percentage))

  return (
    <View style={styles.card}>
      {predicted5K && (
        <Text style={styles.subtitle}>Based on your predicted 5K time of {predicted5K}</Text>
      )}

      {sorted.map((z, i) => {
        const barW = maxPct > 0 ? (z.percentage / maxPct) * MAX_BAR_W : 0
        const color = ZONE_COLORS[z.zone - 1] ?? Colors.primary
        const isHighlighted = z.percentage === maxPct

        return (
          <View key={z.zone} style={styles.zoneRow}>
            {/* Zone label */}
            <Text style={styles.zoneLabel}>Z{z.zone}</Text>

            {/* Bar */}
            <View style={styles.barTrack}>
              <View style={[
                styles.bar,
                { width: barW, backgroundColor: color },
                isHighlighted && styles.barHighlighted,
              ]} />
              <Text style={[styles.pctLabel, { color: isHighlighted ? Colors.text : Colors.textMuted }]}>
                {z.percentage}%
              </Text>
            </View>

            {/* Pace range */}
            {z.pace_range ? (
              <Text style={styles.paceRange}>{z.pace_range}</Text>
            ) : (
              <View style={{ width: 68 }} />
            )}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card2,
    marginHorizontal: 16, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 14, paddingHorizontal: 16,
  },
  subtitle: {
    color: Colors.textMuted, fontSize: 12,
    marginBottom: 14,
  },
  zoneRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 10, gap: 10,
  },
  zoneLabel: {
    width: 24, color: Colors.textMuted,
    fontSize: 12, fontWeight: '700',
  },
  barTrack: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', gap: 8,
  },
  bar: {
    height: 10, borderRadius: 5,
    minWidth: 4,
  },
  barHighlighted: { opacity: 1 },
  pctLabel: {
    fontSize: 12, fontWeight: '600',
  },
  paceRange: {
    width: 68, textAlign: 'right',
    color: Colors.textMuted, fontSize: 11,
  },
})