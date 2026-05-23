// hooks/useBattleZone.ts
//
// Drives the Battle Zone feature during an active run.
//
// ─── Responsibilities ─────────────────────────────────────────────────────────
//  • Load zones near the user on mount and when they move significantly
//  • Auto-capture cells as the user runs through them
//  • Subscribe to real-time Supabase updates so stolen zones appear instantly
//  • Expose capture events for the HUD toast system
//
// ─── Usage ───────────────────────────────────────────────────────────────────
//
//   const {
//     zones,            // BattleZone[] — all loaded zones (for the map layer)
//     captures,         // CaptureEvent[] — recent captures (for the HUD)
//     myZoneCount,      // number — how many cells the user owns
//     isBattleMode,     // boolean — is battle mode active?
//     toggleBattleMode, // () => void
//   } = useBattleZone({ isTracking, currentLocation, userName })

import { useCallback, useEffect, useRef, useState } from 'react'
import { battleZoneService, BattleZone, CaptureResult, coordToCellId } from '../services/battleZoneService'
import { haversineDistance } from '../utils/calculations'
import type { Coordinate } from '.././components/Tracking/tracking'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CaptureEvent {
  id: string
  cellId: string
  wasSteal: boolean
  previousOwner: string | null
  timestamp: number
}

interface UseBattleZoneOptions {
  isTracking: boolean
  currentLocation: Coordinate | null
  userName: string
}

interface UseBattleZoneReturn {
  zones: BattleZone[]
  captures: CaptureEvent[]
  myZoneCount: number
  isBattleMode: boolean
  toggleBattleMode: () => void
  clearCapture: (id: string) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Minimum metres moved before we attempt another cell capture
const CAPTURE_INTERVAL_M = 30

// Minimum metres moved before we re-fetch nearby zones from Supabase
const REFETCH_INTERVAL_M = 500

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBattleZone({
  isTracking,
  currentLocation,
  userName,
}: UseBattleZoneOptions): UseBattleZoneReturn {
  const [isBattleMode, setIsBattleMode]   = useState(false)
  const [zones, setZones]                 = useState<BattleZone[]>([])
  const [captures, setCaptures]           = useState<CaptureEvent[]>([])
  const [myZoneCount, setMyZoneCount]     = useState(0)

  // Track the last position we fetched zones from and the last capture position
  const lastFetchCoord  = useRef<Coordinate | null>(null)
  const lastCaptureCoord = useRef<Coordinate | null>(null)

  // Set of cell IDs we've already claimed this session (avoid duplicate upserts)
  const visitedCells = useRef(new Set<string>())

  // Real-time subscription handle
  const realtimeSub = useRef<ReturnType<typeof battleZoneService.subscribeToZones> | null>(null)

  // ── Toggle ─────────────────────────────────────────────────────────────────

  const toggleBattleMode = useCallback(() => {
    setIsBattleMode((prev) => !prev)
  }, [])

  const clearCapture = useCallback((id: string) => {
    setCaptures((prev) => prev.filter((c) => c.id !== id))
  }, [])

  // ── Update a single zone in state (real-time handler) ─────────────────────

  const handleZoneUpdate = useCallback((updated: BattleZone) => {
    setZones((prev) => {
      const idx = prev.findIndex((z) => z.cell_id === updated.cell_id)
      if (idx === -1) return [...prev, updated]
      const next = [...prev]
      next[idx] = updated
      return next
    })
  }, [])

  // ── Fetch zones near a location ────────────────────────────────────────────

  const fetchZones = useCallback(async (coord: Coordinate) => {
    try {
      const fetched = await battleZoneService.getZonesNear(coord.latitude, coord.longitude)
      setZones(fetched)
      lastFetchCoord.current = coord

      // Refresh our zone count
      const count = await battleZoneService.myZoneCount()
      setMyZoneCount(count)
    } catch (e) {
      console.warn('[useBattleZone] fetchZones error:', e)
    }
  }, [])

  // ── Set up real-time subscription when battle mode activates ──────────────

  useEffect(() => {
    if (!isBattleMode || !currentLocation) return

    fetchZones(currentLocation)

    realtimeSub.current = battleZoneService.subscribeToZones(
      currentLocation.latitude,
      currentLocation.longitude,
      0.04,
      handleZoneUpdate,
    )

    return () => {
      realtimeSub.current?.unsubscribe()
      realtimeSub.current = null
    }
  }, [isBattleMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Process each new GPS fix ───────────────────────────────────────────────

  useEffect(() => {
    if (!isBattleMode || !isTracking || !currentLocation) return

    const coord = currentLocation

    // Re-fetch zone list if we've moved far enough
    const distFromFetch = lastFetchCoord.current
      ? haversineDistance(lastFetchCoord.current, coord) * 1000
      : Infinity
    if (distFromFetch > REFETCH_INTERVAL_M) {
      fetchZones(coord)
    }

    // Attempt a capture if we've moved far enough from the last capture point
    const distFromCapture = lastCaptureCoord.current
      ? haversineDistance(lastCaptureCoord.current, coord) * 1000
      : Infinity

    if (distFromCapture < CAPTURE_INTERVAL_M) return

    lastCaptureCoord.current = coord
    const cellId = coordToCellId(coord.latitude, coord.longitude)

    // Skip cells we've already visited this session
    if (visitedCells.current.has(cellId)) return
    visitedCells.current.add(cellId)

    // Fire-and-forget capture
    battleZoneService
      .captureCell(coord.latitude, coord.longitude, userName)
      .then((result: CaptureResult | null) => {
        if (!result) return // already ours

        // Update zones state
        handleZoneUpdate(result.zone)

        // Increment counter
        setMyZoneCount((n) => (result.wasSteal ? n + 1 : n + 1))

        // Push a capture event for the HUD toast
        const event: CaptureEvent = {
          id:            `${cellId}_${Date.now()}`,
          cellId,
          wasSteal:      result.wasSteal,
          previousOwner: result.previousOwner,
          timestamp:     Date.now(),
        }
        setCaptures((prev) => [event, ...prev].slice(0, 10))
      })
      .catch((e: unknown) => {
        // Remove from visited so it can be retried next pass
        visitedCells.current.delete(cellId)
        console.warn('[useBattleZone] capture error:', e)
      })
  }, [currentLocation, isBattleMode, isTracking, userName, fetchZones, handleZoneUpdate])

  // ── Reset visited cells when tracking stops ────────────────────────────────

  useEffect(() => {
    if (!isTracking) {
      visitedCells.current.clear()
      lastCaptureCoord.current = null
    }
  }, [isTracking])

  return {
    zones,
    captures,
    myZoneCount,
    isBattleMode,
    toggleBattleMode,
    clearCapture,
  }
}