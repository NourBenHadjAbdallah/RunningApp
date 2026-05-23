// screens/ProfileScreen.tsx
//
// Single profile screen for EVERYONE.
// - No `userId` param (or userId === current user) → own profile (self view)
// - `userId` param present and different           → other user's profile
//
// Navigate here from anywhere:
//   router.push(`/profile/${someUserId}`)   ← other user
//   router.push('/(tabs)/profile')          ← own profile via tab bar (no param)
//
// Self view shows:  settings gear, post button
// Other view shows: back button, follow/following button

import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, RefreshControl, ScrollView,
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { router, useLocalSearchParams } from 'expo-router'
import { supabase } from '../services/supabase'
import { activityService, Activity, Group } from '../services/activityService'
import { getAwardedTrophies } from '../services/trophyService'
import { Trophy } from '../services/trophyDefinitions'
import { followService } from '../services/followService'
import { Colors } from '../constants/colors'

import { ProfileHero } from '../components/Profile/ProfileHero'
import { ProfileTabBar, ProfileTab } from '../components/Profile/ProfileTabBar'
import { ActivityCard } from '../components/ActivityCard'
import { EmptyState } from '../components/Profile/EmptyState'
import { CreatePostModal } from '../components/Profile/CreatePostModal'
import { TrophySection } from '../components/Profile/TrophySection'
import { WeeklyChartCard } from '../components/Profile/WeeklyChartCard'
import { MonthlyCalendar } from '../components/Profile/MonthlyCalendar'
import { ChallengesSection } from '../components/Profile/ChallengesSection'

interface Profile {
  id?: string
  username: string
  full_name: string
  total_distance: number
  total_runs: number
  created_at?: string
  location?: string | null
  avatar_url?: string | null
}



