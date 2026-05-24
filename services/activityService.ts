import { supabase } from './supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  group_id?: string | null
  profiles?: { username: string; avatar_url?: string | null }
  groups?: { name: string } | null
  kudos_count?: number
  comment_count?: number
}

export interface Group {
  id: string
  name: string
  description: string | null
  icon: string
  category: 'running' | 'trail' | 'marathon' | 'casual'
  member_count: number
  created_by: string
  created_at: string
  joined?: boolean
}

export interface RunEvent {
  id: string
  title: string
  description: string | null
  location: string | null
  event_date: string
  distance_km: number | null
  spots_total: number | null
  type: 'race' | 'group_run' | 'virtual'
  organizer: string | null
  group_id: string | null
  created_by: string
  created_at: string
  rsvp_count?: number
  going?: boolean
}

export interface Challenge {
  id: string
  title: string
  description: string | null
  icon: string
  points: number
  target_km: number | null
  target_runs: number | null
  difficulty: 'easy' | 'medium' | 'hard'
  category: 'distance' | 'consistency' | 'speed' | 'time'
  starts_at: string
  ends_at: string
  active: boolean
  completed?: boolean
}

export interface TrainingProgram {
  id: string
  title: string
  subtitle: string | null
  description: string | null
  weeks: number
  runs_per_week: number
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  icon: string
  phases: { name: string; weeks: number; focus: string }[]
  active: boolean
  created_at: string
  enrolled?: boolean
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const activityService = {

  // ── Activities ─────────────────────────────────────────────────────────────

  async saveActivity(data: {
    title: string
    distance: number
    duration: number
    pace: number
    calories: number
    route: { latitude: number; longitude: number }[]
    group_id?: string | null
  }) {
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user?.id) throw new Error('You must be logged in to save an activity')

    // Validate inputs server-side before insert
    const title = data.title.trim().slice(0, 100) || 'Morning Run'
    const distance = Math.max(0, parseFloat(data.distance.toFixed(3)))
    const duration = Math.max(0, Math.round(data.duration))
    const pace = Math.max(0, parseFloat(data.pace.toFixed(2)))
    const calories = Math.max(0, Math.round(data.calories))
    const route = (data.route ?? []).slice(0, 10000) // cap at 10k points

    const { error } = await supabase.from('activities').insert({
      user_id: user.id,
      title,
      distance,
      duration,
      pace,
      calories,
      route,
      started_at: new Date().toISOString(),
      group_id: data.group_id ?? null,
    })
    if (error) throw error

    try {
      // ✅ FIX: no longer passes user_id — the RPC uses auth.uid() internally
      await supabase.rpc('increment_stats', { added_distance: distance })
    } catch (e) {
      console.warn('Stats update failed:', e)
    }
  },

  async getFriendsFeed(): Promise<Activity[]> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return []

    const { data: followData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)

    const followingIds = (followData ?? []).map((f: any) => f.following_id)
    const userIds = [...new Set([user.id, ...followingIds])]

    const { data, error } = await supabase
      .from('activities')
      .select(`*, kudos ( id ), comments ( id )`)
      .in('user_id', userIds)
      .order('created_at', { ascending: false })
      .limit(30)

    if (error) throw error

    const uniqueUserIds = [...new Set((data ?? []).map((a: any) => a.user_id))]
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', uniqueUserIds)

    const profilesMap = Object.fromEntries((profilesData ?? []).map((p: any) => [p.id, p]))

    return (data ?? []).map((a: any) => ({
      ...a,
      profiles: profilesMap[a.user_id] ?? null,
      kudos_count: a.kudos?.length ?? 0,
      comment_count: a.comments?.length ?? 0,
    }))
  },

  // Activities from groups the current user has joined
