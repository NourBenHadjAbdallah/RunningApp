// screens/EditProfileScreen.tsx
//
// Edit Profile screen — matches the SettingsScreen design language.
//
// ─── Features ────────────────────────────────────────────────────────────────
//  • Inline avatar with initial or uploaded image
//  • Edit full_name, username, bio fields
//  • Real-time username availability check (debounced)
//  • Validates username format (lowercase, alphanumeric, underscores)
//  • Saves to `profiles` table in Supabase
//  • Keyboard-aware scroll so fields aren't hidden on mobile

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { router } from 'expo-router'
import { supabase } from '../services/supabase'
import { Colors } from '../constants/colors'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileDraft {
  full_name: string
  username: string
  bio: string
}

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid'

// ─── Constants ────────────────────────────────────────────────────────────────

const USERNAME_RE = /^[a-z0-9_]{3,20}$/
const DEBOUNCE_MS = 600

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EditProfileScreen() {
  const [draft, setDraft]       = useState<ProfileDraft>({ full_name: '', username: '', bio: '' })
  const [original, setOriginal] = useState<ProfileDraft>({ full_name: '', username: '', bio: '' })
  const [avatarInitial, setAvatarInitial] = useState('?')
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const myId = useRef<string | null>(null)

  // ── Load ───────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.back(); return }
      myId.current = user.id

      const { data } = await supabase
        .from('profiles')
        .select('full_name, username, bio')
        .eq('id', user.id)
        .maybeSingle()

      if (data) {
        const p: ProfileDraft = {
          full_name: data.full_name ?? '',
          username:  data.username  ?? '',
          bio:       data.bio       ?? '',
        }
        setDraft(p)
        setOriginal(p)
        setAvatarInitial(
          (data.full_name?.[0] ?? data.username?.[0] ?? '?').toUpperCase()
        )
      }
    } catch (e) {
      console.error('[EditProfile] load error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Username availability check ────────────────────────────────────────────

  useEffect(() => {
    const username = draft.username.trim().toLowerCase()

    if (username === original.username) {
      setUsernameStatus('idle')
      return
    }

    if (!USERNAME_RE.test(username)) {
      setUsernameStatus(username.length < 3 ? 'idle' : 'invalid')
      return
    }

    setUsernameStatus('checking')

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      try {
        const { count } = await supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('username', username)
          .neq('id', myId.current ?? '')

        setUsernameStatus((count ?? 0) > 0 ? 'taken' : 'available')
      } catch {
        setUsernameStatus('idle')
      }
    }, DEBOUNCE_MS)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [draft.username, original.username])

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    const username = draft.username.trim().toLowerCase()

    if (!username) {
      Alert.alert('Username required', 'Please enter a username.')
      return
    }
    if (!USERNAME_RE.test(username)) {
      Alert.alert('Invalid username', 'Use 3–20 lowercase letters, numbers, or underscores.')
      return
    }
    if (usernameStatus === 'taken') {
      Alert.alert('Username taken', 'Please choose a different username.')
      return
    }
    if (usernameStatus === 'checking') {
      Alert.alert('Please wait', 'Checking username availability…')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: draft.full_name.trim() || null,
          username,
          bio:       draft.bio.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', myId.current ?? '')

      if (error) throw error

      Alert.alert('Saved!', 'Your profile has been updated.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not save profile.')
    } finally {
      setSaving(false)
    }
  }

  // ── Dirty check ────────────────────────────────────────────────────────────

  const isDirty =
    draft.full_name !== original.full_name ||
    draft.username  !== original.username  ||
    draft.bio       !== original.bio

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn}>
          <FontAwesome5 name="arrow-left" size={16} color={Colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Edit Profile</Text>
        <TouchableOpacity
          style={[s.saveBtn, (!isDirty || saving) && s.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!isDirty || saving}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={s.saveBtnText}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Avatar */}
          <View style={s.avatarSection}>
            <View style={s.avatarWrap}>
              <View style={s.avatar}>
                <Text style={s.avatarText}>{avatarInitial}</Text>
              </View>
              {/* Placeholder for future image-upload tap */}
              <View style={s.avatarBadge}>
                <FontAwesome5 name="camera" size={11} color="#fff" />
              </View>
            </View>
            <Text style={s.avatarHint}>Avatar from your initials</Text>
          </View>

          {/* Fields */}
          <SectionLabel label="Display" />
          <View style={s.card}>
            <Field
              icon="user"
              label="Full Name"
              placeholder="Your real name (optional)"
              value={draft.full_name}
              onChangeText={(v) => setDraft((d) => ({ ...d, full_name: v }))}
              maxLength={50}
            />
            <View style={s.divider} />
            <Field
              icon="at"
              label="Username"
              placeholder="your_handle"
              value={draft.username}
              onChangeText={(v) => setDraft((d) => ({ ...d, username: v.toLowerCase() }))}
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={20}
              statusNode={<UsernameStatusBadge status={usernameStatus} />}
            />
          </View>

          <SectionLabel label="About" />
          <View style={s.card}>
            <View style={s.fieldRow}>
              <View style={[s.fieldIcon, { backgroundColor: Colors.primary + '18' }]}>
                <FontAwesome5 name="pen" size={13} color={Colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.fieldLabel}>Bio</Text>
                <TextInput
                  style={[s.fieldInput, s.bioInput]}
                  value={draft.bio}
                  onChangeText={(v) => setDraft((d) => ({ ...d, bio: v }))}
                  placeholder="A short sentence about yourself…"
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={3}
                  maxLength={160}
                  textAlignVertical="top"
                />
                <Text style={s.charCount}>{draft.bio.length} / 160</Text>
              </View>
            </View>
          </View>

          <SectionLabel label="Guidelines" />
          <View style={[s.card, s.guideCard]}>
            {[
              { icon: 'check-circle', text: '3–20 characters for username' },
              { icon: 'check-circle', text: 'Lowercase letters, numbers, underscores only' },
              { icon: 'check-circle', text: 'Full name is shown publicly on your profile' },
            ].map((g) => (
              <View key={g.text} style={s.guideRow}>
                <FontAwesome5 name={g.icon} size={12} color={Colors.primary} />
                <Text style={s.guideText}>{g.text}</Text>
              </View>
            ))}
          </View>

          <View style={{ height: 48 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return <Text style={s.sectionLabel}>{label}</Text>
}

function Field({
  icon, label, placeholder, value, onChangeText,
  autoCapitalize, autoCorrect, maxLength, statusNode,
}: {
  icon: string
  label: string
  placeholder: string
  value: string
  onChangeText: (v: string) => void
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  autoCorrect?: boolean
  maxLength?: number
  statusNode?: React.ReactNode
}) {
  return (
    <View style={s.fieldRow}>
      <View style={[s.fieldIcon, { backgroundColor: Colors.primary + '18' }]}>
        <FontAwesome5 name={icon} size={13} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={s.fieldLabelRow}>
          <Text style={s.fieldLabel}>{label}</Text>
          {statusNode}
        </View>
        <TextInput
          style={s.fieldInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.textMuted}
          autoCapitalize={autoCapitalize ?? 'words'}
          autoCorrect={autoCorrect ?? true}
          maxLength={maxLength}
          returnKeyType="done"
        />
      </View>
    </View>
  )
}

function UsernameStatusBadge({ status }: { status: UsernameStatus }) {
  if (status === 'idle') return null

  const map: Record<Exclude<UsernameStatus, 'idle'>, { icon: string; color: string; label: string }> = {
    checking:  { icon: 'spinner',      color: Colors.textMuted, label: 'Checking…' },
    available: { icon: 'check-circle', color: '#4ade80',        label: 'Available' },
    taken:     { icon: 'times-circle', color: '#f87171',        label: 'Taken'     },
    invalid:   { icon: 'exclamation-circle', color: '#fb923c', label: 'Invalid'   },
  }

  const { icon, color, label } = map[status]

  return (
    <View style={[s.badge, { backgroundColor: color + '20' }]}>
      <FontAwesome5
        name={icon}
        size={10}
        color={color}
        // Spinner doesn't animate natively; the label is enough feedback
      />
      <Text style={[s.badgeText, { color }]}>{label}</Text>
    </View>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:   { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },

  // Header
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
  headerBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.card2 ?? Colors.card,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  headerTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  saveBtn: {
    paddingHorizontal: 18, height: 36, borderRadius: 18,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    minWidth: 68,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Scroll
  scroll: { paddingTop: 8, paddingBottom: 24 },

  // Avatar
  avatarSection: { alignItems: 'center', paddingVertical: 28 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: '800' },
  avatarBadge: {
    position: 'absolute', bottom: -6, right: -6,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.primary,
    borderWidth: 2, borderColor: Colors.background,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarHint: { color: Colors.textMuted, fontSize: 12, marginTop: 14 },

  // Section label
  sectionLabel: {
    color: Colors.textMuted,
    fontSize: 11, fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingTop: 20, paddingBottom: 8,
  },

  // Card
  card: {
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: 58 },

  // Field
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  fieldIcon: {
    width: 34, height: 34, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 2,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  fieldLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '600', letterSpacing: 0.5 },
  fieldInput: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 0,
  },
  bioInput: {
    minHeight: 64,
    lineHeight: 22,
  },
  charCount: {
    color: Colors.textMuted,
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },

  // Username badge
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: { fontSize: 10, fontWeight: '600' },

  // Guidelines
  guideCard: { paddingVertical: 4 },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  guideText: { color: Colors.textMuted, fontSize: 13 },
})