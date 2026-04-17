import { supabase } from './supabase'

export interface Activity {
  id: string
  title: string
  distance: number
  duration: number
  pace: number
  calories: number
  route: { latitude: number; longitude: number }[]
  started_at: string
  created_at: string
  user_id: string
  // We will manually add username later if needed
}

export const activityService = {
  async saveActivity(data: {
    title: string
    distance: number
    duration: number
    pace: number
    calories: number
    route: { latitude: number; longitude: number }[]
  }) {
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user?.id) {
      throw new Error('You must be logged in to save an activity')
    }

    const { error } = await supabase.from('activities').insert({
      user_id: user.id,
      title: data.title.trim() || 'Morning Run',
      distance: parseFloat(data.distance.toFixed(3)),
      duration: data.duration,
      pace: parseFloat(data.pace.toFixed(2)),
      calories: Math.round(data.calories),
      route: data.route,
      started_at: new Date().toISOString(),
    })

    if (error) throw error

    // Update stats (non-critical)
    try {
      await supabase.rpc('increment_stats', {
        user_id: user.id,
        added_distance: data.distance,
      })
    } catch (e) {
      console.warn('Stats update failed:', e)
    }
  },

  // Simplified getFeed - no join to avoid PGRST200
  async getFeed(): Promise<Activity[]> {
    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      console.error('Get feed error:', error)
      throw error
    }

    return data ?? []
  },

  async getMyActivities(): Promise<Activity[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return []

    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data ?? []
  },

  async getMyProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return null

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (error) return null
    return data
  },
}