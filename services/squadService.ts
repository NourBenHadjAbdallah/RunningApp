// services/squadService.ts
//
// Squad management for Battle Zone territory conquest.
//
// ── Creation rules ────────────────────────────────────────────────────────────
//  • From scratch   → any authenticated user becomes the squad admin.
//  • From a group   → ONLY the group's admin_id may create; the squad is linked
//                     to that group via source_group_id and pre-filled with the
//                     group's name / photo so the admin just confirms.
//
// ── Admin rules ───────────────────────────────────────────────────────────────
//  • Only created_by (the squad admin) can edit details or delete the squad.
//  • Regular members can only leave.
//
// ── Zone accounting ───────────────────────────────────────────────────────────
//  • Battle Mode zones are always claimed personally.
//  • Your zones automatically count toward your squad total — no separate mode.
//
// ─── Required Supabase setup ──────────────────────────────────────────────────
//  Run squads_migration.sql once in the Supabase SQL editor.
//  It creates:
//    • squads table  (id, name, emoji, description, city, photo_url,
//                     max_members, invite_code, created_by, source_group_id)
//    • profiles.squad_id FK column
//    • RLS policies
//    • squad-photos storage bucket (public)
// ─────────────────────────────────────────────────────────────────────────────

import * as ImagePicker from 'expo-image-picker'
import { supabase } from './supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Squad {
  id: string
  name: string
  emoji: string
  description: string | null
  city: string | null
  photo_url: string | null
  max_members: number           // 0 = unlimited
  invite_code: string
  created_by: string | null     // uid of the squad admin
  source_group_id: string | null
  created_at: string
}

/** Payload for createSquad() */
export interface CreateSquadPayload {
  name: string
  emoji: string
  description?: string
  city?: string
  max_members?: number          // default 0 = unlimited
  photoUri?: string             // local file URI from image picker
  /**
   * If set, the service will verify the caller is admin of this group
   * before creating the squad.  Pass the group row's id.
   */
  source_group_id?: string
}

export interface SquadLeaderboardEntry {
  squad_id: string
  squad_name: string
  squad_emoji: string
  squad_photo_url: string | null
  member_count: number
  zone_count: number
  delta: number | null
}

export interface SquadMember {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  zone_count: number
  is_admin: boolean
}

// ─── Session baseline (mirrors battleZoneService delta pattern) ───────────────

let _squadBaseline: Map<string, number> | null = null

// ─── Private helpers ──────────────────────────────────────────────────────────

async function requireUser(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Not authenticated')
  return user.id
}

/**
 * Upload a cover photo to the `squad-photos` bucket.
 * Uses upsert so re-uploading replaces the old file.
 * Returns a cache-busted public URL.
 *
 * Path format: {uid}/{squadId}/cover.{ext}
 * The uid prefix satisfies the common RLS policy:
 *   (storage.foldername(name))[1] = auth.uid()::text
 */
