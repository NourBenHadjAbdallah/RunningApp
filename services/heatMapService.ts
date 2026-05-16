// services/heatmapService.ts
//
// Fetches every route recorded by ALL users.
// No density calculation — pure opacity stacking in the layer.
//
// Results are cached for 5 minutes. Call invalidateCache() after saving
// a new activity to force a fresh fetch.

import { supabase } from './supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActivityRoute {
  id: string
  coordinates: { latitude: number; longitude: number }[]
}

export interface HeatmapData {
  routes: ActivityRoute[]
  totalActivities: number
  bounds: {
    minLat: number
    maxLat: number
    minLng: number
    maxLng: number
  } | null
}

// ─── Config ───────────────────────────────────────────────────────────────────

const BATCH_LIMIT  = 1000
const CACHE_TTL_MS = 5 * 60 * 1000

// ─── Module-level cache ───────────────────────────────────────────────────────

let _cache: { data: HeatmapData; fetchedAt: number } | null = null

// ─── Main export ──────────────────────────────────────────────────────────────

export const heatmapService = {
  async getHeatmapData(forceRefresh = false): Promise<HeatmapData> {
    const now = Date.now()

    if (!forceRefresh && _cache && now - _cache.fetchedAt < CACHE_TTL_MS) {
      return _cache.data
    }

    const { data, error } = await supabase
      .from('activities')
      .select('id, route')
      .limit(BATCH_LIMIT)

    if (error) throw error

    const rows = (data ?? []) as Array<{
      id: string
      route: { latitude: number; longitude: number }[]
    }>

    let minLat = Infinity, maxLat = -Infinity
    let minLng = Infinity, maxLng = -Infinity
    let hasPoints = false

    const routes: ActivityRoute[] = []

    for (const row of rows) {
      if (!Array.isArray(row.route) || row.route.length < 2) continue

      const coords: { latitude: number; longitude: number }[] = []

      for (const pt of row.route) {
        if (
          typeof pt.latitude  === 'number' && isFinite(pt.latitude) &&
          typeof pt.longitude === 'number' && isFinite(pt.longitude)
        ) {
          coords.push({ latitude: pt.latitude, longitude: pt.longitude })
          if (pt.latitude  < minLat) minLat = pt.latitude
          if (pt.latitude  > maxLat) maxLat = pt.latitude
          if (pt.longitude < minLng) minLng = pt.longitude
          if (pt.longitude > maxLng) maxLng = pt.longitude
          hasPoints = true
        }
      }

      if (coords.length >= 2) {
        routes.push({ id: row.id, coordinates: coords })
      }
    }

    const result: HeatmapData = {
      routes,
      totalActivities: rows.length,
      bounds: hasPoints ? { minLat, maxLat, minLng, maxLng } : null,
    }

    _cache = { data: result, fetchedAt: now }
    return result
  },

  invalidateCache(): void {
    _cache = null
  },
}