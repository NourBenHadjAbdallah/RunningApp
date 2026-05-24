// screens/AuthScreen.tsx
// Secure auth with:
//  - Google / Apple / Facebook OAuth (via Supabase)
//  - Email + password (with strength meter)
//  - Username login via RPC
//  - Full sign-up form (name, username, DOB, sex, phone)

import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView,
} from 'react-native'
import { FontAwesome5, Ionicons } from '@expo/vector-icons'
import * as WebBrowser from 'expo-web-browser'
import { makeRedirectUri } from 'expo-auth-session'
import { supabase } from '../services/supabase'
import { Colors } from '../constants/colors'

WebBrowser.maybeCompleteAuthSession()

// ─── Constants ────────────────────────────────────────────────────────────────

const SEX_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say']
const DAYS   = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))
const MONTHS = [
  { label: 'January',   value: '01' }, { label: 'February',  value: '02' },
  { label: 'March',     value: '03' }, { label: 'April',     value: '04' },
  { label: 'May',       value: '05' }, { label: 'June',      value: '06' },
  { label: 'July',      value: '07' }, { label: 'August',    value: '08' },
  { label: 'September', value: '09' }, { label: 'October',   value: '10' },
  { label: 'November',  value: '11' }, { label: 'December',  value: '12' },
]
const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 100 }, (_, i) => String(currentYear - 13 - i))

type PickerField = 'day' | 'month' | 'year' | null

// ─── Password strength ────────────────────────────────────────────────────────

interface StrengthResult {
  score: number
  label: string
  color: string
  checks: { label: string; pass: boolean }[]
}

function getPasswordStrength(pw: string): StrengthResult {
  const checks = [
    { label: 'At least 8 characters',    pass: pw.length >= 8 },
    { label: 'Uppercase letter (A-Z)',    pass: /[A-Z]/.test(pw) },
    { label: 'Lowercase letter (a-z)',    pass: /[a-z]/.test(pw) },
    { label: 'Number (0-9)',              pass: /[0-9]/.test(pw) },
    { label: 'Special character (!@#$…)', pass: /[^A-Za-z0-9]/.test(pw) },
  ]
  const score = checks.filter(c => c.pass).length
  const levels = [
    { label: 'Very weak', color: '#ef4444' },
    { label: 'Weak',      color: '#f97316' },
    { label: 'Fair',      color: '#eab308' },
    { label: 'Good',      color: '#22c55e' },
    { label: 'Strong',    color: '#16a34a' },
  ]
  return { score, checks, ...levels[Math.min(score, 4)] }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const InputRow = ({
  icon, placeholder, value, onChangeText,
  keyboardType, secureTextEntry, rightElement, autoCapitalize,
}: any) => (
  <View style={styles.inputRow}>
    <FontAwesome5 name={icon} size={14} color={Colors.textDim} style={styles.inputIcon} />
    <TextInput
      style={styles.input}
      placeholder={placeholder}
      placeholderTextColor={Colors.textDim}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize ?? 'none'}
      autoCorrect={false}
      spellCheck={false}
    />
    {rightElement}
  </View>
)

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View style={styles.fieldWrap}>
    <Text style={styles.label}>{label}</Text>
    {children}
  </View>
)

// ─── Helper: ensure a profiles row exists for an OAuth user ───────────────────
//
// The Supabase trigger (fix_oauth_profiles_trigger.sql) handles this
// automatically for new signups. This function is a client-side safety net
// for users who signed up before the trigger existed, or in case the trigger
// races with the session being established.

