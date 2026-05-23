// components/RoutePlanner/TopBar.tsx
//
// Changes from original:
//   • Added `showHeatmap` + `onToggleHeatmap` props
//   • Heatmap toggle button sits between the tap-mode button and the right edge
//   • Shows a loading spinner while heatmap data is being fetched

import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { router } from 'expo-router'
import { Colors } from '../../constants/colors'

interface TopBarProps {
  tapMode: boolean
  onToggleTapMode: () => void

  // ── Heatmap ────────────────────────────────────────────────────────────────
  showHeatmap: boolean
  onToggleHeatmap: () => void
  heatmapLoading?: boolean
}

export function TopBar({
  tapMode,
  onToggleTapMode,
  showHeatmap,
  onToggleHeatmap,
  heatmapLoading = false,
}: TopBarProps) {
  return (
    <View style={styles.topBar}>
      {/* Close / back */}
      <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()} activeOpacity={0.8}>
        <FontAwesome5 name="times" size={15} color="#fff" />
      </TouchableOpacity>

      {/* Right cluster */}
      <View style={styles.rightCluster}>
        {/* Heatmap toggle */}
        <TouchableOpacity
          style={[styles.circleBtn, showHeatmap && styles.circleBtnActive]}
          onPress={onToggleHeatmap}
          activeOpacity={0.8}
          disabled={heatmapLoading}
        >
          {heatmapLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <FontAwesome5
              name="fire"
              size={14}
              color={showHeatmap ? Colors.primary : '#fff'}
            />
          )}
        </TouchableOpacity>

        {/* Tap-mode toggle */}
        <TouchableOpacity
          style={[styles.circleBtn, tapMode && styles.circleBtnActive]}
          onPress={onToggleTapMode}
          activeOpacity={0.8}
        >
          <FontAwesome5
            name={tapMode ? 'map-pin' : 'hand-pointer'}
            size={14}
            color={tapMode ? Colors.primary : '#fff'}
          />
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  topBar: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 36,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleBtnActive: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  rightCluster: {
    flexDirection: 'row',
    gap: 10,
  },
})