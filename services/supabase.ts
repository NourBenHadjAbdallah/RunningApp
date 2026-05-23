import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'
import Constants from 'expo-constants'

// ─── Credential resolution ────────────────────────────────────────────────────
//
// We read from two sources in order of preference:
//
// 1. process.env.EXPO_PUBLIC_* — works when Expo's bundler substitutes the
//    value at build time (SDK 49+, requires a server restart after .env changes)
//
// 2. Constants.expoConfig.extra — populated by app.config.js at start time,
//    reliable fallback that works even when the bundler substitution misses.
//
// Using two static accesses (not dynamic) satisfies the expo/no-dynamic-env-var rule.

const supabaseUrl: string =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  (Constants.expoConfig?.extra?.supabaseUrl as string) ||
  ''

const supabaseAnonKey: string =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  (Constants.expoConfig?.extra?.supabaseAnonKey as string) ||
  ''

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    '[supabase] Missing credentials.\n' +
    'Make sure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are in your ' +
    '.env.local file, then stop Expo completely (Ctrl+C) and run `npx expo start --clear`.'
  )
}

// ─── SecureStore adapter with chunking ───────────────────────────────────────
// SecureStore has a 2048-byte limit per key. This adapter splits large values
// (e.g. JWT sessions) into chunks so nothing is silently truncated.

const CHUNK_SIZE = 1900

console.log('[supabase] URL:', process.env.EXPO_PUBLIC_SUPABASE_URL)
console.log('[supabase] KEY:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY)
console.log('[supabase] extra:', Constants.expoConfig?.extra)

const ChunkedSecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    const chunkCountStr = await SecureStore.getItemAsync(`${key}_chunkcount`)
    if (chunkCountStr) {
      const chunkCount = parseInt(chunkCountStr, 10)
      const chunks: string[] = []
      for (let i = 0; i < chunkCount; i++) {
        const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`)
        if (chunk === null) return null
        chunks.push(chunk)
      }
      return chunks.join('')
    }
    return SecureStore.getItemAsync(key)
  },

  async setItem(key: string, value: string): Promise<void> {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value)
      await ChunkedSecureStoreAdapter._removeChunks(key)
    } else {
      const chunks: string[] = []
      for (let i = 0; i < value.length; i += CHUNK_SIZE) {
        chunks.push(value.slice(i, i + CHUNK_SIZE))
      }
      for (let i = 0; i < chunks.length; i++) {
        await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunks[i])
      }
      await SecureStore.setItemAsync(`${key}_chunkcount`, String(chunks.length))
      await SecureStore.deleteItemAsync(key)
    }
  },

  async removeItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key)
    await ChunkedSecureStoreAdapter._removeChunks(key)
  },

  async _removeChunks(key: string): Promise<void> {
    const chunkCountStr = await SecureStore.getItemAsync(`${key}_chunkcount`)
    if (!chunkCountStr) return
    const chunkCount = parseInt(chunkCountStr, 10)
    for (let i = 0; i < chunkCount; i++) {
      await SecureStore.deleteItemAsync(`${key}_chunk_${i}`)
    }
    await SecureStore.deleteItemAsync(`${key}_chunkcount`)
  },
}

// ─── Supabase client ──────────────────────────────────────────────────────────

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ChunkedSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})