async function ensureOAuthProfile(userId: string, email: string | undefined, meta: any) {
  // Check if a profile already exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (existing) return // already has a profile, nothing to do

  // Build a username from whatever the provider gave us
  const rawUsername =
    meta?.user_name ??
    meta?.preferred_username ??
    (email ? email.split('@')[0] : 'user')

  const baseUsername = rawUsername.toLowerCase().replace(/[^a-z0-9_]/g, '_')

  // Check uniqueness and add suffix if needed
  const { data: taken } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', baseUsername)
    .maybeSingle()

  const username = taken
    ? `${baseUsername}_${Math.random().toString(36).slice(2, 6)}`
    : baseUsername

  await supabase.from('profiles').insert({
    id: userId,
    email: email ?? null,
    username,
    full_name: meta?.full_name ?? meta?.name ?? username,
    total_distance: 0,
    total_runs: 0,
  })
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AuthScreen() {
  const [isLogin, setIsLogin]           = useState(true)
  const [loading, setLoading]           = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'apple' | 'facebook' | null>(null)
  const [showPass, setShowPass]         = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)

  // Login fields
  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [loginPassword,   setLoginPassword]   = useState('')

  // Sign-up fields
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [dobDay,   setDobDay]   = useState('')
  const [dobMonth, setDobMonth] = useState('')
  const [dobYear,  setDobYear]  = useState('')
  const [openPicker, setOpenPicker]     = useState<PickerField>(null)
  const [phone, setPhone]               = useState('')
  const [sex,   setSex]                 = useState('')
  const [showSexPicker, setShowSexPicker] = useState(false)

  const strength       = getPasswordStrength(password)
  const passwordsMatch = confirm.length === 0 || password === confirm

  // ── Helpers ────────────────────────────────────────────────────────────────

  const togglePicker = (field: PickerField) =>
    setOpenPicker(prev => (prev === field ? null : field))

  const dobDisplay = () => {
    if (!dobDay && !dobMonth && !dobYear) return 'DD / MM / YYYY'
    const m = MONTHS.find(mo => mo.value === dobMonth)?.label.slice(0, 3) ?? dobMonth
    return `${dobDay || 'DD'} / ${m || 'MM'} / ${dobYear || 'YYYY'}`
  }

  const buildDob = (): string | null => {
    if (!dobDay || !dobMonth || !dobYear) return null
    return `${dobYear}-${dobMonth}-${dobDay}`
  }

  const resolveEmail = async (identifier: string): Promise<string | null> => {
    if (identifier.includes('@')) return identifier.trim().toLowerCase()
 
    const { data, error } = await supabase.rpc('get_email_by_username', {
      p_username: identifier.toLowerCase().trim(),
    })
 
    if (error || !data) return null
    return data as string
  }

  // ── OAuth ──────────────────────────────────────────────────────────────────

  const handleOAuth = async (provider: 'google' | 'apple' | 'facebook') => {
    setOauthLoading(provider)
    try {
      const redirectTo = makeRedirectUri({ scheme: 'runningapp', path: 'auth/callback' })

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      })

      if (error) throw error
      if (!data?.url) throw new Error('No OAuth URL returned')

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url)
        const accessToken  = url.searchParams.get('access_token')
          ?? new URLSearchParams(url.hash.slice(1)).get('access_token')
        const refreshToken = url.searchParams.get('refresh_token')
          ?? new URLSearchParams(url.hash.slice(1)).get('refresh_token')

        if (accessToken && refreshToken) {
          const { data: sessionData, error: sessionError } =
            await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })

          if (sessionError) throw sessionError

          // FIX: After OAuth session is established, ensure the user has a
          // profiles row. The DB trigger handles new signups automatically,
          // but we also do it here as a client-side safety net for existing
          // OAuth users who were created before the trigger was in place.
          if (sessionData?.user) {
            await ensureOAuthProfile(
              sessionData.user.id,
              sessionData.user.email,
              sessionData.user.user_metadata,
            )
          }
        }
      }
    } catch (e: any) {
      Alert.alert('Login failed', e.message ?? 'Could not complete sign-in')
    }
    setOauthLoading(null)
  }

  // ── Email login ────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    if (!loginIdentifier.trim() || !loginPassword) {
      return Alert.alert('Missing fields', 'Please enter your email/username and password.')
    }
    setLoading(true)
    try {
      const resolvedEmail = await resolveEmail(loginIdentifier)
      if (!resolvedEmail) {
        Alert.alert('Not found', 'No account found with that email or username.')
        setLoading(false)
        return
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password: loginPassword,
      })
      if (error) Alert.alert('Login failed', error.message)
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  // ── Sign up ────────────────────────────────────────────────────────────────

  const handleSignUp = async () => {
    if (!email.trim() || !password || !username.trim() || !fullName.trim()) {
      return Alert.alert('Missing fields', 'Please fill in all required fields.')
    }
    if (strength.score < 3) {
      return Alert.alert('Weak password', 'Please choose a stronger password (at least "Good").')
    }
    if (password !== confirm) {
      return Alert.alert('Password mismatch', 'Passwords do not match.')
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
      if (error) {
        Alert.alert('Sign-up failed', error.message)
      } else if (data.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          email: email.toLowerCase().trim(),
          username: username.toLowerCase().replace(/\s/g, '_'),
          full_name: fullName.trim(),
          date_of_birth: buildDob(),
          sex: sex || null,
          phone: phone || null,
          total_distance: 0,
          total_runs: 0,
        })
        if (profileError) Alert.alert('Profile error', profileError.message)
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.')
    }
    setLoading(false)
  }

  // ── Inline picker ──────────────────────────────────────────────────────────

  const InlinePicker = ({ field, items, selected, onSelect, labelKey, valueKey }: {
    field: PickerField; items: any[]; selected: string
    onSelect: (v: string) => void; labelKey?: string; valueKey?: string
  }) =>
    openPicker === field ? (
      <ScrollView style={styles.dropdownScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {items.map((item, idx) => {
          const val = valueKey ? item[valueKey] : item
          const lbl = labelKey ? item[labelKey] : item
          const active = selected === val
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.dropdownOption, active && styles.dropdownOptionActive]}
              onPress={() => { onSelect(val); setOpenPicker(null) }}
            >
              <Text style={[styles.dropdownOptionText, active && styles.dropdownOptionTextActive]}>{lbl}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    ) : null

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <FontAwesome5 name="running" size={36} color="#fff" />
          </View>
          <Text style={styles.appName}>Running App</Text>
          <Text style={styles.tagline}>Track every stride</Text>
        </View>

        {/* Tab toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleTab, isLogin && styles.toggleTabActive]}
            onPress={() => setIsLogin(true)}
          >
            <Text style={[styles.toggleTabText, isLogin && styles.toggleTabTextActive]}>Log In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleTab, !isLogin && styles.toggleTabActive]}
            onPress={() => setIsLogin(false)}
          >
            <Text style={[styles.toggleTabText, !isLogin && styles.toggleTabTextActive]}>Sign Up</Text>
          </TouchableOpacity>
        </View>

        {/* Social OAuth buttons */}
        <View style={styles.socialRow}>
          <TouchableOpacity
            style={[styles.socialBtn, styles.socialBtnGoogle]}
            onPress={() => handleOAuth('google')}
            disabled={!!oauthLoading}
            activeOpacity={0.82}
          >
            {oauthLoading === 'google'
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <FontAwesome5 name="google" size={16} color="#fff" />
                  <Text style={styles.socialBtnText}>Google</Text>
                </>
            }
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.socialBtn, styles.socialBtnApple]}
              onPress={() => handleOAuth('apple')}
              disabled={!!oauthLoading}
              activeOpacity={0.82}
            >
              {oauthLoading === 'apple'
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <FontAwesome5 name="apple" size={16} color="#fff" />
                    <Text style={styles.socialBtnText}>Apple</Text>
                  </>
              }
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.socialBtn, styles.socialBtnFacebook]}
            onPress={() => handleOAuth('facebook')}
            disabled={!!oauthLoading}
            activeOpacity={0.82}
          >
            {oauthLoading === 'facebook'
              ? <ActivityIndicator color="#fff" size="small" />
              : <>
                  <FontAwesome5 name="facebook" size={16} color="#fff" />
                  <Text style={styles.socialBtnText}>Facebook</Text>
                </>
            }
          </TouchableOpacity>
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with email</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Form card */}
        <View style={styles.card}>

          {isLogin ? (
            <>
              <Field label="Email or Username">
                <InputRow
                  icon="user"
                  placeholder="email@example.com or @username"
                  value={loginIdentifier}
                  onChangeText={setLoginIdentifier}
                />
              </Field>

              <Field label="Password">
                <InputRow
                  icon="lock"
                  placeholder="Your password"
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  secureTextEntry={!showPass}
                  rightElement={
                    <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(v => !v)}>
                      <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textDim} />
                    </TouchableOpacity>
                  }
                />
              </Field>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <View style={styles.btnInner}>
                      <FontAwesome5 name="sign-in-alt" size={15} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.buttonText}>Log In</Text>
                    </View>
                }
              </TouchableOpacity>
            </>

          ) : (
            <>
              <View style={styles.requiredNote}>
                <FontAwesome5 name="info-circle" size={12} color={Colors.textMuted} style={{ marginRight: 6 }} />
                <Text style={styles.requiredNoteText}>* Required fields</Text>
              </View>

              <Field label="Full Name *">
                <InputRow icon="id-card" placeholder="Your full name" value={fullName}
                  onChangeText={setFullName} autoCapitalize="words" />
              </Field>

              <Field label="Username *">
                <InputRow icon="at" placeholder="your_username" value={username}
                  onChangeText={setUsername} />
              </Field>

              <Field label="Email *">
                <InputRow icon="envelope" placeholder="email@example.com" value={email}
                  onChangeText={setEmail} keyboardType="email-address" />
              </Field>

              <Field label="Password *">
                <InputRow
                  icon="lock"
                  placeholder="Create a strong password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  rightElement={
                    <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(v => !v)}>
                      <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textDim} />
                    </TouchableOpacity>
                  }
                />
                {password.length > 0 && (
                  <View style={styles.strengthWrap}>
                    <View style={styles.strengthBarRow}>
                      {[0, 1, 2, 3, 4].map(i => (
                        <View
                          key={i}
                          style={[
                            styles.strengthSegment,
                            i < strength.score && { backgroundColor: strength.color },
                          ]}
                        />
                      ))}
                    </View>
                    <Text style={[styles.strengthLabel, { color: strength.color }]}>
                      {strength.label}
                    </Text>
                    <View style={styles.checkList}>
                      {strength.checks.map((c, i) => (
                        <View key={i} style={styles.checkRow}>
                          <FontAwesome5
                            name={c.pass ? 'check-circle' : 'times-circle'}
                            size={11}
                            color={c.pass ? '#22c55e' : Colors.textMuted}
                            solid
                          />
                          <Text style={[styles.checkText, c.pass && styles.checkTextPass]}>
                            {c.label}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </Field>

              <Field label="Confirm Password *">
                <InputRow
                  icon="lock"
                  placeholder="Repeat your password"
                  value={confirm}
                  onChangeText={setConfirm}
                  secureTextEntry={!showConfirm}
                  rightElement={
                    <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(v => !v)}>
                      <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.textDim} />
                    </TouchableOpacity>
                  }
                />
                {confirm.length > 0 && !passwordsMatch && (
                  <Text style={styles.matchError}>Passwords do not match</Text>
                )}
                {confirm.length > 0 && passwordsMatch && (
                  <View style={styles.matchOk}>
                    <FontAwesome5 name="check-circle" size={11} color="#22c55e" solid />
                    <Text style={styles.matchOkText}>Passwords match</Text>
                  </View>
                )}
              </Field>

              {/* Date of birth */}
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Date of Birth</Text>
                <TouchableOpacity
                  style={styles.dobSummaryRow}
                  onPress={() => togglePicker(openPicker ? null : 'day')}
                >
                  <FontAwesome5 name="birthday-cake" size={13} color={Colors.textDim} style={{ marginRight: 10 }} />
                  <Text style={styles.dobSummaryText}>{dobDisplay()}</Text>
                  <Ionicons name={openPicker !== null ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textDim} />
                </TouchableOpacity>
                {openPicker !== null && (
                  <View style={styles.dobPickerRow}>
                    <View style={styles.dobPickerCol}>
                      <TouchableOpacity
                        style={[styles.dobSegmentBtn, openPicker === 'day' && styles.dobSegmentBtnActive]}
                        onPress={() => togglePicker('day')}
                      >
                        <Text style={[styles.dobSegmentLabel, openPicker === 'day' && styles.dobSegmentLabelActive]}>
                          {dobDay || 'Day'}
                        </Text>
                      </TouchableOpacity>
                      <InlinePicker field="day" items={DAYS} selected={dobDay} onSelect={setDobDay} />
                    </View>
                    <View style={styles.dobPickerCol}>
                      <TouchableOpacity
                        style={[styles.dobSegmentBtn, openPicker === 'month' && styles.dobSegmentBtnActive]}
                        onPress={() => togglePicker('month')}
                      >
                        <Text style={[styles.dobSegmentLabel, openPicker === 'month' && styles.dobSegmentLabelActive]}>
                          {dobMonth ? MONTHS.find(m => m.value === dobMonth)?.label.slice(0, 3) : 'Month'}
                        </Text>
                      </TouchableOpacity>
                      <InlinePicker field="month" items={MONTHS} selected={dobMonth} onSelect={setDobMonth} labelKey="label" valueKey="value" />
                    </View>
                    <View style={styles.dobPickerCol}>
                      <TouchableOpacity
                        style={[styles.dobSegmentBtn, openPicker === 'year' && styles.dobSegmentBtnActive]}
                        onPress={() => togglePicker('year')}
                      >
                        <Text style={[styles.dobSegmentLabel, openPicker === 'year' && styles.dobSegmentLabelActive]}>
                          {dobYear || 'Year'}
                        </Text>
                      </TouchableOpacity>
                      <InlinePicker field="year" items={YEARS} selected={dobYear} onSelect={setDobYear} />
                    </View>
                  </View>
                )}
              </View>

              {/* Sex */}
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Sex</Text>
                <TouchableOpacity
                  style={[styles.inputRow, styles.selectRow]}
                  onPress={() => setShowSexPicker(!showSexPicker)}
                >
                  <FontAwesome5 name="venus-mars" size={13} color={Colors.textDim} style={styles.inputIcon} />
                  <Text style={[styles.input, { flex: 1, paddingVertical: 14 }, !sex && { color: Colors.textDim }]}>
                    {sex || 'Select'}
                  </Text>
                  <Ionicons name={showSexPicker ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textDim} style={{ marginRight: 4 }} />
                </TouchableOpacity>
                {showSexPicker && (
                  <View style={styles.sexDropdown}>
                    {SEX_OPTIONS.map(opt => (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.sexOption, sex === opt && styles.sexOptionActive]}
                        onPress={() => { setSex(opt); setShowSexPicker(false) }}
                      >
                        <Text style={[styles.sexOptionText, sex === opt && styles.sexOptionTextActive]}>{opt}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <Field label="Phone Number">
                <InputRow icon="phone" placeholder="+216 XX XXX XXX" value={phone}
                  onChangeText={setPhone} keyboardType="phone-pad" />
              </Field>

              <TouchableOpacity
                style={[styles.button, (loading || strength.score < 3 || !passwordsMatch) && styles.buttonDisabled]}
                onPress={handleSignUp}
                disabled={loading || strength.score < 3 || !passwordsMatch}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <View style={styles.btnInner}>
                      <FontAwesome5 name="user-plus" size={15} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.buttonText}>Create Account</Text>
                    </View>
                }
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 40 },

  header: { alignItems: 'center', marginBottom: 28 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 16, elevation: 10,
  },
  appName: { fontSize: 34, fontWeight: '800', color: Colors.text, letterSpacing: -1 },
  tagline: { fontSize: 14, color: Colors.textMuted, marginTop: 4 },

  toggleRow: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    marginBottom: 16, padding: 4,
  },
  toggleTab: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  toggleTabActive: { backgroundColor: Colors.primary },
  toggleTabText: { color: Colors.textMuted, fontSize: 15, fontWeight: '600' },
  toggleTabTextActive: { color: '#fff' },

  socialRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
  socialBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, borderRadius: 14, minHeight: 48,
  },
  socialBtnGoogle:   { backgroundColor: '#DB4437' },
  socialBtnApple:    { backgroundColor: '#000' },
  socialBtnFacebook: { backgroundColor: '#1877F2' },
  socialBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textMuted, fontSize: 12 },

  card: {
    backgroundColor: Colors.card, borderRadius: 24,
    padding: 20, borderWidth: 1, borderColor: Colors.border,
  },
  requiredNote: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card2, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    marginBottom: 16, borderWidth: 1, borderColor: Colors.border,
  },
  requiredNoteText: { color: Colors.textMuted, fontSize: 12 },

  fieldWrap: { marginBottom: 14 },
  label: { fontSize: 13, color: Colors.textMuted, marginBottom: 6, fontWeight: '500' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card2, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14,
  },
  selectRow: {},
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: Colors.text, paddingVertical: 14, fontSize: 15 },
  eyeBtn: { padding: 4 },

  strengthWrap: { marginTop: 10, gap: 6 },
  strengthBarRow: { flexDirection: 'row', gap: 4 },
  strengthSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.card2 },
  strengthLabel: { fontSize: 12, fontWeight: '700' },
  checkList: { gap: 4, marginTop: 2 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkText: { color: Colors.textMuted, fontSize: 12 },
  checkTextPass: { color: '#22c55e' },

  matchError: { color: '#ef4444', fontSize: 12, marginTop: 6 },
  matchOk: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  matchOkText: { color: '#22c55e', fontSize: 12 },

  dobSummaryRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card2, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  dobSummaryText: { flex: 1, color: Colors.text, fontSize: 15 },
  dobPickerRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  dobPickerCol: { flex: 1 },
  dobSegmentBtn: {
    backgroundColor: Colors.card2, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 10, alignItems: 'center',
  },
  dobSegmentBtnActive: { borderColor: Colors.primary, backgroundColor: Colors.card },
  dobSegmentLabel: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  dobSegmentLabelActive: { color: Colors.primary },
  dropdownScroll: {
    maxHeight: 160, marginTop: 4,
    backgroundColor: Colors.card2, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  dropdownOption: {
    paddingVertical: 10, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  dropdownOptionActive: { backgroundColor: Colors.primary },
  dropdownOptionText: { color: Colors.textMuted, fontSize: 13 },
  dropdownOptionTextActive: { color: '#fff', fontWeight: '600' },

  sexDropdown: {
    backgroundColor: Colors.card2, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    marginTop: 4, overflow: 'hidden',
  },
  sexOption: {
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  sexOptionActive: { backgroundColor: Colors.primary },
  sexOptionText: { color: Colors.textMuted, fontSize: 14 },
  sexOptionTextActive: { color: '#fff', fontWeight: '600' },

  button: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 6,
  },
  buttonDisabled: { opacity: 0.45 },
  btnInner: { flexDirection: 'row', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },
})