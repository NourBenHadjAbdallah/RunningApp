// services/followService.ts
//
// Supabase schema expected:
//
//   create table follows (
//     follower_id uuid references profiles(id) on delete cascade,
//     following_id uuid references profiles(id) on delete cascade,
//     created_at timestamptz default now(),
//     primary key (follower_id, following_id)
//   );
//
//   -- Denormalised counters on profiles (optional but fast):
//   alter table profiles
//     add column if not exists follower_count  int default 0,
//     add column if not exists following_count int default 0;
//
//   -- Keep counters in sync via triggers (see bottom of this file).

import { supabase } from './supabase'

export interface FollowCounts {
  followers: number
  following: number
}

export interface PublicProfile {
  id: string
  username: string
  full_name: string | null
  avatar_url: string | null
  total_distance: number
  total_runs: number
  follower_count: number
  following_count: number
}

export const followService = {
  // ── Current viewer helpers ─────────────────────────────────────────────────

  async currentUserId(): Promise<string | null> {
    const { data } = await supabase.auth.getUser()
    return data.user?.id ?? null
  },

  // ── Check whether the viewer already follows a profile ────────────────────

  async isFollowing(targetId: string): Promise<boolean> {
    const meId = await followService.currentUserId()
    if (!meId || meId === targetId) return false

    // BUG FIX 1: The follows table has no `id` column — it uses a composite PK.
    // Selecting 'id' always returned null, making every isFollowing() call
    // return false regardless of actual follow state. Select follower_id instead.
    const { data, error } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', meId)
      .eq('following_id', targetId)
      .maybeSingle()

    if (error) throw error
    return !!data
  },

  // ── Follow ─────────────────────────────────────────────────────────────────

  async follow(targetId: string): Promise<void> {
    const meId = await followService.currentUserId()
    if (!meId) throw new Error('Not authenticated')
    if (meId === targetId) throw new Error('Cannot follow yourself')

    // BUG FIX 2: Removed the spurious .select() after .insert().
    // With PostgREST, chaining .select() after .insert() changes the request
    // to a "return=representation" insert, which fails when RLS policies don't
    // grant SELECT on the inserted row — causing follow to silently error out.
    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: meId, following_id: targetId })

    // 23505 = unique_violation — already following, treat as success
    if (error && error.code !== '23505') throw error
  },

  // ── Unfollow ───────────────────────────────────────────────────────────────

  async unfollow(targetId: string): Promise<void> {
    const meId = await followService.currentUserId()
    if (!meId) throw new Error('Not authenticated')

    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('follower_id', meId)
      .eq('following_id', targetId)

    if (error) throw error
  },

  // ── Toggle convenience ─────────────────────────────────────────────────────

  async toggle(targetId: string, currentlyFollowing: boolean): Promise<boolean> {
    if (currentlyFollowing) {
      await followService.unfollow(targetId)
      return false
    } else {
      await followService.follow(targetId)
      return true
    }
  },

  // ── Follower / following counts for a profile ──────────────────────────────

  async getCounts(profileId: string): Promise<FollowCounts> {
    const [{ count: followers, error: e1 }, { count: following, error: e2 }] = await Promise.all([
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', profileId),
      supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', profileId),
    ])
    if (e1) throw e1
    if (e2) throw e2
    return { followers: followers ?? 0, following: following ?? 0 }
  },

  // ── Fetch a public profile by id ──────────────────────────────────────────

  async getPublicProfile(profileId: string): Promise<PublicProfile | null> {
    const [{ data, error }, counts] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, total_distance, total_runs')
        .eq('id', profileId)
        .maybeSingle(),
      followService.getCounts(profileId),
    ])

    if (error) throw error
    if (!data) return null

    // BUG FIX 3: getCounts() returns { followers, following } but PublicProfile
    // expects { follower_count, following_count }. The mismatch meant counts were
    // always undefined on every profile card and public profile screen.
    return {
      ...(data as any),
      follower_count: counts.followers,
      following_count: counts.following,
    } as PublicProfile
  },

  // ── IDs that the viewer follows (for filtering home feed) ─────────────────

  async getFollowingIds(): Promise<string[]> {
    const meId = await followService.currentUserId()
    if (!meId) return []

    const { data, error } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', meId)

    if (error) throw error
    return (data ?? []).map((r: any) => r.following_id as string)
  },

  // ── Follower list (people who follow profileId) ───────────────────────────

  async getFollowers(profileId: string): Promise<PublicProfile[]> {
    const { data, error } = await supabase
      .from('follows')
      .select('follower:profiles!follows_follower_id_fkey(id, username, full_name, total_distance, total_runs)')
      .eq('following_id', profileId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    const rows = (data ?? []).map((r: any) => r.follower as Omit<PublicProfile, 'follower_count' | 'following_count'>)
    const withCounts = await Promise.all(
      rows.map(async (p) => {
        const counts = await followService.getCounts(p.id)
        return { ...p, follower_count: counts.followers, following_count: counts.following }
      })
    )
    return withCounts as PublicProfile[]
  },

  async getFollowing(profileId: string): Promise<PublicProfile[]> {
    const { data, error } = await supabase
      .from('follows')
      .select('following:profiles!follows_following_id_fkey(id, username, full_name, total_distance, total_runs)')
      .eq('follower_id', profileId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    const rows = (data ?? []).map((r: any) => r.following as Omit<PublicProfile, 'follower_count' | 'following_count'>)
    const withCounts = await Promise.all(
      rows.map(async (p) => {
        const counts = await followService.getCounts(p.id)
        return { ...p, follower_count: counts.followers, following_count: counts.following }
      })
    )
    return withCounts as PublicProfile[]
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// OPTIONAL: Supabase trigger SQL to keep follower_count / following_count
// in sync automatically. Run this once in the Supabase SQL editor.
// ─────────────────────────────────────────────────────────────────────────────
//
// create or replace function update_follow_counts()
// returns trigger language plpgsql as $$
// begin
//   if TG_OP = 'INSERT' then
//     update profiles set follower_count  = follower_count  + 1 where id = NEW.following_id;
//     update profiles set following_count = following_count + 1 where id = NEW.follower_id;
//   elsif TG_OP = 'DELETE' then
//     update profiles set follower_count  = greatest(follower_count  - 1, 0) where id = OLD.following_id;
//     update profiles set following_count = greatest(following_count - 1, 0) where id = OLD.follower_id;
//   end if;
//   return null;
// end;
// $$;
//
// create trigger trg_follow_counts
// after insert or delete on follows
// for each row execute function update_follow_counts();