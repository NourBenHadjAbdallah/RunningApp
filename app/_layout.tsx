import { useEffect, useState, useCallback } from 'react'
import { Stack, router, useSegments, useRootNavigationState } from 'expo-router'
import { Session } from '@supabase/supabase-js'
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native'
import { supabase } from '../services/supabase'
import { Colors } from '../constants/colors'

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * How long to wait for getUser() before giving up and showing an error screen.
 * We never fall back to the cached session — a non-response is treated as
 * "cannot verify" and the user stays blocked until the network recovers.
 */
const VERIFY_TIMEOUT_MS = 8_000

// ─── Types ────────────────────────────────────────────────────────────────────

type BootstrapState =
  | { status: 'loading' }
  | { status: 'error'; reason: 'timeout' | 'network' | 'unknown' }
  | { status: 'done'; session: Session | null }

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Calls supabase.auth.getUser() with a hard timeout.
 *
 * SECURITY CONTRACT
 * -----------------
 * On timeout or any network/server error, we return null (not the cached
 * session). The caller must block navigation until a real server response
 * arrives. This eliminates the bypass window where a revoked token + slow
 * network lets a user into protected screens.
 */
async function verifyWithServer(): Promise<
  | { ok: true;  session: Session }
  | { ok: false; reason: 'timeout' | 'network' | 'unknown' | 'no_session' }
> {
  const timeoutPromise = new Promise<'timeout'>(resolve =>
    setTimeout(() => resolve('timeout'), VERIFY_TIMEOUT_MS)
  )

  try {
    const raceResult = await Promise.race([
      supabase.auth.getUser().then(r => ({ type: 'result' as const, r })),
      timeoutPromise.then(t => ({ type: 'timeout' as const, t })),
    ])

    if (raceResult.type === 'timeout') {
      console.warn('[auth] getUser() timed out after', VERIFY_TIMEOUT_MS, 'ms')
      return { ok: false, reason: 'timeout' }
    }

    const { data, error } = raceResult.r

    if (error) {
      const isNetworkError =
        error.message?.toLowerCase().includes('network') ||
        error.message?.toLowerCase().includes('fetch') ||
        error.status === 0
      console.warn('[auth] getUser() error:', error.message)
      return { ok: false, reason: isNetworkError ? 'network' : 'unknown' }
    }

    if (!data.user) {
      return { ok: false, reason: 'no_session' }
    }

    // Server confirmed the user is valid — now get the full session object.
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return { ok: false, reason: 'no_session' }

    return { ok: true, session }

  } catch (e) {
    console.error('[auth] unexpected error in verifyWithServer:', e)
    return { ok: false, reason: 'unknown' }
  }
}

// ─── Error screen ─────────────────────────────────────────────────────────────

const ERROR_COPY = {
  timeout: {
    title: 'Connection timed out',
    message: 'We couldn\'t reach the server in time. Please check your connection and try again.',
  },
  network: {
    title: 'No connection',
    message: 'A network error occurred. Please check your connection and try again.',
  },
  unknown: {
    title: 'Something went wrong',
    message: 'We couldn\'t verify your session. Please try again.',
  },
} as const

function VerifyErrorScreen({
  reason,
  onRetry,
}: {
  reason: 'timeout' | 'network' | 'unknown'
  onRetry: () => void
}) {
  const copy = ERROR_COPY[reason]
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>{copy.title}</Text>
      <Text style={styles.errorMessage}>{copy.message}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.8}>
        <Text style={styles.retryText}>Try again</Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── Root layout ─────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [bootstrap, setBootstrap] = useState<BootstrapState>({ status: 'loading' })
  const [session,   setSession  ] = useState<Session | null>(null)
  const segments                  = useSegments()
  const navigationState           = useRootNavigationState()

  // ── Step 1: Verify with the server on mount (and on retry) ───────────────
  const runBootstrap = useCallback(async () => {
    setBootstrap({ status: 'loading' })

    const result = await verifyWithServer()

    if (result.ok) {
      setSession(result.session)
      setBootstrap({ status: 'done', session: result.session })
    } else if (result.reason === 'no_session') {
      // Definitive answer: no valid session exists.
      setSession(null)
      setBootstrap({ status: 'done', session: null })
    } else {
      // Timeout / network / unknown — block the app, show retry.
      // We do NOT fall back to the cached session.
      setBootstrap({ status: 'error', reason: result.reason })
    }
  }, [])

  useEffect(() => { runBootstrap() }, [runBootstrap])

  // ── Step 2: Keep session in sync on auth state changes ───────────────────
  // Only active after a successful bootstrap; changes here are always
  // triggered by real Supabase events (sign-in, sign-out, token refresh).
  useEffect(() => {
    if (bootstrap.status !== 'done') return

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => setSession(newSession)
    )
    return () => subscription.unsubscribe()
  }, [bootstrap.status])

  // ── Step 3: Redirect only after navigator is mounted and ready ────────────
  useEffect(() => {
    if (bootstrap.status !== 'done') return
    if (!navigationState?.key)       return

    const inAuthGroup = segments[0] === '(auth)'

    if (session && inAuthGroup) {
      router.replace('/(tabs)')
    } else if (!session && !inAuthGroup) {
      router.replace('/(auth)/login')
    }
  }, [bootstrap.status, session, segments, navigationState?.key])

  // ── Render ────────────────────────────────────────────────────────────────
  if (bootstrap.status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  if (bootstrap.status === 'error') {
    return (
      <VerifyErrorScreen reason={bootstrap.reason} onRetry={runBootstrap} />
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 32,
    gap: 12,
  },
  errorTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorMessage: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    marginTop: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
})