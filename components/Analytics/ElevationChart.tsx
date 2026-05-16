// components/Analytics/ElevationChart.tsx
import React from 'react'
import { View, Text, StyleSheet, Dimensions } from 'react-native'
import Svg, { Path, Defs, LinearGradient, Stop, Line, Text as SvgText } from 'react-native-svg'
import { Colors } from '../../constants/colors'

const SCREEN_W = Dimensions.get('window').width
const CHART_W  = SCREEN_W - 32
const CHART_H  = 140

interface Props {
  /** Array of { distance_km, elevation_m } data points */
  data: { distance_km: number; elevation_m: number }[]
  elevationGain: number
  maxElevation: number
}

function buildAreaPath(
  points: { x: number; y: number }[],
  w: number,
  h: number,
): string {
  if (points.length === 0) return ''
  const move = `M ${points[0].x} ${points[0].y}`
  const lines = points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ')
  const close = `L ${points[points.length - 1].x} ${h} L ${points[0].x} ${h} Z`
  return `${move} ${lines} ${close}`
}

export function ElevationChart({ data, elevationGain, maxElevation }: Props) {
  const card = (
    <View style={styles.statsRow}>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{elevationGain} m</Text>
        <Text style={styles.statLabel}>Elevation Gain</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{maxElevation} m</Text>
        <Text style={styles.statLabel}>Max Elevation</Text>
      </View>
    </View>
  )

  if (data.length < 2) {
    return (
      <View style={styles.card}>
        {card}
      </View>
    )
  }

  const PAD = { top: 16, right: 12, bottom: 28, left: 36 }
  const innerW = CHART_W - PAD.left - PAD.right - 32 // 32 for card padding
  const innerH = CHART_H - PAD.top - PAD.bottom

  const minDist = data[0].distance_km
  const maxDist = data[data.length - 1].distance_km
  const minElev = Math.min(...data.map(d => d.elevation_m))
  const maxElev = Math.max(...data.map(d => d.elevation_m))
  const elevRange = maxElev - minElev || 1
  const distRange = maxDist - minDist || 1

  const toX = (dist: number) => PAD.left + ((dist - minDist) / distRange) * innerW
  const toY = (elev: number) => PAD.top + (1 - (elev - minElev) / elevRange) * innerH

  const points = data.map(d => ({ x: toX(d.distance_km), y: toY(d.elevation_m) }))
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaPath = buildAreaPath(points, CHART_W, PAD.top + innerH)

  // Y-axis labels (3 ticks)
  const yTicks = [minElev, minElev + elevRange / 2, maxElev].map(v => ({
    label: `${Math.round(v)}`,
    y: toY(v),
  }))

  // X-axis labels (start / mid / end)
  const xTicks = [minDist, (minDist + maxDist) / 2, maxDist].map(v => ({
    label: `${v.toFixed(0)} km`,
    x: toX(v),
  }))

  return (
    <View style={styles.card}>
      <Svg width={CHART_W - 32} height={CHART_H} style={styles.svg}>
        <Defs>
          <LinearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor={Colors.textMuted} stopOpacity="0.5" />
            <Stop offset="1"   stopColor={Colors.textMuted} stopOpacity="0.05" />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {yTicks.map((t, i) => (
          <Line
            key={i}
            x1={PAD.left} y1={t.y}
            x2={PAD.left + innerW} y2={t.y}
            stroke={Colors.border} strokeWidth={1}
          />
        ))}

        {/* Y labels */}
        {yTicks.map((t, i) => (
          <SvgText
            key={i}
            x={PAD.left - 4} y={t.y + 4}
            fontSize={9} fill={Colors.textMuted}
            textAnchor="end"
          >
            {t.label}
          </SvgText>
        ))}

        {/* Area fill */}
        <Path d={areaPath} fill="url(#elevGrad)" />

        {/* Line */}
        <Path d={linePath} stroke={Colors.textMuted} strokeWidth={1.5} fill="none" />

        {/* X labels */}
        {xTicks.map((t, i) => (
          <SvgText
            key={i}
            x={t.x} y={PAD.top + innerH + 18}
            fontSize={9} fill={Colors.textMuted}
            textAnchor="middle"
          >
            {t.label}
          </SvgText>
        ))}

        {/* Y axis unit */}
        <SvgText x={2} y={PAD.top} fontSize={9} fill={Colors.textMuted}>m</SvgText>
      </Svg>

      {card}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card2,
    marginHorizontal: 16, borderRadius: 16,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 14, paddingHorizontal: 16,
    overflow: 'hidden',
  },
  svg: { alignSelf: 'center', marginBottom: 4 },
  statsRow: {
    flexDirection: 'row', marginTop: 8,
    backgroundColor: Colors.card,
    borderRadius: 12, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.border,
  },
  statItem:   { flex: 1, alignItems: 'center' },
  statValue:  { color: Colors.text, fontSize: 16, fontWeight: '700' },
  statLabel:  { color: Colors.textMuted, fontSize: 11, marginTop: 3 },
  statDivider:{ width: 1, backgroundColor: Colors.border },
})