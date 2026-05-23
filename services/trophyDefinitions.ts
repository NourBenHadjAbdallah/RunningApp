// services/trophyDefinitions.ts
// Pure data — no Supabase calls. Trophies are derived entirely from local Activity data.
// To add new trophy SOURCES (events, challenges), see the bottom of this file.

import { Activity } from './activityService'

export type TrophyTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export type TrophyCategory =
  | 'milestone'     // Activity count milestones (1st, 5th, 10th…)
  | 'distance'      // Total km thresholds
  | 'streak'        // Consecutive day streaks
  | 'speed'         // Pace records
  | 'consistency'   // Run count habits
  | 'event'         // ← Future: awarded when user joins/completes an event
  | 'challenge'     // ← Future: awarded when a challenge is completed

export interface Trophy {
  id: string
  title: string
  description: string
  icon: string            // FontAwesome5 icon name
  /** Number shown on the badge face (e.g. "10" for 10th activity). null = no number */
  badgeNumber?: number
  tier: TrophyTier
  unlocked: boolean
  unlockedAt?: string     // ISO date string
  progress?: number       // 0–1 for locked trophies
  progressLabel?: string  // e.g. "3 / 5 runs"
  category: TrophyCategory
}

// ── Tier colours (used in components) ─────────────────────────────────────────
// Tier colours — mapped to the app's teal brand palette
// bronze   → muted teal-grey  (entry level)
// silver   → mid teal         (Colors.primary)
// gold     → bright teal      (Colors.primaryLight)
// platinum → white-teal glow  (premium)
export const TIER_COLORS: Record<TrophyTier, string> = {
  bronze:   '#28806e',   // Colors.primaryDark  — deep teal
  silver:   '#38b89e',   // Colors.primary      — mid teal
  gold:     '#5bd3b8',   // Colors.primaryLight — bright teal
  platinum: '#a8f0e0',   // near-white teal     — premium shine
}

