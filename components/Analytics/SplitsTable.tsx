// components/Analytics/SplitsTable.tsx
import React from 'react'
import { View, Text, StyleSheet, Dimensions } from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'

const SCREEN_W = Dimensions.get('window').width

export interface Split {
  km: number
  pace_sec_per_km: number  // e.g. 329 for 5:29
  elevation_m?: number     // gain/loss for this km, negative = descent
}

interface Props {
  splits: Split[]
  avgPace: number // sec/km — used to colour-code
}

function formatPace(sec: number): string {
  if (!sec || sec <= 0) return '--:--'
  const m = Math.floor(sec / 60)
  const s = Math.round(sec % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Bar width as fraction of max pace spread — wider = slower */
function barFraction(pace: number, min: number, max: number): number {
  if (max === min) return 0.6
  return 0.25 + 0.75 * ((pace - min) / (max - min))
}

const MAX_BAR_W = SCREEN_W - 200

export function SplitsTable({ splits, avgPace }: Props) {
  if (!splits || splits.length === 0) return null

  const paces = splits.map(s => s.pace_sec_per_km).filter(Boolean)
  const minP   = Math.min(...paces)
  const maxP   = Math.max(...paces)

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, { width: 32 }]}>Km</Text>
        <Text style={[styles.headerCell, { width: 56 }]}>Pace</Text>
        <Text style={[styles.headerCell, { flex: 1 }]}></Text>
        <Text style={[styles.headerCell, { width: 40, textAlign: 'right' }]}>Elev</Text>
      </View>

      {splits.map((split, i) => {
        const isFaster = split.pace_sec_per_km < avgPace
        const isSlowest = split.pace_sec_per_km === maxP
        const fraction  = barFraction(split.pace_sec_per_km, minP, maxP)
        const barW      = fraction * MAX_BAR_W
        const hasElev   = split.elevation_m != null

        return (
          <View
            key={i}
            style={[styles.row, i === splits.length - 1 && styles.rowLast]}
          >
            {/* Km number */}
            <Text style={styles.kmCell}>{split.km}</Text>

            {/* Pace */}
            <Text style={[
              styles.paceCell,
              isFaster ? styles.paceFast : styles.paceSlow,
            ]}>
              {formatPace(split.pace_sec_per_km)}
            </Text>

            {/* Bar */}
            <View style={styles.barTrack}>
              <View style={[
                styles.bar,
                { width: barW },
                isFaster ? styles.barFast : styles.barSlow,
              ]} />
            </View>

            {/* Elevation */}
            {hasElev ? (
              <View style={styles.elevCell}>
                <FontAwesome5
                  name={split.elevation_m! > 0 ? 'arrow-up' : 'arrow-down'}
                  size={8}
                  color={split.elevation_m! > 0 ? '#ef4444' : '#22c55e'}
                />
                <Text style={styles.elevText}>
                  {Math.abs(split.elevation_m!)}
                </Text>
              </View>
            ) : (
              <View style={styles.elevCell} />
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
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: Colors.card,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerCell: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowLast: { borderBottomWidth: 0 },

  kmCell:   { width: 32, color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  paceCell: { width: 56, fontSize: 13, fontWeight: '700' },
  paceFast: { color: Colors.primary },
  paceSlow: { color: Colors.text },

  barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Colors.border, overflow: 'hidden' },
  bar:      { height: 6, borderRadius: 3 },
  barFast:  { backgroundColor: Colors.primary },
  barSlow:  { backgroundColor: `${Colors.primary}88` },

  elevCell: {
    width: 40, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'flex-end', gap: 2,
  },
  elevText: { color: Colors.textMuted, fontSize: 11 },
})