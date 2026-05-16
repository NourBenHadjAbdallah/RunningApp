import { useEffect, useState } from 'react'
import { Stack, router, useSegments } from 'expo-router'
import { Session } from '@supabase/supabase-js'
import { View, ActivityIndicator } from 'react-native'
import { supabase } from '../services/supabase'
import { Colors } from '../constants/colors'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const segments = useSegments()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === '(auth)'

    if (session && inAuthGroup) {
      checkOnboarding(session.user.id)
    } else if (!session && !inAuthGroup) {
      router.replace('/(auth)/login')
    }
  }, [session, loading, segments])

  const checkOnboarding = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('onboarding_done')
        .eq('id', userId)
        .single()

      if (data?.onboarding_done) {
        router.replace('/(tabs)')
      } else {
        router.replace('/(tabs)/onboarding')
      }
    } catch {
      router.replace('/(tabs)')
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  )
}