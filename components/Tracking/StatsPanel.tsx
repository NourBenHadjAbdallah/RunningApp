// components/tracking/StatsPanel.tsx
// Bottom panel showing live run stats and the start / pause / stop controls.
// Stop button is replaced with a slide-to-confirm gesture to prevent accidental stops.

import React, { memo, useRef, useState, useCallback } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  PanResponder,
  Dimensions,
  Vibration,
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { formatTime, formatPace } from '../../utils/calculations'

// ─── Constants ────────────────────────────────────────────────────────────────

const TRACK_PADDING  = 6
const THUMB_SIZE     = 52
const TRACK_HEIGHT   = 64
const CONFIRM_THRESH = 0.82  // 82% of the way = confirmed

// ─── SlideToStop ──────────────────────────────────────────────────────────────

interface SlideToStopProps {
  onConfirm: () => void
}

const SlideToStop = memo(function SlideToStop({ onConfirm }: SlideToStopProps) {
  const trackWidth    = Dimensions.get('window').width - 40 - TRACK_PADDING * 2  // panel h-padding
  const maxTravel     = trackWidth - THUMB_SIZE - TRACK_PADDING * 2

  const translateX    = useRef(new Animated.Value(0)).current
  const fillOpacity   = useRef(new Animated.Value(0)).current
  const labelOpacity  = useRef(new Animated.Value(1)).current
  const thumbScale    = useRef(new Animated.Value(1)).current
  const confirmedAnim = useRef(new Animated.Value(0)).current

  const [confirmed, setConfirmed] = useState(false)
  const currentX = useRef(0)

  const reset = useCallback(() => {
    Animated.parallel([
      Animated.spring(translateX,  { toValue: 0, useNativeDriver: true, damping: 14, stiffness: 180 }),
      Animated.timing(fillOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(labelOpacity,{ toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(thumbScale,  { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 160 }),
    ]).start()
    currentX.current = 0
  }, [translateX, fillOpacity, labelOpacity, thumbScale])

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !confirmed,
      onMoveShouldSetPanResponder:  () => !confirmed,

      onPanResponderGrant: () => {
        Animated.spring(thumbScale, { toValue: 1.1, useNativeDriver: true, damping: 10, stiffness: 200 }).start()
        labelOpacity.setValue(0.4)
      },

      onPanResponderMove: (_, gesture) => {
        const clamped = Math.max(0, Math.min(gesture.dx, maxTravel))
        currentX.current = clamped
        translateX.setValue(clamped)

        const progress = clamped / maxTravel
        fillOpacity.setValue(progress * 0.85)

        // Fade out label text as thumb moves right
        labelOpacity.setValue(Math.max(0, 1 - progress * 2.5))
      },

      onPanResponderRelease: () => {
        const progress = currentX.current / maxTravel

        if (progress >= CONFIRM_THRESH) {
          // ✅ Confirmed — snap to end, flash, then call onConfirm
          Vibration.vibrate(40)
          Animated.parallel([
            Animated.spring(translateX,   { toValue: maxTravel, useNativeDriver: true, damping: 12, stiffness: 200 }),
            Animated.timing(fillOpacity,  { toValue: 1, duration: 120, useNativeDriver: true }),
            Animated.spring(confirmedAnim,{ toValue: 1, useNativeDriver: true, damping: 10, stiffness: 180 }),
          ]).start(() => {
            setConfirmed(true)
            setTimeout(onConfirm, 120)
          })
        } else {
          // ❌ Not far enough — snap back
          reset()
        }
      },

      onPanResponderTerminate: () => reset(),
    })
  ).current

  // Fill color interpolated from amber → red as the thumb travels
  const fillColor = translateX.interpolate({
    inputRange:  [0, maxTravel * 0.5, maxTravel],
    outputRange: ['rgba(245,158,11,0.18)', 'rgba(239,100,68,0.30)', 'rgba(239,68,68,0.42)'],
  })

  // Thumb background interpolated
  const thumbBg = translateX.interpolate({
    inputRange:  [0, maxTravel],
    outputRange: ['rgba(239,68,68,0.85)', 'rgba(239,68,68,1)'],
  })

  // Label text for the track
  const labelText = confirmed ? 'Stopping…' : 'Slide to stop'

  return (
    <View style={sliderStyles.track}>
      {/* Animated fill */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          sliderStyles.fill,
          { opacity: fillOpacity, backgroundColor: fillColor as any },
        ]}
      />

      {/* Label */}
      <Animated.Text style={[sliderStyles.label, { opacity: labelOpacity }]}>
        {labelText}
      </Animated.Text>

      {/* Thumb */}
      <Animated.View
        style={[
          sliderStyles.thumb,
          {
            transform: [{ translateX }, { scale: thumbScale }],
            backgroundColor: thumbBg as any,
          },
        ]}
        {...panResponder.panHandlers}
      >
        {confirmed ? (
          <FontAwesome5 name="check" size={20} color="#fff" />
        ) : (
          <FontAwesome5 name="stop" size={18} color="#fff" />
        )}
      </Animated.View>

      {/* Right arrow hints */}
      <View style={sliderStyles.arrows} pointerEvents="none">
        {[0, 1, 2].map((i) => (
          <Animated.Text
            key={i}
            style={[
              sliderStyles.arrow,
              {
                opacity: labelOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.25 - i * 0.05],
                }),
              },
            ]}
          >
            ›
          </Animated.Text>
        ))}
      </View>
    </View>
  )
})

