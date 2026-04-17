import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { FontAwesome5, Ionicons } from '@expo/vector-icons'
import { supabase } from '../services/supabase'
import { Colors } from '../constants/colors'

const SEX_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say']

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))
const MONTHS = [
  { label: 'January', value: '01' }, { label: 'February', value: '02' },
  { label: 'March', value: '03' },   { label: 'April', value: '04' },
  { label: 'May', value: '05' },     { label: 'June', value: '06' },
  { label: 'July', value: '07' },    { label: 'August', value: '08' },
  { label: 'September', value: '09' },{ label: 'October', value: '10' },
  { label: 'November', value: '11' },{ label: 'December', value: '12' },
]
const currentYear = new Date().getFullYear()
const YEARS = Array.from({ length: 100 }, (_, i) => String(currentYear - 13 - i))

type PickerField = 'day' | 'month' | 'year' | null

// ✅ FIX: Defined OUTSIDE the component so it never re-mounts on re-render,
// which was causing the keyboard to dismiss after every single character typed.
const InputRow = ({
  icon, placeholder, value, onChangeText, keyboardType, secureTextEntry, rightElement, autoCapitalize,
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

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  // Login fields
  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  // Sign-up fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [fullName, setFullName] = useState('')
  const [dobDay, setDobDay] = useState('')
  const [dobMonth, setDobMonth] = useState('')
  const [dobYear, setDobYear] = useState('')
  const [openPicker, setOpenPicker] = useState<PickerField>(null)
  const [phone, setPhone] = useState('')
  const [sex, setSex] = useState('')
  const [showSexPicker, setShowSexPicker] = useState(false)

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
    if (identifier.includes('@')) return identifier
    const { data, error } = await supabase
      .from('profiles')
      .select('email')
      .eq('username', identifier.toLowerCase().trim())
      .single()
    if (error || !data?.email) return null
    return data.email
  }

  const handleLogin = async () => {
    if (!loginIdentifier || !loginPassword) {
      return Alert.alert('Error', 'Please fill in all fields')
    }
    setLoading(true)
    try {
      const resolvedEmail = await resolveEmail(loginIdentifier)
      if (!resolvedEmail) {
        Alert.alert('Login Error', 'No account found with that username or email.')
        setLoading(false)
        return
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password: loginPassword,
      })
      if (error) Alert.alert('Login Error', error.message)
    } catch {
      Alert.alert('Error', 'Something went wrong')
    }
    setLoading(false)
  }

  const handleSignUp = async () => {
    if (!email || !password || !username || !fullName) {
      return Alert.alert('Error', 'Please fill in all required fields')
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) {
        Alert.alert('Signup Error', error.message)
      } else if (data.user) {
        const { error: profileError } = await supabase.from('profiles').insert({
          id: data.user.id,
          email: email.toLowerCase().trim(),
          username: username.toLowerCase().replace(/\s/g, '_'),
          full_name: fullName,
          date_of_birth: buildDob(),
          sex: sex || null,
          phone: phone || null,
          total_distance: 0,
          total_runs: 0,
        })
        if (profileError) Alert.alert('Profile Error', profileError.message)
      }
    } catch {
      Alert.alert('Error', 'Something went wrong')
    }
    setLoading(false)
  }

  // Reusable inline dropdown picker
  const InlinePicker = ({
    field,
    items,
    selected,
    onSelect,
    labelKey,
    valueKey,
  }: {
    field: PickerField
    items: any[]
    selected: string
    onSelect: (val: string) => void
    labelKey?: string
    valueKey?: string
  }) =>
    openPicker === field ? (
      <ScrollView
        style={styles.dropdownScroll}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
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
              <Text style={[styles.dropdownOptionText, active && styles.dropdownOptionTextActive]}>
                {lbl}
              </Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    ) : null

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.logoCircle}>
            <FontAwesome5 name="running" size={36} color="#fff" />
          </View>
          <Text style={styles.appName}>RunApp</Text>
          <Text style={styles.tagline}>Track every stride</Text>
        </View>

        {/* ── Tab toggle ── */}
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
                      <Ionicons
                        name={showPass ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={Colors.textDim}
                      />
                    </TouchableOpacity>
                  }
                />
              </Field>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={styles.btnInner}>
                    <FontAwesome5 name="sign-in-alt" size={15} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.buttonText}>Log In</Text>
                  </View>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.requiredNote}>
                <Text style={styles.requiredNoteText}>* Required fields</Text>
              </View>

              <Field label="Full Name *">
                <InputRow
                  icon="id-card"
                  placeholder="Your full name"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              </Field>

              <Field label="Username *">
                <InputRow
                  icon="at"
                  placeholder="your_username"
                  value={username}
                  onChangeText={setUsername}
                />
              </Field>

              <Field label="Email *">
                <InputRow
                  icon="envelope"
                  placeholder="email@example.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                />
              </Field>

              <Field label="Password *">
                <InputRow
                  icon="lock"
                  placeholder="Create a password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  rightElement={
                    <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(v => !v)}>
                      <Ionicons
                        name={showPass ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={Colors.textDim}
                      />
                    </TouchableOpacity>
                  }
                />
              </Field>

              {/* Date of Birth */}
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>Date of Birth</Text>
                <TouchableOpacity
                  style={styles.dobSummaryRow}
                  onPress={() => togglePicker(openPicker ? null : 'day')}
                >
                  <FontAwesome5 name="birthday-cake" size={13} color={Colors.textDim} style={{ marginRight: 10 }} />
                  <Text style={styles.dobSummaryText}>{dobDisplay()}</Text>
                  <Ionicons
                    name={openPicker !== null ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={Colors.textDim}
                  />
                </TouchableOpacity>

                {openPicker !== null && (
                  <View style={styles.dobPickerRow}>
                    {/* Day */}
                    <View style={styles.dobPickerCol}>
                      <TouchableOpacity
                        style={[styles.dobSegmentBtn, openPicker === 'day' && styles.dobSegmentBtnActive]}
                        onPress={() => togglePicker('day')}
                      >
                        <Text style={[styles.dobSegmentLabel, openPicker === 'day' && styles.dobSegmentLabelActive]}>
                          {dobDay || 'Day'}
                        </Text>
                      </TouchableOpacity>
                      <InlinePicker
                        field="day"
                        items={DAYS}
                        selected={dobDay}
                        onSelect={setDobDay}
                      />
                    </View>

                    {/* Month */}
                    <View style={styles.dobPickerCol}>
                      <TouchableOpacity
                        style={[styles.dobSegmentBtn, openPicker === 'month' && styles.dobSegmentBtnActive]}
                        onPress={() => togglePicker('month')}
                      >
                        <Text style={[styles.dobSegmentLabel, openPicker === 'month' && styles.dobSegmentLabelActive]}>
                          {dobMonth ? MONTHS.find(m => m.value === dobMonth)?.label.slice(0, 3) : 'Month'}
                        </Text>
                      </TouchableOpacity>
                      <InlinePicker
                        field="month"
                        items={MONTHS}
                        selected={dobMonth}
                        onSelect={setDobMonth}
                        labelKey="label"
                        valueKey="value"
                      />
                    </View>

                    {/* Year */}
                    <View style={styles.dobPickerCol}>
                      <TouchableOpacity
                        style={[styles.dobSegmentBtn, openPicker === 'year' && styles.dobSegmentBtnActive]}
                        onPress={() => togglePicker('year')}
                      >
                        <Text style={[styles.dobSegmentLabel, openPicker === 'year' && styles.dobSegmentLabelActive]}>
                          {dobYear || 'Year'}
                        </Text>
                      </TouchableOpacity>
                      <InlinePicker
                        field="year"
                        items={YEARS}
                        selected={dobYear}
                        onSelect={setDobYear}
                      />
                    </View>
                  </View>
                )}
              </View>

              {/* Sex */}
              <View style={[styles.fieldWrap]}>
                <Text style={styles.label}>Sex</Text>
                <TouchableOpacity
                  style={[styles.inputRow, styles.selectRow]}
                  onPress={() => setShowSexPicker(!showSexPicker)}
                >
                  <FontAwesome5 name="venus-mars" size={13} color={Colors.textDim} style={styles.inputIcon} />
                  <Text style={[styles.input, { flex: 1, paddingVertical: 14 }, !sex && { color: Colors.textDim }]}>
                    {sex || 'Select'}
                  </Text>
                  <Ionicons
                    name={showSexPicker ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={Colors.textDim}
                    style={{ marginRight: 4 }}
                  />
                </TouchableOpacity>
                {showSexPicker && (
                  <View style={styles.sexDropdown}>
                    {SEX_OPTIONS.map(opt => (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.sexOption, sex === opt && styles.sexOptionActive]}
                        onPress={() => { setSex(opt); setShowSexPicker(false) }}
                      >
                        <Text style={[styles.sexOptionText, sex === opt && styles.sexOptionTextActive]}>
                          {opt}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <Field label="Phone Number">
                <InputRow
                  icon="phone"
                  placeholder="+1 234 567 8900"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </Field>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSignUp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={styles.btnInner}>
                    <FontAwesome5 name="user-plus" size={15} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.buttonText}>Create Account</Text>
                  </View>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 40 },

  header: { alignItems: 'center', marginBottom: 32 },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 16, elevation: 10,
  },
  appName: { fontSize: 36, fontWeight: '800', color: Colors.text, letterSpacing: -1 },
  tagline: { fontSize: 15, color: Colors.textMuted, marginTop: 4 },

  toggleRow: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    marginBottom: 16, padding: 4,
  },
  toggleTab: {
    flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center',
  },
  toggleTabActive: { backgroundColor: Colors.primary },
  toggleTabText: { color: Colors.textMuted, fontSize: 15, fontWeight: '600' },
  toggleTabTextActive: { color: '#fff' },

  card: {
    backgroundColor: Colors.card, borderRadius: 24,
    padding: 20, borderWidth: 1, borderColor: Colors.border,
  },

  requiredNote: {
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
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14,
  },
  selectRow: {},
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1, color: Colors.text,
    paddingVertical: 14, fontSize: 15,
  },
  eyeBtn: { padding: 4 },

  dobSummaryRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card2, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  dobSummaryText: { flex: 1, color: Colors.text, fontSize: 15 },

  dobPickerRow: {
    flexDirection: 'row', gap: 8, marginTop: 8,
  },
  dobPickerCol: { flex: 1 },

  dobSegmentBtn: {
    backgroundColor: Colors.card2, borderRadius: 10,
    borderWidth: 1, borderColor: Colors.border,
    paddingVertical: 10, alignItems: 'center',
  },
  dobSegmentBtnActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.card,
  },
  dobSegmentLabel: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  dobSegmentLabelActive: { color: Colors.primary },

  dropdownScroll: {
    maxHeight: 160, marginTop: 4,
    backgroundColor: Colors.card2,
    borderRadius: 10, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
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
    paddingVertical: 16, alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: { opacity: 0.6 },
  btnInner: { flexDirection: 'row', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700', letterSpacing: 0.3 },
})