async function uploadPhoto(localUri: string, squadId: string, uid: string): Promise<string> {
  const res  = await fetch(localUri)
  const blob = await res.blob()
  const ext  = localUri.split('.').pop()?.toLowerCase().replace(/\?.*$/, '') ?? 'jpg'
  const safeExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
  const path = `${uid}/${squadId}/cover.${safeExt}`
  const mime = safeExt === 'png' ? 'image/png' : safeExt === 'webp' ? 'image/webp' : 'image/jpeg'

  const { error } = await supabase.storage
    .from('squad-photos')
    .upload(path, blob, { contentType: mime, upsert: true })

  // Surface the real error message instead of swallowing it
  if (error) throw new Error(`Photo upload failed: ${error.message}`)

  const { data } = supabase.storage.from('squad-photos').getPublicUrl(path)
  // Bust CDN cache so updates show immediately
  return `${data.publicUrl}?t=${Date.now()}`
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const squadService = {

  // ────────────────────────────────────────────────────────────────────────────
  // Photo picker
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Opens the system photo library with a 16:9 crop tool.
   * Returns the local URI string, or null if the user cancelled.
   * Call this from the UI before passing photoUri to createSquad / updateSquad.
   */
  async pickPhoto(): Promise<string | null> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      throw new Error('Photo library access is required to set a squad photo.')
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],   // landscape banner
      quality: 0.82,
    })
    return result.canceled ? null : (result.assets[0]?.uri ?? null)
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Admin checks
  // ────────────────────────────────────────────────────────────────────────────

  /** True if the current user created this squad. */
  async isSquadAdmin(squadId: string): Promise<boolean> {
    const uid = await requireUser().catch(() => null)
    if (!uid) return false
    const { data } = await supabase
      .from('squads').select('created_by').eq('id', squadId).maybeSingle()
    return data?.created_by === uid
  },

  /**
   * True if the current user is admin of an existing *group* (not squad).
   * Reads the `groups` table — falls back to false if the table doesn't exist.
   * Your groups table must have an `admin_id` column.
   */
  async isGroupAdmin(groupId: string): Promise<boolean> {
    const uid = await requireUser().catch(() => null)
    if (!uid) return false
    try {
      const { data, error } = await supabase
        .from('groups').select('admin_id').eq('id', groupId).maybeSingle()
      if (error) return false
      return data?.admin_id === uid
    } catch { return false }
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Create
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * Creates a squad and auto-joins the creator.
   *
   * If payload.source_group_id is set:
   *   → verifies the caller is that group's admin_id.
   *   → links the squad row to the group.
   *
   * Photo is uploaded AFTER the row is inserted (we need the id for the path).
   * If the photo upload fails the squad is still created (just no cover image).
   */
  async createSquad(payload: CreateSquadPayload): Promise<Squad> {
    const uid = await requireUser()

    // ── Group-admin gate ────────────────────────────────────────────────────
    if (payload.source_group_id) {
      const ok = await squadService.isGroupAdmin(payload.source_group_id)
      if (!ok) throw new Error('Only the group admin can create a squad from this group.')
    }

    // Leave any current squad silently (no error if not in one)
    await squadService.leaveSquad().catch(() => {})

    // ── Insert row ──────────────────────────────────────────────────────────
    const { data: squad, error: insertErr } = await supabase
      .from('squads')
      .insert({
        name:            payload.name.trim(),
        emoji:           payload.emoji,
        description:     payload.description?.trim()  ?? null,
        city:            payload.city?.trim()          ?? null,
        max_members:     payload.max_members           ?? 0,
        created_by:      uid,
        source_group_id: payload.source_group_id       ?? null,
      })
      .select()
      .single()

    if (insertErr) throw insertErr
    let finalSquad = squad as Squad

    // ── Upload cover photo ──────────────────────────────────────────────────
    if (payload.photoUri) {
      try {
        const photoUrl = await uploadPhoto(payload.photoUri, squad.id, uid)
        const { data: updated, error: updErr } = await supabase
          .from('squads')
          .update({ photo_url: photoUrl })
          .eq('id', squad.id)
          .select()
          .single()
        if (!updErr && updated) finalSquad = updated as Squad
      } catch (e: any) {
        // Re-throw so the UI can show the real reason (RLS, bucket missing, etc.)
        // The squad row is already saved — delete it to avoid an orphan without a photo
        await supabase.from('squads').delete().eq('id', squad.id).then(() => {}, () => {})
        throw e
      }
    }

    // ── Auto-join ───────────────────────────────────────────────────────────
    await supabase
      .from('profiles')
      .update({ squad_id: finalSquad.id })
      .eq('id', uid)

    return finalSquad
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Update (admin only)
  // ────────────────────────────────────────────────────────────────────────────

  async updateSquad(
    squadId: string,
    patch: Partial<Pick<Squad, 'name' | 'emoji' | 'description' | 'city' | 'max_members'>>
      & { photoUri?: string },
  ): Promise<Squad> {
    const uid = await requireUser()

    // Admin gate
    const { data: current } = await supabase
      .from('squads').select('created_by').eq('id', squadId).maybeSingle()
    if (current?.created_by !== uid) {
      throw new Error('Only the squad admin can edit squad details.')
    }

    const updates: Record<string, any> = {}
    if (patch.name        !== undefined) updates.name        = patch.name.trim()
    if (patch.emoji       !== undefined) updates.emoji       = patch.emoji
    if (patch.description !== undefined) updates.description = patch.description?.trim() ?? null
    if (patch.city        !== undefined) updates.city        = patch.city?.trim()        ?? null
    if (patch.max_members !== undefined) updates.max_members = patch.max_members

    if (patch.photoUri) {
      updates.photo_url = await uploadPhoto(patch.photoUri, squadId, uid)
    }

    const { data, error } = await supabase
      .from('squads').update(updates).eq('id', squadId).select().single()
    if (error) throw error
    return data as Squad
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Join via invite code
  // ────────────────────────────────────────────────────────────────────────────

  async joinByCode(code: string): Promise<Squad> {
    const uid = await requireUser()

    const { data: squad, error } = await supabase
      .from('squads')
      .select('*')
      .eq('invite_code', code.trim().toUpperCase())
      .maybeSingle()

    if (error) throw error
    if (!squad) throw new Error('Squad not found — double-check the invite code.')

    // Respect member cap (0 = unlimited)
    if (squad.max_members > 0) {
      const { count } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('squad_id', squad.id)
      if ((count ?? 0) >= squad.max_members) {
        throw new Error(`This squad is full (max ${squad.max_members} members).`)
      }
    }

    await squadService.leaveSquad().catch(() => {})

    const { error: joinErr } = await supabase
      .from('profiles').update({ squad_id: squad.id }).eq('id', uid)
    if (joinErr) throw joinErr

    return squad as Squad
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Leave
  // ────────────────────────────────────────────────────────────────────────────

  async leaveSquad(): Promise<void> {
    const uid = await requireUser().catch(() => null)
    if (!uid) return
    const { error } = await supabase
      .from('profiles').update({ squad_id: null }).eq('id', uid)
    if (error) throw error
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Delete (admin only)
  // ────────────────────────────────────────────────────────────────────────────

  async deleteSquad(squadId: string): Promise<void> {
    const uid = await requireUser()
    const { data } = await supabase
      .from('squads').select('created_by').eq('id', squadId).maybeSingle()
    if (data?.created_by !== uid) {
      throw new Error('Only the squad admin can delete this squad.')
    }
    // Detach all members before deleting (FK constraint)
    await supabase.from('profiles').update({ squad_id: null }).eq('squad_id', squadId)
    const { error } = await supabase.from('squads').delete().eq('id', squadId)
    if (error) throw error
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Fetch current user's squad
  // ────────────────────────────────────────────────────────────────────────────

  async mySquad(): Promise<Squad | null> {
    const uid = await requireUser().catch(() => null)
    if (!uid) return null

    const { data: profile } = await supabase
      .from('profiles').select('squad_id').eq('id', uid).maybeSingle()
    if (!profile?.squad_id) return null

    const { data, error } = await supabase
      .from('squads').select('*').eq('id', profile.squad_id).maybeSingle()
    if (error) throw error
    return (data as Squad) ?? null
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Members list with zone counts
  // ────────────────────────────────────────────────────────────────────────────

  async getMembers(squadId: string): Promise<SquadMember[]> {
    const { data: squad } = await supabase
      .from('squads').select('created_by').eq('id', squadId).maybeSingle()
    const adminId = squad?.created_by ?? null

    const { data: profiles, error } = await supabase
      .from('profiles').select('id, username, full_name, avatar_url').eq('squad_id', squadId)
    if (error) throw error
    if (!profiles?.length) return []

    const ids = profiles.map((p: any) => p.id)
    const { data: zones } = await supabase
      .from('battle_zones').select('owner_id').in('owner_id', ids)

    const countMap: Record<string, number> = {}
    for (const z of zones ?? []) {
      if (!z.owner_id) continue
      countMap[z.owner_id] = (countMap[z.owner_id] ?? 0) + 1
    }

    return profiles
      .map((p: any): SquadMember => ({
        id:         p.id,
        username:   p.username,
        full_name:  p.full_name,
        avatar_url: p.avatar_url,
        zone_count: countMap[p.id] ?? 0,
        is_admin:   p.id === adminId,
      }))
      .sort((a, b) => b.zone_count - a.zone_count)
  },

  // ────────────────────────────────────────────────────────────────────────────
  // Group leaderboard (top 20 squads by total zones)
  // ────────────────────────────────────────────────────────────────────────────

  async getGroupLeaderboard(): Promise<SquadLeaderboardEntry[]> {
    // 1. All profiles that belong to a squad
    const { data: members, error: mErr } = await supabase
      .from('profiles').select('id, squad_id').not('squad_id', 'is', null)
    if (mErr) throw mErr
    if (!members?.length) return []

    const memberToSquad: Record<string, string>  = {}
    const squadMemberCount: Record<string, number> = {}
    for (const m of members) {
      if (!m.squad_id) continue
      memberToSquad[m.id]        = m.squad_id
      squadMemberCount[m.squad_id] = (squadMemberCount[m.squad_id] ?? 0) + 1
    }

    const memberIds = Object.keys(memberToSquad)
    if (!memberIds.length) return []

    // 2. Zone rows for those members
    const { data: zones } = await supabase
      .from('battle_zones').select('owner_id').in('owner_id', memberIds)

    const squadZones: Record<string, number> = {}
    for (const z of zones ?? []) {
      if (!z.owner_id) continue
      const sid = memberToSquad[z.owner_id]
      if (!sid) continue
      squadZones[sid] = (squadZones[sid] ?? 0) + 1
    }

    // 3. Baseline / delta
    const isFirstLoad = _squadBaseline === null
    if (isFirstLoad) _squadBaseline = new Map(Object.entries(squadZones))

    // FIX: use ALL squads that have members, not just those with zones.
    // Previously this was Object.keys(squadZones), which excluded squads with
    // 0 zones — so their photo_url was never fetched and always showed as null.
    const allSquadIds = [...new Set(Object.values(memberToSquad))]
    if (!allSquadIds.length) return []

    // 4. Squad metadata — fetch for every squad that has at least one member
    const { data: squads } = await supabase
      .from('squads').select('id, name, emoji, photo_url').in('id', allSquadIds)

    const info: Record<string, { name: string; emoji: string; photo_url: string | null }> = {}
    for (const s of squads ?? []) {
      info[s.id] = { name: s.name, emoji: s.emoji, photo_url: s.photo_url ?? null }
    }

    // 5. Build + sort entries (include 0-zone squads so they appear in the list)
    return allSquadIds
      .map(sid => {
        const zone_count = squadZones[sid] ?? 0
        const baseCt     = _squadBaseline?.get(sid) ?? null
        return {
          squad_id:        sid,
          squad_name:      info[sid]?.name      ?? 'Unknown Squad',
          squad_emoji:     info[sid]?.emoji     ?? '⚡',
          squad_photo_url: info[sid]?.photo_url ?? null,
          member_count:    squadMemberCount[sid] ?? 0,
          zone_count,
          delta: isFirstLoad
            ? null
            : baseCt !== null ? zone_count - baseCt : null,
        }
      })
      .sort((a, b) =>
        b.zone_count !== a.zone_count
          ? b.zone_count - a.zone_count
          : (b.delta ?? 0) - (a.delta ?? 0)
      )
      .slice(0, 20)
  },

  resetGroupBaseline(): void { _squadBaseline = null },
}