// hooks/useGPSTracking.ts

import { useState, useRef, useEffect, useCallback } from 'react'
import { Vibration } from 'react-native'
import * as Location from 'expo-location'
import * as Notifications from 'expo-notifications'
import { Barometer } from 'expo-sensors'
import NetInfo, { NetInfoState } from '@react-native-community/netinfo'
import { haversineDistance, calculateCalories, estimateSteps } from '../utils/calculations'
import { bgState, LOCATION_TASK, dismissRunNotification } from '../utils/locationTask'

// Two short pulses: felt clearly but not jarring
const KM_VIBRATION_PATTERN = [0, 200, 100, 200]

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Coordinate {
  latitude: number
  longitude: number
}

interface ElevationPoint {
  distance_km: number
  elevation_m: number
}

interface PacePoint {
  distance_km: number
  pace_sec_per_km: number
}

interface RawFix {
  coord: Coordinate
  altitude: number      // metres (NaN if unavailable)
  timestamp: number     // ms since epoch
  cumDistKm: number     // cumulative distance at this fix
}

// ─── Pressure → altitude conversion (hypsometric formula) ────────────────────
const SEA_LEVEL_PRESSURE = 1013.25

function pressureToAltitude(hPa: number): number {
  return 44330 * (1 - Math.pow(hPa / SEA_LEVEL_PRESSURE, 1 / 5.255))
}

// ─── Pace zone thresholds (sec/km) ───────────────────────────────────────────

const ZONE_THRESHOLDS = [
  { zone: 6, max: 269 },
  { zone: 5, max: 286 },
  { zone: 4, max: 305 },
  { zone: 3, max: 340 },
  { zone: 2, max: 395 },
  { zone: 1, max: Infinity },
]

const ZONE_LABELS: Record<number, string> = {
  6: '< 4:29',
  5: '4:29–4:46',
  4: '4:46–5:05',
  3: '5:05–5:40',
  2: '5:40–6:35',
  1: '> 6:35',
}

function paceToZone(secPerKm: number): number {
  for (const { zone, max } of ZONE_THRESHOLDS) {
    if (secPerKm < max) return zone
  }
  return 1
}

// ─── Analytics snapshot type ──────────────────────────────────────────────────

export interface RunAnalytics {
  elevation_gain: number
  max_elevation: number
  elevation_data: ElevationPoint[]
  moving_time: number
  fastest_split: number
  pace_data: PacePoint[]
  splits: { km: number; pace_sec_per_km: number; elevation_m: number }[]
  pace_zones: { zone: number; percentage: number; pace_range: string }[]
  steps: number
}

// ─── Rolling smoothed pace ────────────────────────────────────────────────────

