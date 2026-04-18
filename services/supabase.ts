import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import * as SecureStore from 'expo-secure-store'

// SecureStore has a 2048 byte limit per key.
// This adapter splits large values into chunks so the auth session
// (which contains JWTs and can exceed 2048 bytes) is stored safely.

const CHUNK_SIZE = 1900 // stay well under the 2048 limit

const ChunkedSecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    // Try reading a chunked value first
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
    // Fall back to reading a plain (non-chunked) value
    return SecureStore.getItemAsync(key)
  },

  async setItem(key: string, value: string): Promise<void> {
    if (value.length <= CHUNK_SIZE) {
      // Small enough — store as a single key, clean up any old chunks
      await SecureStore.setItemAsync(key, value)
      await ChunkedSecureStoreAdapter.removeItem(`${key}_chunked`)
    } else {
      // Split into chunks
      const chunks: string[] = []
      for (let i = 0; i < value.length; i += CHUNK_SIZE) {
        chunks.push(value.slice(i, i + CHUNK_SIZE))
      }
      for (let i = 0; i < chunks.length; i++) {
        await SecureStore.setItemAsync(`${key}_chunk_${i}`, chunks[i])
      }
      await SecureStore.setItemAsync(`${key}_chunkcount`, String(chunks.length))
      // Remove the plain key in case it existed before
      await SecureStore.deleteItemAsync(key)
    }
  },

  async removeItem(key: string): Promise<void> {
    // Remove plain key
    await SecureStore.deleteItemAsync(key)
    // Remove any chunks
    const chunkCountStr = await SecureStore.getItemAsync(`${key}_chunkcount`)
    if (chunkCountStr) {
      const chunkCount = parseInt(chunkCountStr, 10)
      for (let i = 0; i < chunkCount; i++) {
        await SecureStore.deleteItemAsync(`${key}_chunk_${i}`)
      }
      await SecureStore.deleteItemAsync(`${key}_chunkcount`)
    }
  },
}

const supabaseUrl = 'https://lhfohqicdqywekujhzfc.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoZm9ocWljZHF5d2VrdWpoemZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNzgyMDAsImV4cCI6MjA5MTg1NDIwMH0.lYRKe9JGQb7uF-2oU7Z9W76T9ALnMD9Ox8Fuq-CGrNs'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ChunkedSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})