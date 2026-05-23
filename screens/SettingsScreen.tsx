// screens/SettingsScreen.tsx
import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { router } from 'expo-router'
import { supabase } from '../services/supabase'
import { activityService, Activity } from '../services/activityService'
import { formatPace } from '../utils/calculations'
import { Colors } from '../constants/colors'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Profile {
  username: string
  full_name: string
  total_distance: number
  total_runs: number
  created_at?: string
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>
}

interface RowProps {
  icon: string
  iconColor?: string
  label: string
  sublabel?: string
  onPress?: () => void
  rightElement?: React.ReactNode
  destructive?: boolean
  showChevron?: boolean
}

function SettingsRow({
  icon,
  iconColor,
  label,
  sublabel,
  onPress,
  rightElement,
  destructive = false,
  showChevron = true,
}: RowProps) {
  const color = destructive ? Colors.danger : (iconColor ?? Colors.primary)

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.65 : 1}
      disabled={!onPress && !rightElement}
    >
      <View style={[styles.rowIconWrap, { backgroundColor: color + '20' }]}>
        <FontAwesome5 name={icon} size={14} color={color} solid />
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>
          {label}
        </Text>
        {sublabel ? <Text style={styles.rowSublabel}>{sublabel}</Text> : null}
      </View>
      {rightElement ?? (showChevron && onPress
        ? <FontAwesome5 name="chevron-right" size={11} color={Colors.textMuted} />
        : null
      )}
    </TouchableOpacity>
  )
}

