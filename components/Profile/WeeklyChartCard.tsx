// components/Profile/WeeklyChartCard.tsx
import React, { useState } from 'react'
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native'
import { LineChart } from 'react-native-chart-kit'
import { Activity } from '../../services/activityService'
import { Colors } from '../../constants/colors'

const SCREEN_WIDTH = Dimensions.get('window').width

function sameWeek(date: Date, weekStart: Date): boolean {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)
  return date >= weekStart && date <= weekEnd
}

interface Props {
  activities: Activity[]
}

export function WeeklyChartCard({ activities }: Props) {
  const [expanded, setExpanded] = useState(false)
  const today = new Date()

  // ── 4-week buckets (built first; stats read from current-week slot) ──────────
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const wStart = new Date(today)
    wStart.setDate(today.getDate() - today.getDay() - (3 - i) * 7)
    wStart.setHours(0, 0, 0, 0)
    return { start: wStart, km: 0, duration: 0, elevation: 0 }
  })

  activities.forEach(a => {
    const aDate = new Date(a.started_at)
    const slot  = weeks.find(w => sameWeek(aDate, w.start))
    if (slot) {
      slot.km        += a.distance       ?? 0
      slot.duration  += a.duration       ?? 0
      slot.elevation += a.elevation_gain ?? 0
    }
  })

  // "This week" stats come from the current-week bucket (weeks[3])
  // so they always agree with the rightmost bar in the chart.
  const thisWeek     = weeks[3]
  const weekDistance  = thisWeek.km
  const weekDuration  = thisWeek.duration
  const weekElevation = thisWeek.elevation

  const weekHours = Math.floor(weekDuration / 3600)
  const weekMins  = Math.floor((weekDuration % 3600) / 60)
  const timeStr   = weekHours > 0 ? `${weekHours}h ${weekMins}m` : `${weekMins}m`

  // Labels show the week-start date so the chart is clearly weekly, not monthly
  const chartLabels = weeks.map(w =>
    w.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  )

  const chartData  = weeks.map(w => parseFloat(w.km.toFixed(2)))
  const maxKm      = Math.max(...chartData, 1)
  const chartWidth = SCREEN_WIDTH - 32

  const yMax = Math.ceil(maxKm / 5) * 5
  const yMid = yMax / 2

  const chartConfig = {
    backgroundGradientFrom: Colors.card,
    backgroundGradientTo:   Colors.card,
    decimalPlaces:          1,
    color:      (opacity = 1) => {
      // Parse Colors.primary hex into rgb for opacity support
      const hex = Colors.primary.replace('#', '')
      const r = parseInt(hex.substring(0, 2), 16)
      const g = parseInt(hex.substring(2, 4), 16)
      const b = parseInt(hex.substring(4, 6), 16)
      return `rgba(${r}, ${g}, ${b}, ${opacity})`
    },
    labelColor: () => Colors.textMuted,
    propsForBackgroundLines: {
      strokeDasharray: '',
      stroke:          Colors.border,
      strokeWidth:     1,
    },
    propsForDots: {
      r:           '4',
      strokeWidth: '2',
      stroke:      Colors.primary,
      fill:        Colors.card,
    },
    fillShadowGradientFrom:        Colors.primary,
    fillShadowGradientTo:          Colors.card,
    fillShadowGradientFromOpacity: 0.3,
    fillShadowGradientToOpacity:   0.0,
  }

  return (
    <View style={styles.card}>

      {/* ── This week heading ── */}
      <Text style={styles.heading}>This week</Text>

      {/* ── 3 key stats ── */}
      <View style={styles.statsRow}>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>Distance</Text>
          <Text style={styles.statValue}>
            {weekDistance.toFixed(2)}{' '}
            <Text style={styles.statUnit}>km</Text>
          </Text>
        </View>

        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>Time</Text>
          <Text style={styles.statValue}>{weekDuration > 0 ? timeStr : '--'}</Text>
        </View>

        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>Elev Gain</Text>
          <Text style={styles.statValue}>
            {weekElevation > 0 ? `${Math.round(weekElevation)}` : '0'}{' '}
            <Text style={styles.statUnit}>m</Text>
          </Text>
        </View>
      </View>

      {/* ── Chart ── */}
      <Text style={styles.chartPeriod}>Past 4 weeks</Text>

      <View style={styles.chartWrap}>
        <View style={styles.yLabels}>
          <Text style={styles.yLabel}>{yMax.toFixed(1)} km</Text>
          <Text style={styles.yLabel}>{yMid.toFixed(1)} km</Text>
          <Text style={styles.yLabel}>0 km</Text>
        </View>

        <View style={styles.chartInner}>
          <LineChart
            data={{
              labels:   chartLabels,
              datasets: [{ data: chartData.length > 0 ? chartData : [0] }],
            }}
            width={chartWidth - 56}
            height={180}
            yAxisLabel=""
            yAxisSuffix=""
            withVerticalLabels
            withHorizontalLabels={false}
            chartConfig={chartConfig}
            style={styles.lineChart}
            bezier
            fromZero
            withInnerLines
            withDots
            withShadow={false}
            getDotColor={(dataPoint, index) =>
              index === chartData.length - 1 ? Colors.primary : Colors.card
            }
          />
          <View style={styles.nowLine} />
        </View>
      </View>

      {/* ── "See more" tiny link ── */}
      <TouchableOpacity
        style={styles.seeMoreRow}
        activeOpacity={0.6}
        onPress={() => setExpanded(e => !e)}
      >
        <Text style={styles.seeMoreText}>
          {expanded ? 'Show less' : 'See more'}
        </Text>
        <Text style={styles.seeMoreArrow}>{expanded ? '↑' : '↓'}</Text>
      </TouchableOpacity>

      {/* ── Expanded: weekly breakdown ── */}
      {expanded && (
        <View style={styles.breakdown}>
          {weeks.slice().reverse().map((w, i) => {
            const isThisWeek = i === 0
            const label = w.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            return (
              <View key={i} style={[styles.breakdownRow, i < weeks.length - 1 && styles.breakdownBorder]}>
                <View style={styles.breakdownLeft}>
                  <Text style={[styles.breakdownDate, isThisWeek && styles.breakdownDateActive]}>
                    {isThisWeek ? 'This week' : label}
                  </Text>
                </View>
                <View style={styles.breakdownBar}>
                  <View
                    style={[
                      styles.breakdownFill,
                      { width: `${Math.round((w.km / maxKm) * 100)}%` as any },
                      isThisWeek && styles.breakdownFillActive,
                    ]}
                  />
                </View>
                <Text style={[styles.breakdownKm, isThisWeek && styles.breakdownKmActive]}>
                  {w.km.toFixed(1)} km
                </Text>
              </View>
            )
          })}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    borderRadius: 18,
    paddingTop: 20,
    paddingBottom: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },

  heading: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginHorizontal: 18,
    marginBottom: 14,
  },

  statsRow: {
    flexDirection: 'row',
    marginHorizontal: 18,
    marginBottom: 20,
    gap: 32,
  },
  statBlock: { gap: 2 },
  statLabel: { color: Colors.textMuted, fontSize: 13 },
  statValue: { color: Colors.text, fontSize: 22, fontWeight: '800' },
  statUnit:  { fontSize: 16, fontWeight: '500', color: Colors.textMuted },

  chartPeriod: {
    color: Colors.textMuted,
    fontSize: 13,
    marginHorizontal: 18,
    marginBottom: 8,
  },
  chartWrap: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginBottom: 4,
  },
  yLabels: {
    width: 52,
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: 6,
    paddingTop: 10,
    paddingBottom: 28,
  },
  yLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    textAlign: 'right',
  },
  chartInner: {
    flex: 1,
    position: 'relative',
  },
  lineChart: { borderRadius: 0 },
  nowLine: {
    position: 'absolute',
    top: 10,
    bottom: 28,
    right: 20,
    width: 1.5,
    backgroundColor: Colors.border,
  },

  // Tiny "see more" link
  seeMoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
  },
  seeMoreText: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  seeMoreArrow: {
    color: Colors.primary,
    fontSize: 12,
  },

  // Breakdown
  breakdown: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: Colors.card2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  breakdownBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  breakdownLeft: { width: 72 },
  breakdownDate: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
  },
  breakdownDateActive: {
    color: Colors.text,
    fontWeight: '700',
  },
  breakdownBar: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  breakdownFill: {
    height: '100%',
    backgroundColor: Colors.textMuted,
    borderRadius: 3,
    minWidth: 4,
  },
  breakdownFillActive: {
    backgroundColor: Colors.primary,
  },
  breakdownKm: {
    width: 52,
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'right',
  },
  breakdownKmActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
})