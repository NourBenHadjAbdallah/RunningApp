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
import { Colors } from '../constants/colors'

interface Profile {
  username: string
  full_name: string | null
  email?: string
  created_at?: string
}

export default function SettingsScreen() {
  const [profile, setProfile]   = useState<Profile | null>(null)
  const [email, setEmail]       = useState('')
  const [loading, setLoading]   = useState(true)

  // Toggleable preferences
  const [unitKm,          setUnitKm]          = useState(true)
  const [notifyRun,       setNotifyRun]       = useState(true)
  const [notifyChallenge, setNotifyChallenge] = useState(true)
  const [notifyFollower,  setNotifyFollower]  = useState(false)

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email) setEmail(user.email)

      const { data } = await supabase
        .from('profiles')
        .select('username, full_name, created_at')
        .eq('id', user?.id ?? '')
        .maybeSingle()

      if (data) setProfile(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ])
  }

  const handleResetPassword = () => {
    if (!email) return
    Alert.alert('Reset Password', `Send a reset link to ${email}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send',
        onPress: async () => {
          const { error } = await supabase.auth.resetPasswordForEmail(email)
          if (error) Alert.alert('Error', error.message)
          else Alert.alert('Sent!', 'Check your inbox.')
        },
      },
    ])
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently removes all your data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut()
          },
        },
      ]
    )
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  const displayName = profile?.full_name ?? profile?.username ?? 'Runner'
  const joinDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <FontAwesome5 name="arrow-left" size={16} color={Colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scroll}
      >
        {/* Profile card */}
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{displayName[0]?.toUpperCase() ?? '?'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.profileName}>{displayName}</Text>
            {profile?.username && (
              <Text style={s.profileHandle}>@{profile.username}</Text>
            )}
            {email ? <Text style={s.profileEmail}>{email}</Text> : null}
            {joinDate ? (
              <Text style={s.profileJoin}>Joined {joinDate}</Text>
            ) : null}
          </View>
        </View>

        {/* Account */}
        <SectionLabel label="Account" />
        <Card>
          <Row
            icon="user-edit"
            label="Edit Profile"
            onPress={() => router.push('/edit-profile')}
          />
          <Divider />
          <Row
            icon="lock"
            label="Change Password"
            onPress={handleResetPassword}
          />
          <Divider />
          <Row
            icon="envelope"
            label={email || 'No email set'}
            chevron={false}
          />
        </Card>

        {/* Preferences */}
        <SectionLabel label="Preferences" />
        <Card>
          <ToggleRow
            icon="ruler"
            label="Distance Unit"
            sub={unitKm ? 'Kilometres' : 'Miles'}
            value={unitKm}
            onChange={setUnitKm}
          />
        </Card>

        {/* Notifications */}
        <SectionLabel label="Notifications" />
        <Card>
          <ToggleRow
            icon="bell"
            label="Run Reminders"
            sub="Daily nudges to keep moving"
            value={notifyRun}
            onChange={setNotifyRun}
          />
          <Divider />
          <ToggleRow
            icon="trophy"
            label="Challenges & Badges"
            sub="When you unlock an achievement"
            value={notifyChallenge}
            onChange={setNotifyChallenge}
          />
          <Divider />
          <ToggleRow
            icon="user-plus"
            label="New Followers"
            sub="When someone follows you"
            value={notifyFollower}
            onChange={setNotifyFollower}
          />
        </Card>

        {/* App */}
        <SectionLabel label="App" />
        <Card>
          <Row
            icon="shield-alt"
            label="Privacy Policy"
            onPress={() => Linking.openURL('https://yourapp.com/privacy')}
          />
          <Divider />
          <Row
            icon="file-alt"
            label="Terms of Service"
            onPress={() => Linking.openURL('https://yourapp.com/terms')}
          />
          <Divider />
          <Row
            icon="info-circle"
            label="Version 1.0.0"
            chevron={false}
            muted
          />
        </Card>

        {/* Danger */}
        <SectionLabel label="Danger Zone" />
        <Card>
          <Row
            icon="sign-out-alt"
            label="Log Out"
            danger
            onPress={handleLogout}
          />
          <Divider />
          <Row
            icon="user-times"
            label="Delete Account"
            sub="Permanently removes all your data"
            danger
            onPress={handleDeleteAccount}
          />
        </Card>

        <Text style={s.footer}>Made with ❤️ for runners in Tunisia 🇹🇳</Text>
        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return <Text style={s.sectionLabel}>{label}</Text>
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={s.card}>{children}</View>
}

function Divider() {
  return <View style={s.divider} />
}

function Row({
  icon, label, sub, onPress, chevron = true, danger = false, muted = false,
}: {
  icon: string
  label: string
  sub?: string
  onPress?: () => void
  chevron?: boolean
  danger?: boolean
  muted?: boolean
}) {
  const iconColor = danger ? Colors.danger : Colors.primary

  return (
    <TouchableOpacity
      style={s.row}
      onPress={onPress}
      activeOpacity={onPress ? 0.6 : 1}
      disabled={!onPress}
    >
      <View style={[s.rowIcon, { backgroundColor: iconColor + '18' }]}>
        <FontAwesome5 name={icon} size={14} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.rowLabel, danger && { color: Colors.danger }, muted && { color: Colors.textMuted }]}>
          {label}
        </Text>
        {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
      </View>
      {chevron && onPress ? (
        <FontAwesome5 name="chevron-right" size={11} color={Colors.textMuted} />
      ) : null}
    </TouchableOpacity>
  )
}

function ToggleRow({
  icon, label, sub, value, onChange,
}: {
  icon: string
  label: string
  sub?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <View style={s.row}>
      <View style={[s.rowIcon, { backgroundColor: Colors.primary + '18' }]}>
        <FontAwesome5 name={icon} size={14} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowLabel}>{label}</Text>
        {sub ? <Text style={s.rowSub}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.primary + '80' }}
        thumbColor={value ? Colors.primary : Colors.textMuted}
        ios_backgroundColor={Colors.border}
      />
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 56 : 36,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.card2,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  headerTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' },

  scroll: { paddingTop: 8, paddingBottom: 24 },

  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 4,
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatar: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText:    { color: '#fff', fontSize: 22, fontWeight: '800' },
  profileName:   { color: Colors.text, fontSize: 16, fontWeight: '700' },
  profileHandle: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },
  profileEmail:  { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  profileJoin:   { color: Colors.textMuted, fontSize: 11, marginTop: 4 },

  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 11, fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingTop: 20, paddingBottom: 8,
  },

  card: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },

  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 58 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
    minHeight: 52,
  },
  rowIcon: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  rowLabel: { color: Colors.text, fontSize: 15, fontWeight: '500' },
  rowSub:   { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  footer: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 28,
  },
})