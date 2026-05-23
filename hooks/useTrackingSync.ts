// hooks/useTrackingSync.ts
// Flushes the offline run queue whenever the app comes back to the foreground.
// Extracted so TrackingScreen doesn't carry AppState boilerplate.

import { useEffect } from 'react'
import { AppState, AppStateStatus } from 'react-native'
import { activityService } from '../services/activityService'
import { flushQueue } from '../utils/offlineQueue'

export function useTrackingSync(): void {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        flushQueue(activityService.saveActivity).then(({ saved }) => {
          if (saved > 0) console.log(`[sync] Flushed ${saved} offline run(s)`)
        })
      }
    })
    return () => sub.remove()
  }, [])
}