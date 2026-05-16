// services/battleZoneService.ts
//
// Battle Zone — territory conquest for runners.
//
// The world is divided into H3-style hexagonal cells (~150 m across).
// Running through a cell claims it. If someone else owns it, you steal it.
// Owners are shown as avatar labels on the map.
//
// ─── Supabase schema (run once in SQL editor) ─────────────────────────────────
//
//   create table battle_zones (
//     cell_id       text primary key,        -- "lat_lng" bucket key
//     owner_id      uuid references profiles(id) on delete set null,
//     owner_name    text,
//     captured_at   timestamptz default now(),
//     capture_count int         default 1,
//     center_lat    double precision not null,
//     center_lng    double precision not null
//   );
//
//   create index battle_zones_owner_idx on battle_zones(owner_id);
//
//   -- RLS: anyone can read, authenticated users can upsert
//   alter table battle_zones enable row level security;
//   create policy "Public read"  on battle_zones for select using (true);
//   create policy "Auth upsert"  on battle_zones for insert with check (auth.uid() = owner_id);
//   create policy "Auth update"  on battle_zones for update using (true);
//
// ─── Zone delta leaderboard ───────────────────────────────────────────────────
//
// To track per-session deltas (gain/loss arrows) we keep a snapshot of each
// user's zone count the first time the leaderboard loads in a session.
// The delta shown is: current_count − snapshot_count.
// The snapshot is cleared when the app is backgrounded / restarted.
//
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase'

// ─── Config ───────────────────────────────────────────────────────────────────

// Cell size in degrees. 0.0015° ≈ 167 m at the equator — big enough to feel
// meaningful, small enough that a 5 km run crosses ~30 cells.
const CELL_SIZE = 0.0015

// Viewport fetch radius (degrees) — load cells within this box around the user
const FETCH_RADIUS = 0.04 // ~4.5 km

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BattleZone {
  cell_id: string
  owner_id: string | null
  owner_name: string | null
  captured_at: string
  capture_count: number
  center_lat: number
  center_lng: number
}

export interface CaptureResult {
  zone: BattleZone
  wasSteal: boolean          // true if we took it from someone else
  previousOwner: string | null
}

export interface ZoneLeaderboardEntry {
  owner_id: string
  owner_name: string
  zone_count: number
  /** Positive = gained zones this session, negative = lost, 0 = no change, null = first load */
  delta: number | null
}

// ─── Session-scoped snapshot (in-memory, resets on app restart) ──────────────
//
// Maps owner_id → zone_count at the time of the FIRST leaderboard fetch.
// We never overwrite it — it's our baseline for computing deltas.

let _sessionBaseline: Map<string, number> | null = null

// ─── Cell key helpers ─────────────────────────────────────────────────────────

/**
 * Snap a lat/lng to the centre of its cell and return a deterministic key.
 * Format: "LAT6_LNG6" where each component is rounded to 6 decimal places
 * after snapping to the cell grid.
 */
export function coordToCellId(lat: number, lng: number): string {
  const snappedLat = Math.round(lat / CELL_SIZE) * CELL_SIZE
  const snappedLng = Math.round(lng / CELL_SIZE) * CELL_SIZE
  return `${snappedLat.toFixed(6)}_${snappedLng.toFixed(6)}`
}

export function cellIdToCenter(cellId: string): { lat: number; lng: number } {
  const [lat, lng] = cellId.split('_').map(Number)
  return { lat, lng }
}

/**
 * Returns the 6 corner coordinates of a hexagon centred at (lat, lng).
 * Used by the map layer to draw territory polygons.
 */