function smoothPace(fixes: RawFix[], windowCount = 4): number {
  if (fixes.length < 2) return 0
  const slice = fixes.slice(-Math.min(windowCount, fixes.length))
  const distKm  = slice[slice.length - 1].cumDistKm - slice[0].cumDistKm
  const timeSec = (slice[slice.length - 1].timestamp - slice[0].timestamp) / 1000
  if (distKm <= 0 || timeSec <= 0) return 0
  return timeSec / distKm
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGPSTracking() {
  const [isTracking,      setIsTracking]      = useState(false)
  const [isPaused,        setIsPaused]        = useState(false)
  const [route,           setRoute]           = useState<Coordinate[]>([])
  const [distance,        setDistance]        = useState(0)
  const [duration,        setDuration]        = useState(0)
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null)
  const [isOnline,        setIsOnline]        = useState(true)

  const liveWatchRef     = useRef<Location.LocationSubscription | null>(null)
  const trackingWatchRef = useRef<Location.LocationSubscription | null>(null)
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)

  const distanceRef    = useRef(0)
  const movingTimeRef  = useRef(0)
  const isPausedRef    = useRef(false)

  // Analytics accumulators
  const rawFixesRef      = useRef<RawFix[]>([])
  const elevationDataRef = useRef<ElevationPoint[]>([])
  const paceDataRef      = useRef<PacePoint[]>([])
  const splitsRef        = useRef<{ km: number; pace_sec_per_km: number; elevation_m: number }[]>([])
  const zoneSecondsRef   = useRef<Record<number, number>>({ 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 })
  const lastKmMarkerRef  = useRef(0)
  const lastKmElevRef    = useRef(0)
  const fastestSplitRef  = useRef(0)
  const stepsRef         = useRef(0)

  // Barometer — pressure-based altitude when GPS altitude is null/NaN
  const baroAvailableRef = useRef(false)
  const baroAltitudeRef  = useRef<number>(NaN)
  const baroSubRef       = useRef<{ remove(): void } | null>(null)

  // ── Online / offline ──────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOnline(!!state.isConnected)
    })
    NetInfo.fetch().then((state) => setIsOnline(!!state.isConnected))
    return () => unsub()
  }, [])

  // ── Barometer subscription (runs for the lifetime of the hook) ────────────
  useEffect(() => {
    let mounted = true
    Barometer.isAvailableAsync().then((available: boolean) => {
      if (!available || !mounted) return
      baroAvailableRef.current = true
      baroSubRef.current = Barometer.addListener(({ pressure }: { pressure: number }) => {
        baroAltitudeRef.current = pressureToAltitude(pressure)
      })
      Barometer.setUpdateInterval(2000)
    })
    return () => {
      mounted = false
      baroSubRef.current?.remove()
      baroSubRef.current = null
    }
  }, [])

  // ── Live dot before tracking starts ───────────────────────────────────────
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted' || !mounted) return

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      if (mounted) {
        setCurrentLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude })
        const seedElev =
          loc.coords.altitude != null && !isNaN(loc.coords.altitude)
            ? loc.coords.altitude
            : !isNaN(baroAltitudeRef.current)
            ? baroAltitudeRef.current
            : 0
        lastKmElevRef.current = seedElev
      }

      liveWatchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 2000, distanceInterval: 3 },
        (location) => {
          if (!mounted || isTracking) return
          setCurrentLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude })
        },
      )
    })()
    return () => {
      mounted = false
      liveWatchRef.current?.remove()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── getBestAltitude — GPS first, barometer fallback ───────────────────────
  const getBestAltitude = useCallback((gpsAltitude: number | null): number => {
    if (gpsAltitude != null && !isNaN(gpsAltitude) && gpsAltitude !== 0) return gpsAltitude
    if (baroAvailableRef.current && !isNaN(baroAltitudeRef.current)) return baroAltitudeRef.current
    return NaN
  }, [])

  // ── processNewFix — shared by foreground and background paths ─────────────
  const processNewFix = useCallback((
    coord: Coordinate,
    altitude: number,
    timestamp: number,
  ) => {
    if (isPausedRef.current) return

    setCurrentLocation(coord)

    setRoute((prev) => {
      if (prev.length > 0) {
        // Mirror bgState so both are always in sync
        distanceRef.current = bgState.distance
        stepsRef.current    = estimateSteps(distanceRef.current)
        setDistance(distanceRef.current)
      }

      const cumDistKm = distanceRef.current

      rawFixesRef.current.push({ coord, altitude, timestamp, cumDistKm })

      // Elevation profile
      if (!isNaN(altitude)) {
        elevationDataRef.current.push({
          distance_km: parseFloat(cumDistKm.toFixed(3)),
          elevation_m: parseFloat(altitude.toFixed(1)),
        })
      }

      // Smoothed pace + zone tracking
      const instantPace = smoothPace(rawFixesRef.current)
      if (instantPace > 0 && instantPace < 1200) {
        paceDataRef.current.push({
          distance_km:     parseFloat(cumDistKm.toFixed(3)),
          pace_sec_per_km: parseFloat(instantPace.toFixed(1)),
        })
        const zone = paceToZone(instantPace)
        zoneSecondsRef.current[zone] = (zoneSecondsRef.current[zone] ?? 0) + 3
      }

      // Km splits
      const completedKms = Math.floor(cumDistKm)
      if (completedKms > lastKmMarkerRef.current) {
        const splitKm    = completedKms
        const markerDist = lastKmMarkerRef.current
        const fixes      = rawFixesRef.current
        let startTime    = timestamp

        for (let i = fixes.length - 1; i >= 0; i--) {
          if (fixes[i].cumDistKm <= markerDist) { startTime = fixes[i].timestamp; break }
        }

        const distForSplit = splitKm - markerDist
        const splitSec     = (timestamp - startTime) / 1000
        const splitPace    = distForSplit > 0 ? splitSec / distForSplit : 0
        const elevAtMarker = lastKmElevRef.current
        const elevNow      = isNaN(altitude) ? elevAtMarker : altitude
        const elevChange   = parseFloat((elevNow - elevAtMarker).toFixed(1))

        if (splitPace > 0 && splitPace < 1200) {
          splitsRef.current.push({
            km:              splitKm,
            pace_sec_per_km: parseFloat(splitPace.toFixed(0)),
            elevation_m:     elevChange,
          })
          if (fastestSplitRef.current === 0 || splitPace < fastestSplitRef.current) {
            fastestSplitRef.current = splitPace
          }
        }

        Vibration.vibrate(KM_VIBRATION_PATTERN)
        lastKmMarkerRef.current = splitKm
        lastKmElevRef.current   = isNaN(altitude) ? lastKmElevRef.current : altitude
      }

      return [...prev, coord]
    })
  }, [])

  // ── Wire bgState.onNewFix while tracking is active ────────────────────────
  useEffect(() => {
    if (!isTracking) { bgState.onNewFix = null; return }

    bgState.onNewFix = (coord, altitude, timestamp) => {
      processNewFix(coord, altitude, timestamp)
    }

    // Keep bgState.duration in sync so the lock-screen notification shows live time
    const syncTimer = setInterval(() => {
      bgState.isPaused = isPausedRef.current
      if (!isPausedRef.current) bgState.duration += 1
    }, 1000)

    return () => {
      bgState.onNewFix = null
      clearInterval(syncTimer)
    }
  }, [isTracking, processNewFix])

  // ── Start ─────────────────────────────────────────────────────────────────
  const startTracking = async () => {
    const { status: fgStatus } = await Location.requestForegroundPermissionsAsync()
    if (fgStatus !== 'granted') {
      alert('Location permission is required to track your run!')
      return
    }

    const { status: notifStatus } = await Notifications.requestPermissionsAsync()
    if (notifStatus !== 'granted') {
      console.warn('[useGPSTracking] Notification permission denied')
    }

    // Reset state
    setRoute([])
    setDistance(0)
    setDuration(0)
    distanceRef.current   = 0
    movingTimeRef.current = 0
    isPausedRef.current   = false
    setIsPaused(false)
    setIsTracking(true)

    rawFixesRef.current      = []
    elevationDataRef.current = []
    paceDataRef.current      = []
    splitsRef.current        = []
    zoneSecondsRef.current   = { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 }
    lastKmMarkerRef.current  = 0
    fastestSplitRef.current  = 0
    stepsRef.current         = 0

    bgState.isPaused  = false
    bgState.distance  = 0
    bgState.duration  = 0
    bgState.lastCoord = null

    // Duration timer
    timerRef.current = setInterval(() => {
      if (!isPausedRef.current) {
        setDuration((d) => d + 1)
        movingTimeRef.current += 1
        bgState.duration      += 1
      }
    }, 1000)

    // Foreground location watch (works in Expo Go without background permission)
    trackingWatchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 5 },
      (location) => {
        if (isPausedRef.current) return
        const coord     = { latitude: location.coords.latitude, longitude: location.coords.longitude }
        const altitude  = getBestAltitude(location.coords.altitude)
        const timestamp = location.timestamp

        if (bgState.lastCoord) {
          const added = haversineDistance(bgState.lastCoord, coord)
          if (added < 0.05) {
            bgState.distance    += added
            distanceRef.current  = bgState.distance
          }
        }
        bgState.lastCoord = coord
        processNewFix(coord, altitude, timestamp)
      },
    )
  }

  // ── Pause ─────────────────────────────────────────────────────────────────
  const pauseTracking = useCallback(() => {
    isPausedRef.current = true
    bgState.isPaused    = true
    setIsPaused(true)
  }, [])

  // ── Resume ────────────────────────────────────────────────────────────────
  const resumeTracking = useCallback(() => {
    isPausedRef.current = false
    bgState.isPaused    = false
    setIsPaused(false)
    // Insert a gap marker so the polyline doesn't draw a line across the pause
    setRoute((prev) => {
      if (prev.length === 0) return prev
      return [...prev, prev[prev.length - 1]]
    })
  }, [])

  // ── Stop ──────────────────────────────────────────────────────────────────
  const stopTracking = useCallback(async () => {
    trackingWatchRef.current?.remove()
    trackingWatchRef.current = null

    try {
      const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK)
      if (started) await Location.stopLocationUpdatesAsync(LOCATION_TASK)
    } catch (e) {
      console.warn('[useGPSTracking] stopLocationUpdatesAsync error:', e)
    }

    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }

    await dismissRunNotification()

    bgState.onNewFix    = null
    isPausedRef.current = false
    bgState.isPaused    = false
    setIsPaused(false)
    setIsTracking(false)
  }, [])

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetTracking = useCallback(() => {
    setRoute([])
    setDistance(0)
    setDuration(0)
    distanceRef.current   = 0
    movingTimeRef.current = 0
    setIsPaused(false)
    isPausedRef.current   = false

    rawFixesRef.current      = []
    elevationDataRef.current = []
    paceDataRef.current      = []
    splitsRef.current        = []
    zoneSecondsRef.current   = { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0 }
    lastKmMarkerRef.current  = 0
    lastKmElevRef.current    = 0
    fastestSplitRef.current  = 0
    stepsRef.current         = 0

    bgState.isPaused  = false
    bgState.distance  = 0
    bgState.duration  = 0
    bgState.lastCoord = null
    bgState.onNewFix  = null
  }, [])

  // ── getAnalytics — snapshot at save time ──────────────────────────────────
  const getAnalytics = useCallback((): RunAnalytics => {
    const elevPts = elevationDataRef.current
    let elevGain  = 0
    let maxElev   = elevPts.length > 0 ? elevPts[0].elevation_m : 0

    for (let i = 1; i < elevPts.length; i++) {
      const diff = elevPts[i].elevation_m - elevPts[i - 1].elevation_m
      if (diff > 0.5) elevGain += diff
      if (elevPts[i].elevation_m > maxElev) maxElev = elevPts[i].elevation_m
    }

    const zoneSecs  = zoneSecondsRef.current
    const totalSecs = Object.values(zoneSecs).reduce((s, v) => s + v, 0)
    const pace_zones = ([6, 5, 4, 3, 2, 1] as const).map((zone) => ({
      zone,
      percentage: totalSecs > 0 ? Math.round((zoneSecs[zone] / totalSecs) * 100) : 0,
      pace_range: ZONE_LABELS[zone],
    }))

    // Fix rounding so percentages sum to exactly 100
    const pctSum = pace_zones.reduce((s, z) => s + z.percentage, 0)
    if (pctSum !== 100 && pctSum > 0) {
      const largest = pace_zones.reduce((a, b) => a.percentage >= b.percentage ? a : b)
      largest.percentage += (100 - pctSum)
    }

    return {
      elevation_gain: parseFloat(elevGain.toFixed(1)),
      max_elevation:  parseFloat(maxElev.toFixed(1)),
      elevation_data: elevationDataRef.current,
      moving_time:    movingTimeRef.current,
      fastest_split:  parseFloat(fastestSplitRef.current.toFixed(0)),
      pace_data:      paceDataRef.current,
      splits:         splitsRef.current,
      pace_zones,
      steps:          stepsRef.current,
    }
  }, [])

  const pace     = duration > 0 && distance > 0 ? duration / 60 / distance : 0
  const calories = calculateCalories(distance)
  const steps    = estimateSteps(distance)

  return {
    isTracking,
    isPaused,
    isOnline,
    route,
    distance,
    duration,
    pace,
    calories,
    steps,
    currentLocation,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    resetTracking,
    getAnalytics,
  }
}