async getGroupFeed(): Promise<Activity[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return []

  // Get IDs of groups the user belongs to
  const { data: memberData } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', user.id)

  const groupIds = (memberData ?? []).map((m: any) => m.group_id)
  if (groupIds.length === 0) return []

  const { data, error } = await supabase
    .from('activities')
    .select(`*, kudos ( id ), comments ( id )`)
    .in('group_id', groupIds)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) throw error

  const uniqueUserIds = [...new Set((data ?? []).map((a: any) => a.user_id))]
  const { data: profilesData } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .in('id', uniqueUserIds)

  const profilesMap = Object.fromEntries((profilesData ?? []).map((p: any) => [p.id, p]))

  return (data ?? []).map((a: any) => ({
    ...a,
    profiles: profilesMap[a.user_id] ?? null,
    kudos_count: a.kudos?.length ?? 0,
    comment_count: a.comments?.length ?? 0,
  }))
},

  async getFeed(): Promise<Activity[]> {
    const { data, error } = await supabase
      .from('activities')
      .select(`*, kudos ( id ), comments ( id )`)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error

    const uniqueUserIds = [...new Set((data ?? []).map((a: any) => a.user_id))]
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', uniqueUserIds)

    const profilesMap = Object.fromEntries((profilesData ?? []).map((p: any) => [p.id, p]))

    return (data ?? []).map((a: any) => ({
      ...a,
      profiles: profilesMap[a.user_id] ?? null,
      kudos_count: a.kudos?.length ?? 0,
      comment_count: a.comments?.length ?? 0,
    }))
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

  // ── Kudos ──────────────────────────────────────────────────────────────────

  async giveKudos(activityId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return
    await supabase.from('kudos').insert({ activity_id: activityId, user_id: user.id })
  },

  async removeKudos(activityId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return
    await supabase.from('kudos')
      .delete()
      .eq('activity_id', activityId)
      .eq('user_id', user.id)
  },

  async getMyKudos(activityIds: string[]): Promise<Set<string>> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id || activityIds.length === 0) return new Set()

    const { data } = await supabase
      .from('kudos')
      .select('activity_id')
      .eq('user_id', user.id)
      .in('activity_id', activityIds)

    return new Set((data ?? []).map((k: any) => k.activity_id))
  },

  // ── Groups ─────────────────────────────────────────────────────────────────

  async getGroups(): Promise<Group[]> {
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .order('member_count', { ascending: false })

    if (error) throw error
    if (!user?.id) return data ?? []

    const { data: memberData } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('user_id', user.id)

    const joinedIds = new Set((memberData ?? []).map((m: any) => m.group_id))
    return (data ?? []).map((g: any) => ({ ...g, joined: joinedIds.has(g.id) }))
  },

  async joinGroup(groupId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return
    await supabase.from('group_members').insert({ group_id: groupId, user_id: user.id })
  },

  async leaveGroup(groupId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return
    await supabase.from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', user.id)
  },

  // ── Events ─────────────────────────────────────────────────────────────────

  async getEvents(): Promise<RunEvent[]> {
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('events')
      .select(`*, event_rsvps ( id, user_id )`)
      .gte('event_date', new Date().toISOString())
      .order('event_date', { ascending: true })

    if (error) throw error

    return (data ?? []).map((e: any) => ({
      ...e,
      rsvp_count: e.event_rsvps?.length ?? 0,
      going: user?.id
        ? (e.event_rsvps ?? []).some((r: any) => r.user_id === user.id)
        : false,
    }))
  },

  async rsvpEvent(eventId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return
    await supabase.from('event_rsvps').insert({ event_id: eventId, user_id: user.id, going: true })
  },

  async cancelRsvp(eventId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return
    await supabase.from('event_rsvps')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', user.id)
  },

  // ── Challenges ─────────────────────────────────────────────────────────────

  async getChallenges(): Promise<Challenge[]> {
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('challenges')
      .select('*')
      .eq('active', true)
      .order('ends_at', { ascending: true })

    if (error) throw error
    if (!user?.id) return data ?? []

    const { data: completions } = await supabase
      .from('challenge_completions')
      .select('challenge_id')
      .eq('user_id', user.id)

    const completedIds = new Set((completions ?? []).map((c: any) => c.challenge_id))
    return (data ?? []).map((c: any) => ({ ...c, completed: completedIds.has(c.id) }))
  },

  async completeChallenge(challengeId: string, points: number): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return
    await supabase.from('challenge_completions').insert({
      challenge_id: challengeId,
      user_id: user.id,
      points_earned: points,
    })
  },

  async uncompleteChallenge(challengeId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return
    await supabase.from('challenge_completions')
      .delete()
      .eq('challenge_id', challengeId)
      .eq('user_id', user.id)
  },

  // ── Training Programs ──────────────────────────────────────────────────────

  async getPrograms(): Promise<TrainingProgram[]> {
    const { data: { user } } = await supabase.auth.getUser()

    const { data, error } = await supabase
      .from('training_programs')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: true })

    if (error) throw error
    if (!user?.id) return data ?? []

    const { data: enrollments } = await supabase
      .from('program_enrollments')
      .select('program_id')
      .eq('user_id', user.id)
      .eq('active', true)

    const enrolledIds = new Set((enrollments ?? []).map((e: any) => e.program_id))
    return (data ?? []).map((p: any) => ({ ...p, enrolled: enrolledIds.has(p.id) }))
  },

  async enrollProgram(programId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return
    await supabase.from('program_enrollments').upsert({
      program_id: programId,
      user_id: user.id,
      active: true,
      started_at: new Date().toISOString(),
    }, { onConflict: 'program_id,user_id' })
  },

  async unenrollProgram(programId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return
    await supabase.from('program_enrollments')
      .update({ active: false })
      .eq('program_id', programId)
      .eq('user_id', user.id)
  },

  // ── Follows ────────────────────────────────────────────────────────────────

  async followUser(targetUserId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return
    await supabase.from('follows').insert({ follower_id: user.id, following_id: targetUserId })
  },

  async unfollowUser(targetUserId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user?.id) return
    await supabase.from('follows')
      .delete()
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)
  },
}