export function hexCorners(
  lat: number,
  lng: number,
  sizeMultiplier = 1,
): { latitude: number; longitude: number }[] {
  const r = (CELL_SIZE * sizeMultiplier) / 2
  const corners: { latitude: number; longitude: number }[] = []
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i - 30
    const angleRad = (Math.PI / 180) * angleDeg
    corners.push({
      latitude:  lat + r * Math.cos(angleRad),
      longitude: lng + r * Math.sin(angleRad) * 1.4, // compensate lng stretch
    })
  }
  return corners
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const battleZoneService = {

  // ── Fetch all zones inside a bounding box around a location ───────────────

  async getZonesNear(
    lat: number,
    lng: number,
    radius = FETCH_RADIUS,
  ): Promise<BattleZone[]> {
    const { data, error } = await supabase
      .from('battle_zones')
      .select('*')
      .gte('center_lat', lat - radius)
      .lte('center_lat', lat + radius)
      .gte('center_lng', lng - radius)
      .lte('center_lng', lng + radius)

    if (error) throw error
    return (data ?? []) as BattleZone[]
  },

  // ── Claim a cell for the current user ─────────────────────────────────────
  // Returns null if the user already owns this cell (no-op).

  async captureCell(
    lat: number,
    lng: number,
    userName: string,
  ): Promise<CaptureResult | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const cellId    = coordToCellId(lat, lng)
    const centerLat = Math.round(lat / CELL_SIZE) * CELL_SIZE
    const centerLng = Math.round(lng / CELL_SIZE) * CELL_SIZE

    // Read current owner
    const { data: existing } = await supabase
      .from('battle_zones')
      .select('owner_id, owner_name, capture_count')
      .eq('cell_id', cellId)
      .maybeSingle()

    // Already ours — skip
    if (existing?.owner_id === user.id) return null

    const previousOwner = existing?.owner_name ?? null
    const wasSteal      = !!existing?.owner_id && existing.owner_id !== user.id
    const newCount      = (existing?.capture_count ?? 0) + 1

    const { data: upserted, error } = await supabase
      .from('battle_zones')
      .upsert({
        cell_id:       cellId,
        owner_id:      user.id,
        owner_name:    userName,
        captured_at:   new Date().toISOString(),
        capture_count: newCount,
        center_lat:    centerLat,
        center_lng:    centerLng,
      })
      .select()
      .single()

    if (error) throw error

    return {
      zone: upserted as BattleZone,
      wasSteal,
      previousOwner,
    }
  },

  // ── How many zones does the current user own? ──────────────────────────────

  async myZoneCount(): Promise<number> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 0

    const { count, error } = await supabase
      .from('battle_zones')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', user.id)

    if (error) throw error
    return count ?? 0
  },

  // ── Global leaderboard — top 20 territory holders ─────────────────────────
  //
  // KEY BEHAVIOURS:
  //  1. Users whose zones were all stolen appear in the list with zone_count = 0.
  //     They are NOT removed — we keep everyone who has ever owned a zone this
  //     session so the leaderboard doesn't suddenly shrink.
  //  2. Each entry carries a `delta` field:
  //       null  → first load (no baseline yet, don't show arrow)
  //       +N    → gained N zones since session start → ▲N in green
  //       -N    → lost N zones since session start  → ▼N in red
  //       0     → no change → show nothing extra
  //
  // Implementation note: the free-tier Supabase approach (no GROUP BY RPC)
  // fetches all owned rows and counts client-side. Users with 0 zones have no
  // rows in battle_zones, so we carry them forward from _sessionBaseline.

  async getLeaderboard(): Promise<ZoneLeaderboardEntry[]> {
    // Fetch all owned zones (up to 2000 rows)
    const { data, error } = await supabase
      .from('battle_zones')
      .select('owner_id, owner_name')
      .not('owner_id', 'is', null)
      .limit(2000)

    if (error) throw error

    // Count current zones per user
    const current: Record<string, { name: string; count: number }> = {}
    for (const row of data ?? []) {
      if (!row.owner_id) continue
      if (!current[row.owner_id]) {
        current[row.owner_id] = { name: row.owner_name ?? '?', count: 0 }
      }
      current[row.owner_id].count++
    }

    const isFirstLoad = _sessionBaseline === null

    // On first load, set baseline from current snapshot
    if (isFirstLoad) {
      _sessionBaseline = new Map(
        Object.entries(current).map(([id, v]) => [id, v.count])
      )
    }

    // Merge current counts with baseline so users at 0 aren't dropped
    const allIds = new Set([
      ...Object.keys(current),
      ...(_sessionBaseline?.keys() ?? []),
    ])

    const entries: ZoneLeaderboardEntry[] = []

    for (const owner_id of allIds) {
      const cur    = current[owner_id]
      const baseCt = _sessionBaseline?.get(owner_id) ?? null

      const zone_count = cur?.count ?? 0
      const owner_name = cur?.name
        // Fall back to the name we saw in the baseline snapshot
        ?? 'Unknown'

      const delta = isFirstLoad
        ? null
        : baseCt !== null
          ? zone_count - baseCt
          : null  // appeared after session start — no baseline, no arrow

      entries.push({ owner_id, owner_name, zone_count, delta })
    }

    // Sort: most zones first; ties broken by biggest gain
    return entries
      .sort((a, b) =>
        b.zone_count !== a.zone_count
          ? b.zone_count - a.zone_count
          : (b.delta ?? 0) - (a.delta ?? 0)
      )
      .slice(0, 20)
  },

  /**
   * Call this when you need fresh deltas from a new baseline
   * (e.g. the user explicitly resets the session or logs out).
   */
  resetLeaderboardBaseline(): void {
    _sessionBaseline = null
  },

  // ── Subscribe to real-time zone changes in a bounding box ─────────────────

  subscribeToZones(
    lat: number,
    lng: number,
    radius: number,
    onUpdate: (zone: BattleZone) => void,
  ) {
    return supabase
      .channel('battle-zones-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'battle_zones' },
        (payload) => {
          const z = payload.new as BattleZone
          if (
            z.center_lat >= lat - radius && z.center_lat <= lat + radius &&
            z.center_lng >= lng - radius && z.center_lng <= lng + radius
          ) {
            onUpdate(z)
          }
        },
      )
      .subscribe()
  },
}