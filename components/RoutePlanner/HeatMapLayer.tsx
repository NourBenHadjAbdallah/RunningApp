// components/RoutePlanner/HeatmapLayer.tsx
//
// Renders a global heatmap using purple/violet neon polylines.
//
// Each polyline is drawn with a low fixed opacity. When multiple users have
// run the same road, their polylines stack on top of each other and the
// combined opacity naturally builds up — quiet streets stay faint,
// popular corridors glow bright violet.
//
// The key is keeping per-polyline opacity low enough that a single run
// is subtle, but each additional run makes a visible difference.

import React, { useMemo } from 'react'
import { Polyline } from 'react-native-maps'
import { ActivityRoute } from '../../services/heatMapService'

// ─── Config ───────────────────────────────────────────────────────────────────

// Keep these low — the stacking IS the effect.
// One run alone: barely visible. Ten runs on the same road: bright neon.
const CORE_COLOR = 'rgba(168,85,247,0.20)'   // violet core, low opacity
const GLOW_COLOR = 'rgba(192,132,252,0.08)'  // lighter violet halo

const CORE_WIDTH = 4
const GLOW_WIDTH = 10

const MIN_POINTS_ZOOMED_OUT = 5

// ─── Types ────────────────────────────────────────────────────────────────────

interface HeatmapLayerProps {
  routes: ActivityRoute[]
  visible: boolean
  latitudeDelta?: number
}

// ─── Component ────────────────────────────────────────────────────────────────

export const HeatmapLayer = React.memo(function HeatmapLayer({
  routes,
  visible,
  latitudeDelta = 0.05,
}: HeatmapLayerProps) {
  const filtered = useMemo(() => {
    if (routes.length === 0) return []
    const zoomed = latitudeDelta > 0.1
    return routes.filter(
      (r) => !zoomed || r.coordinates.length >= MIN_POINTS_ZOOMED_OUT
    )
  }, [routes, latitudeDelta])

  if (!visible || filtered.length === 0) return null

  return (
    <>
      {filtered.map((r) => (
        <React.Fragment key={r.id}>
          {/* Wide soft glow — stacks to create bloom on busy roads */}
          <Polyline
            coordinates={r.coordinates}
            strokeColor={GLOW_COLOR}
            strokeWidth={GLOW_WIDTH}
            lineCap="round"
            lineJoin="round"
            zIndex={2}
          />
          {/* Thin core — stacks to create bright neon spine */}
          <Polyline
            coordinates={r.coordinates}
            strokeColor={CORE_COLOR}
            strokeWidth={CORE_WIDTH}
            lineCap="round"
            lineJoin="round"
            zIndex={3}
          />
        </React.Fragment>
      ))}
    </>
  )
})