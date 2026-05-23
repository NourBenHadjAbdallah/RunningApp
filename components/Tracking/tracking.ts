// types/tracking.ts
// All shared interfaces for the tracking feature.

export interface Coordinate {
  latitude: number
  longitude: number
}

export interface SavedRoute {
  id: string
  name: string
  waypoints: Coordinate[]
  distance_km: number
  created_at: string
}

/** Snapshot written once when the user taps "Save Activity" */
export interface RunSnapshot {
  title: string
  distance: number
  duration: number
  pace: number
  calories: number
  route: Coordinate[]
  elevGain: number
  maxElev: number
  steps: number
}