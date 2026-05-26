// utils/locationTask.ts
//
// Registers the OS-level background location task that keeps GPS running
// when the screen is locked.
//
// IMPORTANT: Import this once at the very top of your app entry point
// (app/_layout.tsx) so TaskManager knows about it before any screen mounts:
//
//   import '../utils/locationTask'
//
// Do NOT import it anywhere else — duplicate TaskManager.defineTask calls
// for the same name will throw at runtime.

import { Platform } from 'react-native'
import * as TaskManager from 'expo-task-manager'
import * as Location from 'expo-location'
import * as Notifications from 'expo-notifications'
import { haversineDistance, formatTime, formatPace } from './calculations'

// ─── Task name (shared with useGPSTracking) ───────────────────────────────────

export const LOCATION_TASK = 'axionrun-background-location'

// ─── Notification channel — Android only ─────────────────────────────────────

if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('run-tracking', {
    name: 'Run Tracking',
    importance: Notifications.AndroidImportance.LOW,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    showBadge: false,
  })
}

// ─── Foreground notification behaviour (both platforms) ───────────────────────

Notifications.setNotificationHandler({
  handleNotification: async (): Promise<Notifications.NotificationBehavior> => ({
    shouldShowAlert:  false,
    shouldShowBanner: false,
    shouldShowList:   false,
    shouldPlaySound:  false,
    shouldSetBadge:   false,
  }),
})

// ─── Shared mutable state ─────────────────────────────────────────────────────

export const bgState = {
  isPaused:  false,
  distance:  0,
  duration:  0,
  lastCoord: null as { latitude: number; longitude: number } | null,
  onNewFix:  null as ((coord: { latitude: number; longitude: number }, altitude: number, timestamp: number) => void) | null,
}

// ─── Notification helper ──────────────────────────────────────────────────────

const NOTIFICATION_ID = 'axionrun-live-run'

async function updateNotification(distance: number, duration: number): Promise<void> {
  const pace = distance >= 0.1 ? duration / 60 / distance : 0
  const body = `${distance.toFixed(2)} km  ·  ${formatTime(duration)}  ·  ${formatPace(pace)}`
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: {
      title: '🏃 AxionRun — Running',
      body,
      sticky:      true,
      autoDismiss: false,
      // @ts-ignore — valid Expo field
      channelId: 'run-tracking',
      color:     '#6C63FF',
    },
    trigger: null,
  })
}

export async function dismissRunNotification(): Promise<void> {
  await Notifications.dismissNotificationAsync(NOTIFICATION_ID).catch(() => {})
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID).catch(() => {})
}

// ─── Background task definition ───────────────────────────────────────────────

TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any): Promise<void> => {
  if (error) {
    console.warn('[locationTask] Error:', error)
    return
  }

  if (bgState.isPaused) return

  const locations: Location.LocationObject[] = data?.locations ?? []
  if (!locations.length) return

  const loc       = locations[locations.length - 1]
  const coord     = { latitude: loc.coords.latitude, longitude: loc.coords.longitude }
  const altitude  = loc.coords.altitude ?? NaN
  const timestamp = loc.timestamp

  if (bgState.lastCoord) {
    const added = haversineDistance(bgState.lastCoord, coord)
    if (added < 0.05) bgState.distance += added
  }
  bgState.lastCoord = coord

  bgState.onNewFix?.(coord, altitude, timestamp)

  await updateNotification(bgState.distance, bgState.duration).catch(
    (e) => console.warn('[locationTask] Notification update failed:', e)
  )
})