function Separator() {
  return <View style={styles.separator} />
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const [profile,        setProfile]        = useState<Profile | null>(null)
  const [activities,     setActivities]     = useState<Activity[]>([])
  const [email,          setEmail]          = useState<string>('')
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [loading,        setLoading]        = useState(true)

  // Preferences (local — wire to AsyncStorage/Supabase prefs table as needed)
  const [unitKm,          setUnitKm]          = useState(true)
  const [notifyRun,       setNotifyRun]       = useState(true)
  const [notifyChallenge, setNotifyChallenge] = useState(true)
  const [notifyFollower,  setNotifyFollower]  = useState(true)

  // ── Exact same fetchData pattern as ProfileScreen ─────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) setEmail(user.email)

      const [profileData, activityData] = await Promise.all([
        activityService.getMyProfile(),
        activityService.getMyActivities(),
      ])

      if (profileData) setProfile(profileData)
      setActivities(activityData)

      if (user?.id) {
        const [{ count: followers }, { count: following }] = await Promise.all([
          supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', user.id),
          supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', user.id),
        ])
        setFollowersCount(followers ?? 0)
        setFollowingCount(following ?? 0)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [])

  // ── Derived stats — same calculations as ProfileScreen ────────────────────
  const totalDistance = activities.reduce((sum, a) => sum + (a.distance ?? 0), 0)
  const totalRuns     = activities.length
  const totalCalories = activities.reduce((sum, a) => sum + (a.calories ?? 0), 0)
  const bestRun       = activities.length > 0 ? Math.max(...activities.map(a => a.distance)) : 0
  const avgPace       = activities.length > 0
    ? activities.reduce((sum, a) => sum + (a.pace ?? 0), 0) / activities.length
    : 0

  const joinDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', {
        month: 'long', year: 'numeric',
      })
    : null

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ])
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Are you absolutely sure?',
              'All your runs, routes, and profile data will be lost forever.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete Everything',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      // Wire to an Edge Function / RPC for hard-delete in prod
                      await supabase.auth.signOut()
                    } catch (e: any) {
                      Alert.alert('Error', e.message)
                    }
                  },
                },
              ]
            ),
        },
      ]
    )
  }

  const handleResetPassword = () => {
    Alert.alert(
      'Reset Password',
      `A password-reset email will be sent to ${email}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Email',
          onPress: async () => {
            try {
              const { error } = await supabase.auth.resetPasswordForEmail(email)
              if (error) throw error
              Alert.alert('Email sent!', 'Check your inbox to reset your password.')
            } catch (e: any) {
              Alert.alert('Error', e.message)
            }
          },
        },
      ]
    )
  }

  const openLink = (url: string) =>
    Linking.openURL(url).catch(() => Alert.alert('Could not open link', url))

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  const initials =
    profile?.full_name?.[0]?.toUpperCase() ??
    profile?.username?.[0]?.toUpperCase() ??
    '?'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <FontAwesome5 name="chevron-left" size={15} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── Profile card ── */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.full_name ?? 'Runner'}</Text>
            <Text style={styles.profileUsername}>@{profile?.username ?? ''}</Text>
            {email ? <Text style={styles.profileEmail}>{email}</Text> : null}
            {joinDate ? (
              <View style={styles.metaRow}>
                <FontAwesome5 name="calendar-alt" size={10} color={Colors.textMuted} />
                <Text style={styles.metaText}>Joined {joinDate}</Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() =>
              Alert.alert('Coming soon', 'Edit profile will be available in the next update.')
            }
          >
            <FontAwesome5 name="pen" size={13} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        {/* ── Follow counts — mirrors ProfileScreen.followRow ── */}
        <View style={styles.followRow}>
          <View style={styles.followItem}>
            <Text style={styles.followCount}>{followersCount}</Text>
            <Text style={styles.followLabel}>Followers</Text>
          </View>
          <View style={styles.followDivider} />
          <View style={styles.followItem}>
            <Text style={styles.followCount}>{followingCount}</Text>
            <Text style={styles.followLabel}>Following</Text>
          </View>
        </View>

        {/* ── Primary stats — mirrors ProfileScreen.statsCard ── */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <FontAwesome5 name="road" size={15} color={Colors.primary} />
            <Text style={styles.statValue}>{totalDistance.toFixed(1)}</Text>
            <Text style={styles.statLabel}>Total km</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <FontAwesome5 name="flag-checkered" size={15} color={Colors.primary} />
            <Text style={styles.statValue}>{totalRuns}</Text>
            <Text style={styles.statLabel}>Runs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <FontAwesome5 name="fire" size={15} color={Colors.primary} />
            <Text style={styles.statValue}>{totalCalories.toLocaleString()}</Text>
            <Text style={styles.statLabel}>kcal</Text>
          </View>
        </View>

        {/* ── Secondary stats — mirrors ProfileScreen.secondaryRow ── */}
        <View style={styles.secondaryRow}>
          <View style={styles.secondaryCard}>
            <FontAwesome5 name="trophy" size={13} color={Colors.primary} style={styles.secIcon} />
            <Text style={styles.secondaryValue}>{bestRun.toFixed(2)} km</Text>
            <Text style={styles.secondaryLabel}>Best run</Text>
          </View>
          <View style={styles.secondaryCard}>
            <FontAwesome5 name="tachometer-alt" size={13} color={Colors.primary} style={styles.secIcon} />
            <Text style={styles.secondaryValue}>{formatPace(avgPace)}</Text>
            <Text style={styles.secondaryLabel}>Avg pace</Text>
          </View>
          <View style={styles.secondaryCard}>
            <FontAwesome5 name="chart-line" size={13} color={Colors.primary} style={styles.secIcon} />
            <Text style={styles.secondaryValue}>
              {totalRuns ? (totalDistance / totalRuns).toFixed(1) : '0.0'} km
            </Text>
            <Text style={styles.secondaryLabel}>Avg run</Text>
          </View>
        </View>

        {/* ─────────── ACCOUNT ─────────── */}
        <SectionHeader title="Account" />
        <View style={styles.card}>
          <SettingsRow
            icon="user-edit"
            label="Edit Profile"
            sublabel="Name, username"
            onPress={() =>
              Alert.alert('Coming soon', 'Edit profile will be available in the next update.')
            }
          />
          <Separator />
          <SettingsRow
            icon="lock"
            label="Change Password"
            sublabel="Update your login credentials"
            onPress={handleResetPassword}
          />
          <Separator />
          <SettingsRow
            icon="envelope"
            label="Email Address"
            sublabel={email || 'Not set'}
            showChevron={false}
          />
        </View>

        {/* ─────────── PREFERENCES ─────────── */}
        <SectionHeader title="Preferences" />
        <View style={styles.card}>
          <SettingsRow
            icon="ruler"
            iconColor="#6c63ff"
            label="Distance Unit"
            sublabel={unitKm ? 'Kilometres (km)' : 'Miles (mi)'}
            showChevron={false}
            rightElement={
              <Switch
                value={unitKm}
                onValueChange={setUnitKm}
                trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
                thumbColor={unitKm ? Colors.primary : Colors.textMuted}
                ios_backgroundColor={Colors.border}
              />
            }
          />
        </View>

        {/* ─────────── NOTIFICATIONS ─────────── */}
        <SectionHeader title="Notifications" />
        <View style={styles.card}>
          <SettingsRow
            icon="bell"
            iconColor="#f59e0b"
            label="Run Reminders"
            sublabel="Daily nudge to stay on track"
            showChevron={false}
            rightElement={
              <Switch
                value={notifyRun}
                onValueChange={setNotifyRun}
                trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
                thumbColor={notifyRun ? Colors.primary : Colors.textMuted}
                ios_backgroundColor={Colors.border}
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="trophy"
            iconColor="#10b981"
            label="Challenges & Badges"
            sublabel="When you unlock an achievement"
            showChevron={false}
            rightElement={
              <Switch
                value={notifyChallenge}
                onValueChange={setNotifyChallenge}
                trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
                thumbColor={notifyChallenge ? Colors.primary : Colors.textMuted}
                ios_backgroundColor={Colors.border}
              />
            }
          />
          <Separator />
          <SettingsRow
            icon="user-friends"
            iconColor="#3b82f6"
            label="New Followers"
            sublabel="When someone follows you"
            showChevron={false}
            rightElement={
              <Switch
                value={notifyFollower}
                onValueChange={setNotifyFollower}
                trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
                thumbColor={notifyFollower ? Colors.primary : Colors.textMuted}
                ios_backgroundColor={Colors.border}
              />
            }
          />
        </View>

        {/* ─────────── APP ─────────── */}
        <SectionHeader title="App" />
        <View style={styles.card}>
          <SettingsRow
            icon="star"
            iconColor="#f59e0b"
            label="Rate the App"
            sublabel="Enjoying the app? Leave a review"
            onPress={() =>
              Alert.alert('Rate us!', 'This will open the App Store in a real build.')
            }
          />
          <Separator />
          <SettingsRow
            icon="shield-alt"
            iconColor="#6c63ff"
            label="Privacy Policy"
            onPress={() => openLink('https://yourapp.com/privacy')}
          />
          <Separator />
          <SettingsRow
            icon="file-alt"
            iconColor={Colors.textMuted}
            label="Terms of Service"
            onPress={() => openLink('https://yourapp.com/terms')}
          />
          <Separator />
          <SettingsRow
            icon="info-circle"
            iconColor={Colors.textMuted}
            label="About"
            sublabel="Version 1.0.0"
            showChevron={false}
          />
        </View>

        {/* ─────────── DANGER ZONE ─────────── */}
        <SectionHeader title="Danger Zone" />
        <View style={styles.card}>
          <SettingsRow
            icon="sign-out-alt"
            label="Log Out"
            destructive
            onPress={handleLogout}
          />
          <Separator />
          <SettingsRow
            icon="user-times"
            label="Delete Account"
            sublabel="Permanently remove all your data"
            destructive
            onPress={handleDeleteAccount}
          />
        </View>

        <Text style={styles.footer}>Made with ❤️ for runners in Tunisia 🇹🇳</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.background,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  headerTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' },

  scrollContent: { paddingBottom: 60 },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.background,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  avatarText: { color: '#fff', fontSize: 26, fontWeight: '800' },
  profileInfo: { flex: 1 },
  profileName:     { color: Colors.text, fontSize: 17, fontWeight: '700' },
  profileUsername: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },
  profileEmail:    { color: Colors.textMuted, fontSize: 12, marginTop: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  metaText: { color: Colors.textMuted, fontSize: 11 },
  editBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary + '18',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.primary + '40',
  },

  // Follow row — same as ProfileScreen
  followRow: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 10,
  },
  followItem:    { flex: 1, alignItems: 'center' },
  followCount:   { color: Colors.primary, fontSize: 22, fontWeight: '800' },
  followLabel:   { color: Colors.textMuted, fontSize: 12, marginTop: 3 },
  followDivider: { width: 1, backgroundColor: Colors.border },

  // Stats card — same as ProfileScreen
  statsCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card, borderRadius: 16,
    paddingVertical: 18,
    marginHorizontal: 16, marginTop: 10,
    borderWidth: 1, borderColor: Colors.border,
  },
  statItem:    { flex: 1, alignItems: 'center', gap: 6 },
  statValue:   { color: Colors.primary, fontSize: 22, fontWeight: '800' },
  statLabel:   { color: Colors.textMuted, fontSize: 12 },
  statDivider: { width: 1, backgroundColor: Colors.border },

  // Secondary row — same as ProfileScreen
  secondaryRow: {
    flexDirection: 'row', gap: 10,
    marginHorizontal: 16, marginTop: 10,
  },
  secondaryCard: {
    flex: 1, alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: 14,
    paddingVertical: 14, borderWidth: 1, borderColor: Colors.border,
  },
  secIcon:        { marginBottom: 6 },
  secondaryValue: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  secondaryLabel: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  // Section header
  sectionHeader: {
    color: Colors.textMuted,
    fontSize: 11, fontWeight: '700',
    letterSpacing: 1.1, textTransform: 'uppercase',
    paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8,
  },

  // Settings card
  card: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },

  // Row
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    gap: 14, minHeight: 58,
  },
  rowIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: Colors.primary + '20',
    justifyContent: 'center', alignItems: 'center',
  },
  rowText: { flex: 1 },
  rowLabel: { color: Colors.text, fontSize: 15, fontWeight: '500' },
  rowLabelDestructive: { color: Colors.danger },
  rowSublabel: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  separator: {
    height: 1, backgroundColor: Colors.border, marginLeft: 66,
  },

  footer: {
    textAlign: 'center', color: Colors.textMuted,
    fontSize: 12, marginTop: 32, marginBottom: 8,
  },
})