export default function ProfileScreen() {
  const { id: userId } = useLocalSearchParams<{ id?: string }>()

  const [currentUserId,    setCurrentUserId]    = useState<string | null>(null)
  const [isSelf,           setIsSelf]           = useState(true)
  const [isFollowing,      setIsFollowing]      = useState(false)
  const [followLoading,    setFollowLoading]    = useState(false)

  const [profile,          setProfile]          = useState<Profile | null>(null)
  const [activities,       setActivities]       = useState<Activity[]>([])
  const [extraTrophies,    setExtraTrophies]    = useState<Trophy[]>([])
  const [joinedGroups,     setJoinedGroups]     = useState<Group[]>([])
  const [followersCount,   setFollowersCount]   = useState(0)
  const [followingCount,   setFollowingCount]   = useState(0)
  const [loading,          setLoading]          = useState(true)
  const [refreshing,       setRefreshing]       = useState(false)
  const [activeTab,        setActiveTab]        = useState<ProfileTab>('stats')
  const [postModalVisible, setPostModalVisible] = useState(false)

  const openSheet = (a: Activity) =>
    router.push({ pathname: '/(tabs)/activity', params: { id: a.id, source: 'profile' } })

  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const meId = user?.id ?? null
      setCurrentUserId(meId)

      const selfView = !userId || userId === meId
      const targetId = selfView ? meId : userId
      setIsSelf(selfView)

      if (!targetId) return

      if (selfView) {
        // ── Own profile ────────────────────────────────────────────────────
        const [profileData, activityData, allGroups, awarded] = await Promise.all([
          activityService.getMyProfile(),
          activityService.getMyActivities(),
          activityService.getGroups(),
          getAwardedTrophies(),
        ])

        if (profileData) setProfile(profileData)
        setActivities(activityData)
        setExtraTrophies(awarded)
        setJoinedGroups(allGroups.filter((g: Group) => g.joined))

        const [{ count: followers }, { count: following }] = await Promise.all([
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', targetId),
          supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id',  targetId),
        ])
        setFollowersCount(followers ?? 0)
        setFollowingCount(following ?? 0)

      } else {
        // ── Other user ─────────────────────────────────────────────────────
        const [profData, { data: actsData }, following, counts] = await Promise.all([
          followService.getPublicProfile(targetId),
          supabase
            .from('activities')
            .select('*')
            .eq('user_id', targetId)
            .order('created_at', { ascending: false })
            .limit(50),
          followService.isFollowing(targetId).catch(() => false),
          followService.getCounts(targetId),
        ])

        if (profData) setProfile(profData as Profile)
        setActivities((actsData as Activity[]) ?? [])
        setIsFollowing(following as boolean)
        setFollowersCount(counts.followers)
        setFollowingCount(counts.following)
        setExtraTrophies([])
        setJoinedGroups([])
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
    setRefreshing(false)
  }, [userId])

  useEffect(() => {
    fetchData()
    setActiveTab('stats')
  }, [fetchData])

  const onRefresh = () => { setRefreshing(true); fetchData() }

  const handleFollow = async () => {
    if (!userId || isSelf) return
    setFollowLoading(true)
    try {
      const next = await followService.toggle(userId, isFollowing)
      setIsFollowing(next)
      setFollowersCount(c => c + (next ? 1 : -1))
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to update follow')
    } finally {
      setFollowLoading(false)
    }
  }

  const totalRuns = activities.length

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  const StatsContent = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: 140 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
    >
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome5 name="chart-area" size={14} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Weekly Progress</Text>
        </View>
        <WeeklyChartCard activities={activities} />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <FontAwesome5 name="calendar" size={14} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Monthly Calendar</Text>
        </View>
        <MonthlyCalendar activities={activities} onDayPress={openSheet} />
      </View>

      <TrophySection activities={activities} extraTrophies={extraTrophies} />

      {isSelf && (
        <ChallengesSection activities={activities} />
      )}

      {joinedGroups.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <FontAwesome5 name="users" size={14} color={Colors.primary} />
            <Text style={styles.sectionTitle}>{isSelf ? 'My Groups' : 'Groups'}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupsScroll}>
            {joinedGroups.map(g => (
              <View key={g.id} style={styles.groupChip}>
                <Text style={styles.groupIcon}>{g.icon}</Text>
                <View>
                  <Text style={styles.groupName} numberOfLines={1}>{g.name}</Text>
                  <Text style={styles.groupMembers}>{g.member_count} members</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </ScrollView>
  )

  const RunsContent = () => (
    <FlatList
      data={activities}
      keyExtractor={item => item.id}
      renderItem={({ item }) => (
        <ActivityCard
          variant="profile"
          item={item}
          onPress={a => router.push({ pathname: '/(tabs)/activity', params: { id: a.id, source: 'profile' } })}
        />
      )}
      ListEmptyComponent={
        <EmptyState
          icon="shoe-prints"
          title="No runs yet"
          message={isSelf
            ? 'Start your first run and it will appear here!'
            : "This runner hasn't logged any activities yet."}
        />
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      contentContainerStyle={{ paddingBottom: 140, paddingTop: 8 }}
      showsVerticalScrollIndicator={false}
    />
  )

  return (
    <View style={styles.container}>
      <ProfileHero
        profile={profile}
        followersCount={followersCount}
        followingCount={followingCount}
        totalRuns={totalRuns}
        isSelf={isSelf}
        onAddPost={isSelf ? () => setPostModalVisible(true) : undefined}
        isFollowing={isFollowing}
        followLoading={followLoading}
        onFollow={!isSelf ? handleFollow : undefined}
        onBack={!isSelf ? () => router.back() : undefined}
        avatarUrl={profile?.avatar_url ?? null}
        onAvatarUpdated={(url) => setProfile(p => p ? { ...p, avatar_url: url } : p)}
      />

      <ProfileTabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        availableTabs={['stats', 'runs']}
      />

      <View style={{ flex: 1 }}>
        {activeTab === 'stats'  && <StatsContent />}
        {activeTab === 'runs'   && <RunsContent />}
      </View>

      {isSelf && (
        <CreatePostModal
          visible={postModalVisible}
          onClose={() => setPostModalVisible(false)}
          groups={joinedGroups}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  section:       { marginTop: 20 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, marginBottom: 10,
  },
  sectionTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },

  groupsScroll: { paddingHorizontal: 16, paddingVertical: 4, gap: 10 },
  groupChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.border, minWidth: 140,
  },
  groupIcon:    { fontSize: 22 },
  groupName:    { color: Colors.text, fontSize: 13, fontWeight: '700', maxWidth: 110 },
  groupMembers: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

})