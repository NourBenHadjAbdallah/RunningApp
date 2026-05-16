// components/MonthlyCalendar.tsx
import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { Activity } from '../../services/activityService'
import { Colors } from '../../constants/colors'

const SCREEN_WIDTH = Dimensions.get('window').width

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString()
}

interface Props {
  activities: Activity[]
  onDayPress: (activity: Activity) => void
}

export function MonthlyCalendar({ activities, onDayPress }: Props) {
  const today = new Date()

  const [monthStart, setMonthStart] = useState<Date>(() => {
    const d = new Date(today)
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d
  })

  const isCurrentMonth =
    monthStart.getMonth()    === today.getMonth() &&
    monthStart.getFullYear() === today.getFullYear()

  const prevMonth = () =>
    setMonthStart(m => {
      const d = new Date(m)
      d.setMonth(d.getMonth() - 1)
      return d
    })

  const nextMonth = () => {
    if (!isCurrentMonth)
      setMonthStart(m => {
        const d = new Date(m)
        d.setMonth(d.getMonth() + 1)
        return d
      })
  }

  const daysInMonth = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0
  ).getDate()

  // Build day slots
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(monthStart)
    d.setDate(i + 1)
    return { day: i + 1, date: d, km: 0, activity: null as Activity | null }
  })

  // Accumulate km per day; keep first activity for tap-through
  activities.forEach(a => {
    const aDate = new Date(a.started_at)
    const slot  = days.find(d => sameDay(d.date, aDate))
    if (slot) {
      slot.km += a.distance ?? 0
      if (!slot.activity) slot.activity = a
    }
  })

  // Streak: longest unbroken run-day chain ending today
  let currentStreak = 0
  for (let i = days.length - 1; i >= 0; i--) {
    const d = days[i]
    if (d.date > today) continue
    if (d.km > 0) currentStreak++
    else break
  }

  // Longest streak ever this month
  let longestStreak = 0
  let run = 0
  days.forEach(d => {
    if (d.date > today) return
    if (d.km > 0) { run++; longestStreak = Math.max(longestStreak, run) }
    else run = 0
  })

  const totalKm  = days.reduce((s, d) => s + d.km, 0)
  const runCount = days.filter(d => d.km > 0).length

  const monthLabel = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  // Calendar grid
  const firstDow = new Date(monthStart).getDay()
  const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
  const calCells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...days.map(d => d.day),
  ]
  while (calCells.length % 7 !== 0) calCells.push(null)

  return (
    <View style={styles.chartCard}>

      {/* Header */}
      <View style={styles.chartHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.chartTitle}>Streak Calendar</Text>
          <Text style={styles.chartSubtitle}>
            {totalKm.toFixed(1)} km · {runCount} run{runCount !== 1 ? 's' : ''}
          </Text>
        </View>
        {/* Streak badge */}
        <View style={styles.streakBadge}>
          <FontAwesome5 name="fire" size={18} color="#f59e0b" />
          <Text style={styles.streakCount}>{currentStreak}</Text>
          <Text style={styles.streakLabel}>day{currentStreak !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {/* Month navigator */}
      <View style={styles.weekNav}>
        <TouchableOpacity onPress={prevMonth} style={styles.weekNavBtn} activeOpacity={0.7}>
          <FontAwesome5 name="chevron-left" size={12} color={Colors.textMuted} />
        </TouchableOpacity>
        <Text style={styles.weekNavLabel}>{monthLabel}</Text>
        <TouchableOpacity
          onPress={nextMonth}
          style={[styles.weekNavBtn, isCurrentMonth && styles.weekNavBtnDisabled]}
          disabled={isCurrentMonth}
          activeOpacity={0.7}
        >
          <FontAwesome5 name="chevron-right" size={12} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Streak grid */}
      <View style={styles.calendarWrap}>
        {/* Day-of-week header */}
        <View style={styles.calRow}>
          {DOW_LABELS.map((l, i) => (
            <Text key={i} style={styles.calDowLabel}>{l}</Text>
          ))}
        </View>

        {Array.from({ length: calCells.length / 7 }, (_, row) => (
          <View key={row} style={styles.calRow}>
            {calCells.slice(row * 7, row * 7 + 7).map((day, col) => {
              if (day === null) return <View key={col} style={styles.calCell} />

              const cellDate = new Date(monthStart.getFullYear(), monthStart.getMonth(), day)
              const isToday  = sameDay(cellDate, today)
              const isFuture = cellDate > today
              const daySlot  = days.find(d => d.day === day)!
              const hasRun   = daySlot.km > 0
              const isMissed = !hasRun && !isFuture && !isToday

              return (
                <TouchableOpacity
                  key={col}
                  style={[
                    styles.calCell,
                    hasRun   && styles.calCellRun,
                    isToday  && !hasRun && styles.calCellToday,
                    isMissed && styles.calCellMissed,
                    isFuture && styles.calCellFuture,
                  ]}
                  activeOpacity={hasRun ? 0.75 : 1}
                  onPress={() => {
                    if (hasRun && daySlot.activity) onDayPress(daySlot.activity)
                  }}
                >
                  {hasRun ? (
                    <>
                      <FontAwesome5 name="fire" size={14} color="#f59e0b" />
                      <Text style={styles.calDayNumRun}>{day}</Text>
                    </>
                  ) : isMissed ? (
                    <>
                      <FontAwesome5 name="times" size={11} color="rgba(239,68,68,0.55)" />
                      <Text style={styles.calDayNumMissed}>{day}</Text>
                    </>
                  ) : isToday ? (
                    <>
                      <View style={styles.calTodayRing} />
                      <Text style={styles.calDayNumToday}>{day}</Text>
                    </>
                  ) : (
                    <Text style={styles.calDayNum}>{day}</Text>
                  )}
                </TouchableOpacity>
              )
            })}
          </View>
        ))}
      </View>

      {/* Legend */}
      <View style={styles.calLegend}>
        <View style={styles.calLegendRow}>
          <FontAwesome5 name="fire"  size={11} color="#f59e0b" />
          <Text style={styles.calLegendItem}> Run done</Text>
        </View>
        <View style={styles.calLegendRow}>
          <FontAwesome5 name="times" size={11} color="rgba(239,68,68,0.55)" />
          <Text style={styles.calLegendItem}> Missed</Text>
        </View>
        <View style={styles.calLegendRow}>
          <View style={styles.calTodayRingSmall} />
          <Text style={styles.calLegendItem}> Today</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  // Card wrapper
  chartCard: {
    backgroundColor: Colors.card,
    marginHorizontal: 16, marginBottom: 4,
    borderRadius: 18,
    paddingTop: 18, paddingHorizontal: 0, paddingBottom: 10,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  chartHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', paddingHorizontal: 18, marginBottom: 12,
  },
  chartTitle:    { color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 2 },
  chartSubtitle: { color: Colors.textMuted, fontSize: 12 },

  // Streak badge
  streakBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.12)',
    borderRadius: 14,
    paddingVertical: 8, paddingHorizontal: 14,
    borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)',
  },
  streakCount: { color: '#f59e0b', fontSize: 22, fontWeight: '800', lineHeight: 26 },
  streakLabel: { color: '#f59e0b', fontSize: 10, fontWeight: '600', opacity: 0.8 },

  // Week navigator
  weekNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, marginBottom: 14,
    backgroundColor: Colors.card2,
    marginHorizontal: 16, borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  weekNavBtn: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: Colors.card,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  weekNavBtnDisabled: { opacity: 0.35 },
  weekNavLabel: { color: Colors.text, fontSize: 14, fontWeight: '600' },

  // Calendar grid wrapper
  calendarWrap: {
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: Colors.card2,
    borderRadius: 14, paddingVertical: 10, paddingHorizontal: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  calRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 2,
  },
  calDowLabel: {
    flex: 1, textAlign: 'center',
    color: Colors.textMuted, fontSize: 10, fontWeight: '600',
    paddingBottom: 6,
  },

  // Base cell
  calCell: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingVertical: 4, borderRadius: 10,
    minHeight: 42, gap: 1,
  },

  // Cell variants
  calCellRun:    { backgroundColor: 'rgba(245,158,11,0.10)' },
  calCellToday:  { backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.primary },
  calCellMissed: { backgroundColor: 'rgba(239,68,68,0.07)' },
  calCellFuture: { opacity: 0.35 },

  // Day numbers
  calDayNum:       { color: Colors.textMuted,              fontSize: 10, fontWeight: '500' },
  calDayNumRun:    { color: '#f59e0b',                     fontSize: 10, fontWeight: '700' },
  calDayNumMissed: { color: 'rgba(239,68,68,0.5)',         fontSize: 10, fontWeight: '500' },
  calDayNumToday:  { color: Colors.primary,                fontSize: 10, fontWeight: '800' },

  // Today ring
  calTodayRing: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 2, borderColor: Colors.primary,
    borderStyle: 'dashed',
    marginBottom: 1,
  },

  // Legend
  calLegend: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    gap: 16, paddingHorizontal: 18, marginBottom: 12, marginTop: 4,
  },
  calLegendRow:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  calLegendItem: { color: Colors.textMuted, fontSize: 11 },
  calTodayRingSmall: {
    width: 11, height: 11, borderRadius: 6,
    borderWidth: 1.5, borderColor: Colors.primary,
  },
})