// services/trophyService.ts
// Handles storing and fetching event/challenge trophies from Supabase.
// Activity-based trophies (distance, streak…) are still computed locally
// in trophyDefinitions.ts — this only covers trophies that need to be "awarded".

import { supabase } from './supabase'
import { Trophy, TrophyTier, TrophyCategory } from './trophyDefinitions'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AwardPayload {
  trophy_id:    string       // unique key, e.g. "event_ramadan_2025"
  title:        string
  description?: string
  icon:         string       // FontAwesome5 icon name
  tier:         TrophyTier
  category:     TrophyCategory
  badge_number?: number      // number shown on hex face, if any
  source_id?:   string       // the event.id or challenge.id
  source_type?: 'event' | 'challenge'
}

// ── Award a trophy to the current user ────────────────────────────────────────
// Safe to call multiple times — the unique(user_id, trophy_id) constraint
// means duplicates are silently ignored (upsert with ignoreDuplicates).

export async function awardTrophy(payload: AwardPayload): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')

  const { error } = await supabase.from('user_trophies').upsert(
    {
      user_id:      user.id,
      trophy_id:    payload.trophy_id,
      title:        payload.title,
      description:  payload.description ?? '',
      icon:         payload.icon,
      tier:         payload.tier,
      category:     payload.category,
      badge_number: payload.badge_number ?? null,
      source_id:    payload.source_id   ?? null,
      source_type:  payload.source_type ?? null,
    },
    { onConflict: 'user_id,trophy_id', ignoreDuplicates: true }
  )
  if (error) throw error
}

// ── Fetch all awarded trophies for the current user ───────────────────────────
// Returns them already shaped as Trophy[] so they can be passed straight
// to computeTrophies(activities, extraTrophies).

export async function getAwardedTrophies(): Promise<Trophy[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) return []

  const { data, error } = await supabase
    .from('user_trophies')
    .select('*')
    .eq('user_id', user.id)
    .order('unlocked_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((row: any): Trophy => ({
    id:           row.trophy_id,
    title:        row.title,
    description:  row.description ?? '',
    icon:         row.icon,
    tier:         row.tier as TrophyTier,
    category:     row.category as TrophyCategory,
    badgeNumber:  row.badge_number ?? undefined,
    unlocked:     true,
    unlockedAt:   row.unlocked_at,
  }))
}

// ── Convenience: award and immediately return the full trophy list ─────────────
// Useful if you want to refresh the UI right after awarding.

export async function awardAndRefresh(
  payload: AwardPayload,
): Promise<Trophy[]> {
  await awardTrophy(payload)
  return getAwardedTrophies()
}