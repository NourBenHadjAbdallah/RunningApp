// ─── Add these fields to your Activity interface in activityService.ts ───────
//
// The analytics components are designed to be additive — they render nothing
// when these fields are absent. Just extend the interface and populate them
// wherever you fetch/build Activity objects (Supabase, local GPS, etc.)

export interface ActivityAnalyticsFields {
  // ── Elevation ────────────────────────────────────────────────────────────
  /** Total elevation gain in metres */
  elevation_gain?: number
  /** Maximum elevation reached in metres */
  max_elevation?: number
  /** Per-point elevation profile (one point per ~100 m of distance) */
  elevation_data?: {
    distance_km: number   // cumulative distance at this point
    elevation_m: number   // absolute elevation in metres
  }[]

  // ── Pace ─────────────────────────────────────────────────────────────────
  /** Moving time in seconds (may differ from total duration due to pauses) */
  moving_time?: number
  /** Fastest 1-km split in sec/km */
  fastest_split?: number
  /** Per-point pace profile (one point per ~100 m of distance) */
  pace_data?: {
    distance_km: number      // cumulative distance at this point
    pace_sec_per_km: number  // instantaneous pace at this point
  }[]

  // ── Splits ────────────────────────────────────────────────────────────────
  /** One entry per completed kilometre */
  splits?: {
    km: number               // kilometre number (1, 2, 3 …)
    pace_sec_per_km: number  // average pace for that km, e.g. 329 = 5:29 /km
    elevation_m?: number     // net elevation change for that km (+up / -down)
  }[]

  // ── Pace Zones ────────────────────────────────────────────────────────────
  /** Distribution across pace zones Z1–Z6 */
  pace_zones?: {
    zone: number          // 1 (easiest) to 6 (hardest)
    percentage: number    // 0–100, must sum to ~100 across all zones
    pace_range?: string   // human-readable, e.g. "5:05–5:40"
  }[]
}

// ─── Example: how to merge into your existing Activity type ──────────────────
//
// import { ActivityAnalyticsFields } from './activityAnalyticsFields'
//
// export interface Activity extends ActivityAnalyticsFields {
//   id: string
//   title: string
//   distance: number
//   duration: number
//   pace: number
//   calories: number
//   started_at: string
//   route?: { latitude: number; longitude: number }[]
//   // … rest of your existing fields
// }

// ─── Example: Supabase column mapping ────────────────────────────────────────
//
// If you store these in separate Supabase columns (jsonb or numeric):
//
//   elevation_gain   → numeric
//   max_elevation    → numeric
//   elevation_data   → jsonb  (array of {distance_km, elevation_m})
//   moving_time      → numeric (seconds)
//   fastest_split    → numeric (sec/km)
//   pace_data        → jsonb  (array of {distance_km, pace_sec_per_km})
//   splits           → jsonb  (array of {km, pace_sec_per_km, elevation_m?})
//   pace_zones       → jsonb  (array of {zone, percentage, pace_range?})
//
// Then in getActivityById() / getMyActivities(), just select them like any
// other column and TypeScript will pick them up automatically once the
// Activity interface is extended.