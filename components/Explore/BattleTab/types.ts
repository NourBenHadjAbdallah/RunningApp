// components/Explore/BattleTab/types.ts

import { ZoneLeaderboardEntry } from '../../../services/battleZoneService'

export type LbMode     = 'individual' | 'groups'
export type ModalMode  = 'closed' | 'pick' | 'create' | 'join'
export type CreateStep = 1 | 2 | 3

export interface EnrichedEntry extends ZoneLeaderboardEntry {
  avatar_url?: string | null
}

export interface GroupOption {
  id: string
  name: string
  photo_url: string | null
}