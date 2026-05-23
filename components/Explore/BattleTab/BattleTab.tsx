// components/Explore/BattleTab/BattleTab.tsx

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, StyleSheet, ActivityIndicator, FlatList, RefreshControl, Alert } from 'react-native'
import { supabase } from '../../../services/supabase'
import { battleZoneService } from '../../../services/battleZoneService'
import { squadService, Squad, SquadLeaderboardEntry } from '../../../services/squadService'

import { RED } from './constants'
import { LbMode, EnrichedEntry } from './types'

import MyTerritoryCard    from './MyTerritoryCard'
import MySquadCard        from './MySquadCard'
import LeaderboardToggle  from './LeaderboardToggle'
import LeaderboardRow     from './LeaderboardRow'
import GroupLeaderboardRow from './GroupLeaderboardRow'
import EmptyLeaderboard   from './EmptyLeaderboard'
import SquadFormModal     from './SquadFormModal'

// ─── List header (module-level to keep FlatList stable) ──────────────────────

interface ListHeaderProps {
  myIndividualRank: number | null
  myZones: number
  mySquadRank: number | null
  mySquad: Squad | null
  squadZoneTotal: number
  lbMode: LbMode
  setLbMode: (m: LbMode) => void
  individualCount: number
  groupCount: number
  onOpenModal: () => void
  onLeave: () => void
}

const ListHeader = React.memo(function ListHeader(p: ListHeaderProps) {
  return (
    <>
      <MyTerritoryCard rank={p.myIndividualRank} zoneCount={p.myZones} squadRank={p.mySquadRank} />
      <MySquadCard squad={p.mySquad} zoneCount={p.squadZoneTotal} onOpenModal={p.onOpenModal} onLeave={p.onLeave} />
      <LeaderboardToggle lbMode={p.lbMode} setLbMode={p.setLbMode} individualCount={p.individualCount} groupCount={p.groupCount} />
    </>
  )
})

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function BattleTab() {
  const [myUserId,       setMyUserId]       = useState<string | null>(null)
  const [entries,        setEntries]        = useState<EnrichedEntry[]>([])
  const [myZones,        setMyZones]        = useState(0)
  const [mySquad,        setMySquad]        = useState<Squad | null>(null)
  const [squadEntries,   setSquadEntries]   = useState<SquadLeaderboardEntry[]>([])
  const [squadZoneTotal, setSquadZoneTotal] = useState(0)
  const [showModal,      setShowModal]      = useState(false)
  const [lbMode,         setLbMode]         = useState<LbMode>('individual')
  const [loading,        setLoading]        = useState(true)
  const [refreshing,     setRefreshing]     = useState(false)

  const myIndividualRank = useMemo(
    () => entries.findIndex(e => e.owner_id === myUserId) + 1 || null,
    [entries, myUserId],
  )
  const mySquadRank = useMemo(
    () => mySquad ? (squadEntries.findIndex(e => e.squad_id === mySquad.id) + 1 || null) : null,
    [squadEntries, mySquad],
  )

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const uid = user?.id ?? null
      setMyUserId(uid)

      const [lb, count, squad, groupLb] = await Promise.all([
        battleZoneService.getLeaderboard(),
        uid ? battleZoneService.myZoneCount() : Promise.resolve(0),
        uid ? squadService.mySquad()          : Promise.resolve(null),
        squadService.getGroupLeaderboard(),
      ])

      setMyZones(count)
      setSquadEntries(groupLb)
      setMySquad(prev => {
        const effective = squad ?? prev
        setSquadZoneTotal(effective ? (groupLb.find(e => e.squad_id === effective.id)?.zone_count ?? 0) : 0)
        return effective
      })

      // Enrich with avatars
      const ids = lb.map(e => e.owner_id)
      let avatarMap: Record<string, string | null> = {}
      if (ids.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, avatar_url').in('id', ids)
        ;(profiles ?? []).forEach((p: any) => { avatarMap[p.id] = p.avatar_url })
      }

      const enriched: EnrichedEntry[] = lb.map(e => ({ ...e, avatar_url: avatarMap[e.owner_id] ?? null }))

      // Append self below top-20 if absent
      if (uid && count > 0 && !enriched.find(e => e.owner_id === uid)) {
        const { data: me } = await supabase.from('profiles').select('username, full_name').eq('id', uid).maybeSingle()
        enriched.push({ owner_id: uid, owner_name: me?.full_name ?? me?.username ?? 'You', zone_count: count, avatar_url: null, delta: null })
      }

      setEntries(enriched)
    } catch (e) {
      console.warn('[BattleTab] load error:', e)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleSquadDone = useCallback(async (squad: Squad) => { setShowModal(false); setMySquad(squad); await load() }, [load])

  const handleLeave = useCallback(() => {
    Alert.alert('Leave squad', `Leave ${mySquad?.name ?? 'your squad'}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => {
        try { await squadService.leaveSquad(); setMySquad(null); setSquadZoneTotal(0); await load() }
        catch (e: any) { Alert.alert('Error', e.message) }
      }},
    ])
  }, [mySquad, load])

  const openModal  = useCallback(() => setShowModal(true),  [])
  const closeModal = useCallback(() => setShowModal(false), [])

  const listHeaderProps: ListHeaderProps = {
    myIndividualRank, myZones, mySquadRank, mySquad, squadZoneTotal,
    lbMode, setLbMode,
    individualCount: entries.length, groupCount: squadEntries.length,
    onOpenModal: openModal, onLeave: handleLeave,
  }

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={RED} /></View>

  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={RED} />
  const renderHeader   = () => <ListHeader {...listHeaderProps} />
  const footer         = <View style={{ height: 40 }} />

  return (
    <>
      {lbMode === 'individual' ? (
        <FlatList<EnrichedEntry>
          data={entries}
          keyExtractor={item => item.owner_id}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          contentContainerStyle={s.content}
          ListHeaderComponent={renderHeader}
          renderItem={({ item, index }) => <LeaderboardRow entry={item} rank={index + 1} isMe={item.owner_id === myUserId} />}
          ListEmptyComponent={<EmptyLeaderboard mode="individual" />}
          ListFooterComponent={footer}
        />
      ) : (
        <FlatList<SquadLeaderboardEntry>
          data={squadEntries}
          keyExtractor={item => item.squad_id}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
          contentContainerStyle={s.content}
          ListHeaderComponent={renderHeader}
          renderItem={({ item, index }) => <GroupLeaderboardRow entry={item} rank={index + 1} isMySquad={mySquad?.id === item.squad_id} />}
          ListEmptyComponent={<EmptyLeaderboard mode="groups" />}
          ListFooterComponent={footer}
        />
      )}
      <SquadFormModal visible={showModal} onClose={closeModal} onDone={handleSquadDone} />
    </>
  )
}

const s = StyleSheet.create({
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 4 },
})