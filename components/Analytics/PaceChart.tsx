// components/Analytics/PaceChart.tsx
import React from 'react'
import { View, Text, StyleSheet, Dimensions } from 'react-native'
import Svg, { Path, Defs, LinearGradient, Stop, Line, Text as SvgText } from 'react-native-svg'
import { Colors } from '../../constants/colors'
import { formatTime, formatPace } from '../../utils/calculations'

const SCREEN_W = Dimensions.get('window').width
const CHART_W  = SCREEN_W - 32
const CHART_H  = 150

interface Props {
  /** Array of { distance_km, pace_sec_per_km } */
  data: { distance_km: number; pace_sec_per_km: number }[]
  avgPace: number      // sec/km
  movingTime: number   // seconds
  fastestSplit: number // sec/km
}

function formatPaceLabel(secPerKm: number): string {
  if (!secPerKm || secPerKm <= 0) return '--'
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function PaceChart({ data, avgPace, movingTime, fastestSplit }: Props) {
  const statsRow = (
    <View style={styles.statsRow}>
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{formatPaceLabel(avgPace)}</Text>
        <Text style={styles.statLabel}>Avg Pace</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{formatTime(movingTime)}</Text>
        <Text style={styles.statLabel}>Moving Time</Text>
      </View>
      <View style={styles.statDivider} />
      <View style={styles.statItem}>
        <Text style={styles.statValue}>{formatPaceLabel(fastestSplit)}</Text>
        <Text style={styles.statLabel}>Fastest Split</Text>
      </View>
    </View>
  )

  if (data.length < 2) {
    return <View style={styles.card}>{statsRow}</View>
  }

  const PAD = { top: 16, right: 12, bottom: 28, left: 46 }
  const innerW = CHART_W - PAD.left - PAD.right - 32
  const innerH = CHART_H - PAD.top - PAD.bottom

  // Clamp outliers (GPS noise): ignore paces < 2 min/km or > 15 min/km
  const valid = data.filter(d => d.pace_sec_per_km >= 120 && d.pace_sec_per_km <= 900)
  const minDist = data[0].distance_km
  const maxDist = data[data.length - 1].distance_km
  const distRange = maxDist - minDist || 1

  // Pace axis: lower pace (faster) at TOP — invert Y
  const paceVals = valid.map(d => d.pace_sec_per_km)
  const minPace  = Math.min(...paceVals) * 0.95
  const maxPace  = Math.max(...paceVals) * 1.05
  const paceRange = maxPace - minPace || 1

  const toX = (dist: number) => PAD.left + ((dist - minDist) / distRange) * innerW
  const toY = (pace: number) => PAD.top + ((pace - minPace) / paceRange) * innerH

  const points = data
    .filter(d => d.pace_sec_per_km >= 120 && d.pace_sec_per_km <= 900)
    .map(d => ({ x: toX(d.distance_km), y: toY(d.pace_sec_per_km) }))

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const bottomY  = PAD.top + innerH
  const areaPath = points.length > 0
    ? `${linePath} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`
    : ''

  // Avg pace line
  const avgY = toY(avgPace)

  // Y ticks (pace labels)
  const yTicks = [minPace, avgPace, maxPace].map(v => ({ label: formatPaceLabel(v), y: toY(v) }))

  // X ticks
  const xTicks = [minDist, (minDist + maxDist) / 2, maxDist].map(v => ({
    label: `${v.toFixed(0)} km`,
    x: toX(v),
  }))

  return (
    <View style={styles.card}>
      <Svg width={CHART_W - 32} height={CHART_H} style={styles.svg}>
        <Defs>
          <LinearGradient id="paceGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor={Colors.primary} stopOpacity="0.35" />
            <Stop offset="1"   stopColor={Colors.primary} stopOpacity="0.04" />
          </LinearGradient>
        </Defs>

        {/* Grid lines */}
        {yTicks.map((t, i) => (
          <Line
            key={i}
            x1={PAD.left} y1={t.y}
            x2={PAD.left + innerW} y2={t.y}
            stroke={Colors.border} strokeWidth={1}
            strokeDasharray={i === 1 ? '4 3' : undefined}
          />
        ))}

        {/* Y labels */}
        {yTicks.map((t, i) => (
          <SvgText
            key={i}
            x={PAD.left - 4} y={t.y + 4}
            fontSize={9} fill={i === 1 ? Colors.primary : Colors.textMuted}
            textAnchor="end"
          >
            {t.label}
          </SvgText>
        ))}

        {/* Area */}
        {areaPath ? <Path d={areaPath} fill="url(#paceGrad)" /> : null}

        {/* Line */}
        {linePath ? <Path d={linePath} stroke={Colors.primary} strokeWidth={1.5} fill="none" /> : null}

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

        {/* Unit */}
        <SvgText x={2} y={PAD.top} fontSize={9} fill={Colors.textMuted}>/km</SvgText>
      </Svg>

      {statsRow}
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
  statValue:  { color: Colors.text, fontSize: 15, fontWeight: '700' },
  statLabel:  { color: Colors.textMuted, fontSize: 11, marginTop: 3 },
  statDivider:{ width: 1, backgroundColor: Colors.border },
})