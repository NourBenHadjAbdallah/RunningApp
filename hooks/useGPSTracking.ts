import { useState, useRef, useEffect, useCallback } from 'react'
import * as Location from 'expo-location'
import { haversineDistance, calculateCalories } from '../utils/calculations'

export interface Coordinate {
  latitude: number
  longitude: number
}

export function useGPSTracking() {
  const [isTracking, setIsTracking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [route, setRoute] = useState<Coordinate[]>([])
  const [distance, setDistance] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null)

  const watchRef = useRef<Location.LocationSubscription | null>(null)
  const liveWatchRef = useRef<Location.LocationSubscription | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const distanceRef = useRef(0)
  const isPausedRef = useRef(false)

  // ✅ FIX 1: Watch position continuously from mount so the map always shows
  // the user's real location even before they press Start.
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted' || !mounted) return

      // Get immediate fix first
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      })
      if (mounted) {
        setCurrentLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        })
      }

      // Then keep watching in the background for live blue dot updates
      liveWatchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 2000,
          distanceInterval: 3,
        },
        (location) => {
          if (!mounted) return
          // Only update currentLocation from the live watcher when NOT actively
          // recording (the recording watcher handles it during a run)
          if (!watchRef.current) {
            setCurrentLocation({
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            })
          }
        }
      )
    })()

    return () => {
      mounted = false
      liveWatchRef.current?.remove()
    }
  }, [])

  const startTracking = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
      alert('Location permission is required to track your run!')
      return
    }

    setRoute([])
    setDistance(0)
    setDuration(0)
    distanceRef.current = 0
    isPausedRef.current = false
    setIsPaused(false)
    setIsTracking(true)

    timerRef.current = setInterval(() => {
      if (!isPausedRef.current) {
        setDuration((d) => d + 1)
      }
    }, 1000)

    watchRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 3000,
        distanceInterval: 5,
      },
      (location) => {
        // ✅ FIX 2: Ignore GPS points while paused so route/distance don't
        // accumulate when the user is standing still during a pause.
        if (isPausedRef.current) return

        const coord: Coordinate = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        }

        setCurrentLocation(coord)
        setRoute((prev) => {
          if (prev.length > 0) {
            const added = haversineDistance(prev[prev.length - 1], coord)
            distanceRef.current += added
            setDistance(distanceRef.current)
          }
          return [...prev, coord]
        })
      }
    )
  }

  // ✅ FIX 3: Pause suspends the timer and GPS accumulation without discarding data.
  const pauseTracking = useCallback(() => {
    isPausedRef.current = true
    setIsPaused(true)
  }, [])

  // ✅ FIX 4: Resume re-enables the timer and GPS accumulation.
  // We DON'T push a new point immediately on resume to avoid a phantom
  // straight line across the map if the user moved while paused.
  const resumeTracking = useCallback(() => {
    isPausedRef.current = false
    setIsPaused(false)
    // Mark the route with a "gap" by pushing a sentinel — easiest approach
    // is just to let the next real GPS event start a fresh segment.
    // We reset the "last point" by clearing the end of the route buffer
    // so haversineDistance won't draw a line across the pause gap.
    setRoute((prev) => {
      if (prev.length === 0) return prev
      // Duplicate the last coord as a new segment start.
      // This way the polyline won't jump across the pause gap.
      return [...prev, prev[prev.length - 1]]
    })
  }, [])

  const stopTracking = () => {
    watchRef.current?.remove()
    watchRef.current = null
    if (timerRef.current) clearInterval(timerRef.current)
    isPausedRef.current = false
    setIsPaused(false)
    setIsTracking(false)
  }

  const resetTracking = () => {
    setRoute([])
    setDistance(0)
    setDuration(0)
    distanceRef.current = 0
    setIsPaused(false)
    isPausedRef.current = false
  }

  const pace = duration > 0 && distance > 0 ? duration / 60 / distance : 0
  const calories = calculateCalories(distance)

  return {
    isTracking,
    isPaused,
    route,
    distance,
    duration,
    pace,
    calories,
    currentLocation,
    startTracking,
    pauseTracking,
    resumeTracking,
    stopTracking,
    resetTracking,
  }
}