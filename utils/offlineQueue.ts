// utils/offlineQueue.ts
//
// Two responsibilities:
//  1. OFFLINE QUEUE  — persist unsaved runs to AsyncStorage so they survive
//     app restarts and sync automatically once connectivity returns.
//  2. POLYLINE COMPRESSION — Ramer-Douglas-Peucker algorithm.
//     A 10 km run at one GPS fix every 5 m produces ~2 000 points.
//     RDP trims that to ~200 points with no visible change on the map.

import AsyncStorage from '@react-native-async-storage/async-storage'
import NetInfo from '@react-native-community/netinfo'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Coordinate {
  latitude: number
  longitude: number
}

export interface QueuedActivity {
  /** Unique ID generated client-side so we can deduplicate on retry */
  localId: string
  queuedAt: string
  title: string
  distance: number
  duration: number
  pace: number
  calories: number
  route: Coordinate[]
  group_id?: string | null
  elevation_gain?: number
  max_elevation?: number
  elevation_data?: { distance_km: number; elevation_m: number }[]
  moving_time?: number
  fastest_split?: number
  pace_data?: { distance_km: number; pace_sec_per_km: number }[]
  splits?: { km: number; pace_sec_per_km: number; elevation_m?: number }[]
  pace_zones?: { zone: number; percentage: number; pace_range?: string }[]
}

type SaveFn = (data: Omit<QueuedActivity, 'localId' | 'queuedAt'>) => Promise<unknown>

// ─── Constants ────────────────────────────────────────────────────────────────

const QUEUE_KEY  = 'axionrun:offline_queue'
// 0.00005° ≈ 5 m on the ground — keeps all meaningful turns, drops collinear points
const RDP_EPSILON = 0.00005

// ─── Polyline compression ─────────────────────────────────────────────────────

function perpendicularDistance(p: Coordinate, a: Coordinate, b: Coordinate): number {
  const dx = b.longitude - a.longitude
  const dy = b.latitude  - a.latitude
  if (dx === 0 && dy === 0) {
    return Math.hypot(p.latitude - a.latitude, p.longitude - a.longitude)
  }
  const t = ((p.longitude - a.longitude) * dx + (p.latitude - a.latitude) * dy) /
            (dx * dx + dy * dy)
  const closest = { latitude: a.latitude + t * dy, longitude: a.longitude + t * dx }
  return Math.hypot(p.latitude - closest.latitude, p.longitude - closest.longitude)
}

function rdp(
  coords: Coordinate[],
  epsilon: number,
  start: number,
  end: number,
  keep: Set<number>,
): void {
  if (end <= start + 1) return
  let maxDist = 0
  let maxIdx  = start
  for (let i = start + 1; i < end; i++) {
    const d = perpendicularDistance(coords[i], coords[start], coords[end])
    if (d > maxDist) { maxDist = d; maxIdx = i }
  }
  if (maxDist > epsilon) {
    keep.add(maxIdx)
    rdp(coords, epsilon, start, maxIdx, keep)
    rdp(coords, epsilon, maxIdx, end,   keep)
  }
}

/**
 * Compress a GPS route using Ramer-Douglas-Peucker.
 * Always keeps the first and last point (start / finish markers).
 * Typical compression: 2 000 pts → 150–300 pts on a real run.
 */
export function compressRoute(coords: Coordinate[], epsilon = RDP_EPSILON): Coordinate[] {
  if (coords.length <= 2) return coords
  const keep = new Set<number>([0, coords.length - 1])
  rdp(coords, epsilon, 0, coords.length - 1, keep)
  return Array.from(keep)
    .sort((a, b) => a - b)
    .map((i) => ({
      latitude:  Math.round(coords[i].latitude  * 1e6) / 1e6,
      longitude: Math.round(coords[i].longitude * 1e6) / 1e6,
    }))
}

// ─── Queue helpers ────────────────────────────────────────────────────────────

async function readQueue(): Promise<QueuedActivity[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as QueuedActivity[]) : []
  } catch {
    return []
  }
}

async function writeQueue(queue: QueuedActivity[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

/** Add a run to the persistent offline queue. */
export async function enqueueActivity(
  data: Omit<QueuedActivity, 'localId' | 'queuedAt'>,
): Promise<string> {
  const localId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const item: QueuedActivity = { localId, queuedAt: new Date().toISOString(), ...data }
  const queue = await readQueue()
  queue.push(item)
  await writeQueue(queue)
  return localId
}

/** How many runs are waiting in the queue. */
export async function getPendingCount(): Promise<number> {
  return (await readQueue()).length
}

/**
 * Attempt to flush all queued runs via `saveFn`.
 * Each successfully saved item is removed from the queue.
 * If `saveFn` throws, that item stays for the next retry.
 *
 * Call this:
 *  - On app foreground (AppState 'active')
 *  - When NetInfo reports the device is back online
 *  - After a successful manual save (to catch stragglers)
 */
export async function flushQueue(
  saveFn: SaveFn,
): Promise<{ saved: number; failed: number }> {
  const state = await NetInfo.fetch()
  if (!state.isConnected) return { saved: 0, failed: 0 }

  const queue = await readQueue()
  if (queue.length === 0) return { saved: 0, failed: 0 }

  let saved = 0
  let failed = 0
  const remaining: QueuedActivity[] = []

  for (const item of queue) {
    try {
      const { localId, queuedAt, ...data } = item
      await saveFn(data)
      saved++
    } catch (e) {
      console.warn(`[offlineQueue] Failed to sync localId=${item.localId}:`, e)
      failed++
      remaining.push(item)
    }
  }

  await writeQueue(remaining)
  return { saved, failed }
}

/**
 * Save a run immediately if online, otherwise add to the offline queue.
 * Returns `'saved'` or `'queued'`.
 */
export async function saveWithFallback(
  data: Omit<QueuedActivity, 'localId' | 'queuedAt'>,
  saveFn: SaveFn,
): Promise<'saved' | 'queued'> {
  const compressed = { ...data, route: compressRoute(data.route) }
  const state = await NetInfo.fetch()

  if (state.isConnected) {
    try {
      await saveFn(compressed)
      return 'saved'
    } catch (e) {
      console.warn('[offlineQueue] Save failed despite connectivity, queuing:', e)
    }
  }

  await enqueueActivity(compressed)
  return 'queued'
}