// ─── StatsPanel ───────────────────────────────────────────────────────────────

interface StatsPanelProps {
  isTracking: boolean
  isPaused: boolean
  distance: number
  duration: number
  pace: number
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onStop: () => void
}

function StatsPanel({
  isTracking, isPaused,
  distance, duration, pace,
  onStart, onPause, onResume, onStop,
}: StatsPanelProps) {
  return (
    <View style={styles.panel}>
      {/* Live stats row */}
      <View style={styles.statsGrid}>
        <StatBox value={distance.toFixed(2)} label="KM" />
        <StatBox value={formatTime(duration)}  label="TIME" />
        <StatBox value={formatPace(pace)}      label="PACE" />
      </View>

      {/* Controls */}
      {!isTracking ? (
        <TouchableOpacity style={styles.startBtn} onPress={onStart}>
          <Text style={styles.btnText}>Start Run</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.activeCol}>
          {/* Pause / Resume button */}
          <TouchableOpacity
            style={isPaused ? styles.resumeBtn : styles.pauseBtn}
            onPress={isPaused ? onResume : onPause}
          >
            <FontAwesome5
              name={isPaused ? 'play' : 'pause'}
              size={15}
              color={isPaused ? '#fff' : Colors.primary}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.btnText, !isPaused && { color: Colors.primary }]}>
              {isPaused ? 'Resume' : 'Pause'}
            </Text>
          </TouchableOpacity>

          {/* Slide-to-stop */}
          <SlideToStop onConfirm={onStop} />
        </View>
      )}
    </View>
  )
}

const StatBox = memo(function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
})

export default memo(StatsPanel)
StatsPanel.displayName = 'StatsPanel'

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  panel: {
    backgroundColor: Colors.card,
    padding: 20,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statBox:   { alignItems: 'center', flex: 1 },
  statValue: { color: Colors.text,      fontSize: 20, fontWeight: 'bold' },
  statLabel: { color: Colors.textMuted, fontSize: 12 },

  startBtn: {
    backgroundColor: Colors.primary,
    padding: 18,
    borderRadius: 50,
    alignItems: 'center',
  },
  activeCol: {
    gap: 12,
  },
  pauseBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.card2,
    padding: 16,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  resumeBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 50,
  },
  btnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
})

// ─── Slider styles ────────────────────────────────────────────────────────────

const sliderStyles = StyleSheet.create({
  track: {
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.30)',
    justifyContent: 'center',
    paddingHorizontal: TRACK_PADDING,
    overflow: 'hidden',
  },
  fill: {
    borderRadius: TRACK_HEIGHT / 2,
  },
  label: {
    position: 'absolute',
    alignSelf: 'center',
    color: 'rgba(239,68,68,0.70)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
  },
  arrows: {
    position: 'absolute',
    right: TRACK_PADDING + THUMB_SIZE / 2 + 6,
    flexDirection: 'row',
    gap: 2,
    pointerEvents: 'none',
  },
  arrow: {
    color: 'rgba(239,68,68,0.8)',
    fontSize: 20,
    fontWeight: '300',
  },
})