export const TIER_GLOW: Record<TrophyTier, string> = {
  bronze:   'rgba(40,128,110,0.25)',
  silver:   'rgba(56,184,158,0.25)',
  gold:     'rgba(91,211,184,0.30)',
  platinum: 'rgba(168,240,224,0.30)',
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function totalKm(activities: Activity[]) {
  return activities.reduce((s, a) => s + (a.distance ?? 0), 0)
}

function longestStreak(activities: Activity[]): number {
  if (!activities.length) return 0
  const days = new Set(activities.map(a => new Date(a.started_at).toDateString()))
  const sorted = [...days].map(d => new Date(d)).sort((a, b) => a.getTime() - b.getTime())
  let best = 1, cur = 1
  for (let i = 1; i < sorted.length; i++) {
    const diff = (sorted[i].getTime() - sorted[i - 1].getTime()) / 86_400_000
    cur = diff === 1 ? cur + 1 : 1
    best = Math.max(best, cur)
  }
  return best
}

function fastestPace(activities: Activity[]): number {
  const paces = activities.map(a => a.pace ?? Infinity).filter(p => p > 0 && isFinite(p))
  return paces.length ? Math.min(...paces) : Infinity
}

/** Return the started_at of the Nth activity (1-indexed), sorted ascending. */
function dateOfNthActivity(activities: Activity[], n: number): string | undefined {
  const sorted = [...activities].sort(
    (a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
  )
  return sorted[n - 1]?.started_at
}

const clamp = (v: number, max: number) => Math.min(v / max, 1)

// ── Milestone trophy factory ───────────────────────────────────────────────────
// Extend this array to add more milestones — no other code changes needed.

const ACTIVITY_MILESTONES: {
  count: number
  id: string
  title: string
  tier: TrophyTier
}[] = [
  { count: 1,   id: 'act_1',   title: 'First Activity',    tier: 'bronze'   },
  { count: 3,   id: 'act_3',   title: 'Third Activity',    tier: 'bronze'   },
  { count: 5,   id: 'act_5',   title: 'Fifth Activity',    tier: 'bronze'   },
  { count: 10,  id: 'act_10',  title: '10th Activity',     tier: 'silver'   },
  { count: 20,  id: 'act_20',  title: '20th Activity',     tier: 'silver'   },
  { count: 30,  id: 'act_30',  title: '30th Activity',     tier: 'silver'   },
  { count: 40,  id: 'act_40',  title: '40th Activity',     tier: 'silver'   },
  { count: 50,  id: 'act_50',  title: '50th Activity',     tier: 'gold'     },
  { count: 75,  id: 'act_75',  title: '75th Activity',     tier: 'gold'     },
  { count: 100, id: 'act_100', title: '100th Activity',    tier: 'gold'     },
  { count: 150, id: 'act_150', title: '150th Activity',    tier: 'platinum' },
  { count: 200, id: 'act_200', title: '200th Activity',    tier: 'platinum' },
  { count: 365, id: 'act_365', title: '365th Activity',    tier: 'platinum' },
]

// ── Main export ────────────────────────────────────────────────────────────────

export function computeTrophies(
  activities: Activity[],
  /**
   * Pass extra trophies from external sources (events, challenges, etc.).
   * They'll be merged in and shown in the Trophy Case alongside the computed ones.
   *
   * Example — when a challenge is completed:
   *   const extra: Trophy[] = [{
   *     id: `challenge_${challenge.id}`,
   *     title: challenge.title,
   *     description: 'Challenge completed!',
   *     icon: challenge.icon,
   *     tier: 'gold',
   *     category: 'challenge',
   *     unlocked: true,
   *     unlockedAt: new Date().toISOString(),
   *   }]
   *   computeTrophies(activities, extra)
   */
  extraTrophies: Trophy[] = [],
): Trophy[] {
  const km       = totalKm(activities)
  const runs     = activities.length
  const streak   = longestStreak(activities)
  const bestPace = fastestPace(activities)

  // ── 1. Milestone (activity count) trophies ─────────────────────────────────
  const milestoneTrophies: Trophy[] = ACTIVITY_MILESTONES.map(m => ({
    id: m.id,
    title: m.title,
    description: `Complete your ${m.title.toLowerCase()}.`,
    icon: 'bolt',                 // overridden visually by badgeNumber in the card
    badgeNumber: m.count,
    tier: m.tier,
    category: 'milestone' as TrophyCategory,
    unlocked: runs >= m.count,
    unlockedAt: runs >= m.count ? dateOfNthActivity(activities, m.count) : undefined,
    progress: clamp(runs, m.count),
    progressLabel: `${Math.min(runs, m.count)} / ${m.count} runs`,
  }))

  // ── 2. Distance trophies ───────────────────────────────────────────────────
  const distanceTrophies: Trophy[] = [
    { km: 10,   id: 'dist_10',  title: 'Warming Up',    tier: 'bronze'   as TrophyTier },
    { km: 50,   id: 'dist_50',  title: 'Half Century',  tier: 'silver'   as TrophyTier },
    { km: 100,  id: 'dist_100', title: 'Century Club',  tier: 'gold'     as TrophyTier },
    { km: 500,  id: 'dist_500', title: 'Road Warrior',  tier: 'platinum' as TrophyTier },
    { km: 1000, id: 'dist_1k',  title: 'Marathoner+',   tier: 'platinum' as TrophyTier },
  ].map(d => ({
    id: d.id,
    title: d.title,
    description: `Run a total of ${d.km} km.`,
    icon: 'road',
    tier: d.tier,
    category: 'distance' as TrophyCategory,
    unlocked: km >= d.km,
    progress: clamp(km, d.km),
    progressLabel: `${km.toFixed(1)} / ${d.km} km`,
  }))

  // ── 3. Streak trophies ─────────────────────────────────────────────────────
  const streakTrophies: Trophy[] = [
    { days: 3,   id: 'streak_3',   title: 'On a Roll',    icon: 'fire',     tier: 'bronze'   as TrophyTier },
    { days: 7,   id: 'streak_7',   title: 'Week Warrior', icon: 'fire-alt', tier: 'silver'   as TrophyTier },
    { days: 30,  id: 'streak_30',  title: 'Unstoppable',  icon: 'bolt',     tier: 'gold'     as TrophyTier },
    { days: 100, id: 'streak_100', title: 'Legend',       icon: 'crown',    tier: 'platinum' as TrophyTier },
  ].map(s => ({
    id: s.id,
    title: s.title,
    description: `Achieve a ${s.days}-day running streak.`,
    icon: s.icon,
    tier: s.tier,
    category: 'streak' as TrophyCategory,
    unlocked: streak >= s.days,
    progress: clamp(streak, s.days),
    progressLabel: `${Math.min(streak, s.days)} / ${s.days} days`,
  }))

  // ── 4. Speed trophies ──────────────────────────────────────────────────────
  const speedTrophies: Trophy[] = [
    { pace: 6, id: 'pace_6', title: 'Picking Up Pace', icon: 'tachometer-alt', tier: 'bronze'   as TrophyTier },
    { pace: 5, id: 'pace_5', title: 'Speed Demon',     icon: 'wind',           tier: 'silver'   as TrophyTier },
    { pace: 4, id: 'pace_4', title: 'Rocket Legs',     icon: 'rocket',         tier: 'platinum' as TrophyTier },
  ].map(sp => ({
    id: sp.id,
    title: sp.title,
    description: `Complete a run at a pace under ${sp.pace} min/km.`,
    icon: sp.icon,
    tier: sp.tier,
    category: 'speed' as TrophyCategory,
    unlocked: bestPace < sp.pace,
    progress: bestPace === Infinity ? 0 : clamp(sp.pace - Math.min(bestPace, sp.pace), sp.pace),
    progressLabel: bestPace === Infinity ? 'No runs yet' : `Best: ${bestPace.toFixed(2)} min/km`,
  }))

  // ── 5. Consistency trophies ────────────────────────────────────────────────
  const consistencyTrophies: Trophy[] = [
    { count: 5,   id: 'runs_5',   title: 'Getting Consistent', icon: 'running',        tier: 'bronze' as TrophyTier },
    { count: 25,  id: 'runs_25',  title: 'Habit Formed',        icon: 'calendar-check', tier: 'silver' as TrophyTier },
    { count: 100, id: 'runs_100', title: 'Century Runner',       icon: 'star',           tier: 'gold'   as TrophyTier },
  ].map(c => ({
    id: c.id,
    title: c.title,
    description: `Log ${c.count} runs.`,
    icon: c.icon,
    tier: c.tier,
    category: 'consistency' as TrophyCategory,
    unlocked: runs >= c.count,
    progress: clamp(runs, c.count),
    progressLabel: `${Math.min(runs, c.count)} / ${c.count} runs`,
  }))

  return [
    ...milestoneTrophies,
    ...distanceTrophies,
    ...streakTrophies,
    ...speedTrophies,
    ...consistencyTrophies,
    ...extraTrophies,   // ← events / challenges injected here
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// HOW TO ADD EVENT / CHALLENGE TROPHIES
// ─────────────────────────────────────────────────────────────────────────────
//
// Option A — pass them via `extraTrophies` from the screen that has the data:
//
//   import { computeTrophies } from '../services/trophyDefinitions'
//
//   const eventTrophies: Trophy[] = completedChallenges.map(c => ({
//     id: `challenge_${c.id}`,
//     title: c.title,
//     description: c.description ?? 'Challenge completed!',
//     icon: c.icon,
//     tier: c.difficulty === 'hard' ? 'gold' : c.difficulty === 'medium' ? 'silver' : 'bronze',
//     category: 'challenge',
//     unlocked: true,
//     unlockedAt: c.completedAt,
//   }))
//
//   const trophies = computeTrophies(activities, eventTrophies)
//
// Option B — extend ACTIVITY_MILESTONES above (for pure run-count badges)