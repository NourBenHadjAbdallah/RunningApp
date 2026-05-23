// screens/CreateGroupScreen.tsx
import React, { useState, useRef } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { Colors } from '../constants/colors'
import { supabase } from '../services/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type Visibility = 'public' | 'private'

interface Sport {
  key: string
  label: string
  icon: string // FontAwesome5 icon name
}

interface Tag {
  key: string
  label: string
  desc: string
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const SPORTS: Sport[] = [
  { key: 'running',  label: 'Running',  icon: 'running'       },
  { key: 'cycling',  label: 'Cycling',  icon: 'bicycle'       },
  { key: 'swimming', label: 'Swimming', icon: 'swimmer'       },
  { key: 'hiking',   label: 'Hiking',   icon: 'mountain'      },
  { key: 'football', label: 'Football', icon: 'futbol'        },
  { key: 'fitness',  label: 'Fitness',  icon: 'dumbbell'      },
  { key: 'tennis',   label: 'Tennis',   icon: 'table-tennis'  },
  { key: 'yoga',     label: 'Yoga',     icon: 'spa'           },
]

const TAGS: Tag[] = [
  { key: 'beginners',   label: 'Beginners welcome', desc: 'Open to all levels, patient community'   },
  { key: 'competitive', label: 'Competitive',        desc: 'We race, we rank, we push limits'        },
  { key: 'casual',      label: 'Casual & social',    desc: 'Mainly for fun and meetups'              },
  { key: 'training',    label: 'Training plans',     desc: 'Structured weekly schedules'             },
  { key: 'race_events', label: 'Race events',        desc: 'We sign up for local races together'     },
  { key: 'youth',       label: 'Youth / teens',      desc: 'Dedicated to under-18 members'           },
  { key: 'women',       label: 'Women only',         desc: 'Safe space for women athletes'           },
  { key: 'veterans',    label: 'Veteran athletes',   desc: '40+ focused community'                   },
  { key: 'nutrition',   label: 'Nutrition focus',    desc: 'Diet, fueling, and recovery tips'        },
  { key: 'trails',      label: 'Local trails',       desc: 'Exploring routes in our region'          },
]

const MAX_TAGS = 5
const STEPS = ['Sport', 'Type', 'Details', 'Privacy']

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <View style={styles.stepRow}>
      {STEPS.map((label, i) => {
        const step = i + 1
        const done   = step < current
        const active = step === current
        return (
          <React.Fragment key={step}>
            <View style={styles.stepItem}>
              <View style={[styles.stepDot, done && styles.stepDotDone, active && styles.stepDotActive]}>
                {done
                  ? <FontAwesome5 name="check" size={10} color="#fff" />
                  : <Text style={[styles.stepNum, active && styles.stepNumActive]}>{step}</Text>
                }
              </View>
              <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
            </View>
            {i < STEPS.length - 1 && (
              <View style={[styles.stepLine, done && styles.stepLineDone]} />
            )}
          </React.Fragment>
        )
      })}
    </View>
  )
}

// ─── Summary row ──────────────────────────────────────────────────────────────

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.sumRow}>
      <Text style={styles.sumKey}>{label}</Text>
      <Text style={styles.sumVal} numberOfLines={2}>{value || '—'}</Text>
    </View>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CreateGroupScreen() {
  const [step, setStep]         = useState(1)
  const [sports, setSports]     = useState<string[]>([])
  const [tags, setTags]         = useState<string[]>([])
  const [name, setName]         = useState('')
  const [bio, setBio]           = useState('')
  const [location, setLocation] = useState('')
  const [coverUri, setCoverUri] = useState<string | null>(null)
  const [visibility, setVis]    = useState<Visibility>('public')
  const [loading, setLoading]   = useState(false)
  const scrollRef = useRef<ScrollView>(null)

  // ── Validation ──────────────────────────────────────────────────────────────

  const canProceed = () => {
    if (step === 1) return sports.length > 0
    if (step === 2) return tags.length > 0
    if (step === 3) return name.trim().length > 0
    return true
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  const goNext = () => {
    if (!canProceed()) {
      const msgs: Record<number, string> = {
        1: 'Please select at least one sport.',
        2: 'Please select at least one tag.',
        3: 'Please enter a group name.',
      }
      Alert.alert('Required', msgs[step])
      return
    }
    scrollRef.current?.scrollTo({ y: 0, animated: false })
    setStep(s => s + 1)
  }

  const goBack = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: false })
    setStep(s => s - 1)
  }

  // ── Sport toggle ─────────────────────────────────────────────────────────────

  const toggleSport = (key: string) => {
    setSports(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    )
  }

  // ── Tag toggle ───────────────────────────────────────────────────────────────

  const toggleTag = (key: string) => {
    setTags(prev => {
      if (prev.includes(key)) return prev.filter(t => t !== key)
      if (prev.length >= MAX_TAGS) {
        Alert.alert('Limit reached', `You can select up to ${MAX_TAGS} tags.`)
        return prev
      }
      return [...prev, key]
    })
  }

  // ── Image picker ─────────────────────────────────────────────────────────────

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to pick a cover photo.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.85,
    })
    if (!result.canceled && result.assets[0]) {
      setCoverUri(result.assets[0].uri)
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      let coverUrl: string | null = null

      // Upload cover image if selected
      if (coverUri) {
        const ext  = coverUri.split('.').pop() ?? 'jpg'
        const path = `group-covers/${user.id}/${Date.now()}.${ext}`
        const resp = await fetch(coverUri)
        const blob = await resp.blob()
        const { error: upErr } = await supabase.storage
          .from('group-images')
          .upload(path, blob, { contentType: `image/${ext}`, upsert: true })
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from('group-images').getPublicUrl(path)
        coverUrl = urlData.publicUrl
      }

      // Insert group
      const { data: group, error: insErr } = await supabase
        .from('groups')
        .insert({
          name:        name.trim(),
          description: bio.trim() || null,
          location:    location.trim() || null,
          image_url:   coverUrl,
          sports,
          tags,
          visibility,
          created_by:  user.id,
        })
        .select('id')
        .single()

      if (insErr) throw insErr

      // Auto-join as owner
      await supabase.from('group_members').insert({
        group_id: group.id,
        user_id:  user.id,
        role:     'owner',
      })

      Alert.alert('Group created! 🎉', `"${name}" is live.`, [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ])
    } catch (e: any) {
      Alert.alert('Error', e.message ?? 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <FontAwesome5 name="times" size={16} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Group</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <StepIndicator current={step} />

        {/* ── Step 1: Sports ─────────────────────────────────────────────────── */}
        {step === 1 && (
          <View>
            <Text style={styles.stepTitle}>What sport(s)?</Text>
            <Text style={styles.stepSub}>
              Choose one or more activities for your group.
            </Text>
            <View style={styles.sportsGrid}>
              {SPORTS.map(sport => {
                const sel = sports.includes(sport.key)
                return (
                  <TouchableOpacity
                    key={sport.key}
                    style={[styles.sportBtn, sel && styles.sportBtnSel]}
                    onPress={() => toggleSport(sport.key)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.sportIconWrap, sel && styles.sportIconWrapSel]}>
                      <FontAwesome5
                        name={sport.icon as any}
                        size={22}
                        color={sel ? '#fff' : Colors.textMuted}
                      />
                    </View>
                    <Text style={[styles.sportLabel, sel && styles.sportLabelSel]}>
                      {sport.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        )}

        {/* ── Step 2: Tags ───────────────────────────────────────────────────── */}
        {step === 2 && (
          <View>
            <Text style={styles.stepTitle}>What describes your group?</Text>
            <Text style={styles.stepSub}>
              Pick up to {MAX_TAGS} tags — these help people discover you.
            </Text>
            {tags.length > 0 && (
              <View style={styles.tagCounter}>
                <FontAwesome5 name="tag" size={11} color={Colors.primary} />
                <Text style={styles.tagCounterText}>{tags.length}/{MAX_TAGS} selected</Text>
              </View>
            )}
            <View style={styles.tagsGrid}>
              {TAGS.map(tag => {
                const sel = tags.includes(tag.key)
                const disabled = !sel && tags.length >= MAX_TAGS
                return (
                  <TouchableOpacity
                    key={tag.key}
                    style={[styles.tagBtn, sel && styles.tagBtnSel, disabled && styles.tagBtnDisabled]}
                    onPress={() => toggleTag(tag.key)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.tagRow}>
                      <Text style={[styles.tagLabel, sel && styles.tagLabelSel]}>{tag.label}</Text>
                      {sel && (
                        <FontAwesome5 name="check-circle" size={13} color={Colors.primary} solid />
                      )}
                    </View>
                    <Text style={styles.tagDesc}>{tag.desc}</Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>
        )}

        {/* ── Step 3: Details ────────────────────────────────────────────────── */}
        {step === 3 && (
          <View>
            <Text style={styles.stepTitle}>Group details</Text>
            <Text style={styles.stepSub}>Give your group an identity.</Text>

            {/* Name */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Group name *</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Tunis Runners Crew"
                placeholderTextColor={Colors.textMuted}
                maxLength={50}
              />
              <Text style={styles.charCount}>{name.length}/50</Text>
            </View>

            {/* Cover photo */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Cover photo</Text>
              <TouchableOpacity style={styles.uploadBox} onPress={pickImage} activeOpacity={0.8}>
                {coverUri ? (
                  <>
                    <Image source={{ uri: coverUri }} style={styles.coverPreview} resizeMode="cover" />
                    <View style={styles.coverOverlay}>
                      <FontAwesome5 name="camera" size={16} color="#fff" />
                      <Text style={styles.coverOverlayText}>Change photo</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View style={styles.uploadIconWrap}>
                      <FontAwesome5 name="camera" size={24} color={Colors.textMuted} />
                    </View>
                    <Text style={styles.uploadText}>Tap to upload a cover photo</Text>
                    <Text style={styles.uploadSub}>16:9 recommended</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Bio */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Bio</Text>
              <TextInput
                style={[styles.input, styles.textarea]}
                value={bio}
                onChangeText={setBio}
                placeholder="What's your group about? Goals, schedule, vibe..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={4}
                maxLength={200}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{bio.length}/200</Text>
            </View>

            {/* Location */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Location</Text>
              <View style={styles.inputWithIcon}>
                <FontAwesome5 name="map-marker-alt" size={14} color={Colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, styles.inputPaddedLeft]}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="City or neighbourhood"
                  placeholderTextColor={Colors.textMuted}
                  maxLength={80}
                />
              </View>
            </View>
          </View>
        )}

        {/* ── Step 4: Privacy + Summary ──────────────────────────────────────── */}
        {step === 4 && (
          <View>
            <Text style={styles.stepTitle}>Who can join?</Text>
            <Text style={styles.stepSub}>Set the visibility for your group.</Text>

            <View style={styles.visRow}>
              {/* Public */}
              <TouchableOpacity
                style={[styles.visCard, visibility === 'public' && styles.visCardSel]}
                onPress={() => setVis('public')}
                activeOpacity={0.8}
              >
                <View style={[styles.visIconWrap, visibility === 'public' && styles.visIconWrapSel]}>
                  <FontAwesome5 name="globe-africa" size={22} color={visibility === 'public' ? '#fff' : Colors.textMuted} />
                </View>
                <Text style={[styles.visTitle, visibility === 'public' && styles.visTitleSel]}>Public</Text>
                <Text style={styles.visDesc}>Anyone can find and join</Text>
                {visibility === 'public' && (
                  <View style={styles.visCheck}>
                    <FontAwesome5 name="check-circle" size={14} color={Colors.primary} solid />
                  </View>
                )}
              </TouchableOpacity>

              {/* Private */}
              <TouchableOpacity
                style={[styles.visCard, visibility === 'private' && styles.visCardSel]}
                onPress={() => setVis('private')}
                activeOpacity={0.8}
              >
                <View style={[styles.visIconWrap, visibility === 'private' && styles.visIconWrapSel]}>
                  <FontAwesome5 name="lock" size={22} color={visibility === 'private' ? '#fff' : Colors.textMuted} />
                </View>
                <Text style={[styles.visTitle, visibility === 'private' && styles.visTitleSel]}>Private</Text>
                <Text style={styles.visDesc}>Invite or approval only</Text>
                {visibility === 'private' && (
                  <View style={styles.visCheck}>
                    <FontAwesome5 name="check-circle" size={14} color={Colors.primary} solid />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Summary */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <FontAwesome5 name="list-ul" size={13} color={Colors.textMuted} />
                <Text style={styles.summaryHeaderText}>Summary</Text>
              </View>
              <SumRow
                label="Sports"
                value={sports.map(k => SPORTS.find(s => s.key === k)?.label ?? k).join(', ')}
              />
              <SumRow
                label="Tags"
                value={tags.map(k => TAGS.find(t => t.key === k)?.label ?? k).join(', ')}
              />
              <SumRow label="Name"       value={name}       />
              <SumRow label="Location"   value={location}   />
              <SumRow label="Visibility" value={visibility === 'public' ? 'Public' : 'Private'} />
            </View>
          </View>
        )}

        {/* ── Navigation buttons ─────────────────────────────────────────────── */}
        <View style={styles.navRow}>
          {step > 1 && (
            <TouchableOpacity style={styles.backBtn} onPress={goBack}>
              <FontAwesome5 name="chevron-left" size={13} color={Colors.text} />
              <Text style={styles.backBtnText}>Back</Text>
            </TouchableOpacity>
          )}

          {step < 4 ? (
            <TouchableOpacity
              style={[styles.nextBtn, step === 1 && { flex: 1 }]}
              onPress={goNext}
            >
              <Text style={styles.nextBtnText}>Continue</Text>
              <FontAwesome5 name="chevron-right" size={13} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.nextBtn, styles.createBtn]}
              onPress={handleCreate}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <FontAwesome5 name="users" size={15} color="#fff" />
                  <Text style={styles.nextBtnText}>Create Group</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.card2,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  headerTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' },

  // Step indicator
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 28,
  },
  stepItem: { alignItems: 'center', gap: 6 },
  stepDot: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.card2,
    borderWidth: 1, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  stepDotDone:   { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepDotActive: { backgroundColor: Colors.background, borderWidth: 2, borderColor: Colors.primary },
  stepNum:       { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  stepNumActive: { color: Colors.primary },
  stepLabel:     { color: Colors.textMuted, fontSize: 10, fontWeight: '500' },
  stepLabelActive: { color: Colors.primary, fontWeight: '700' },
  stepLine: {
    flex: 1, height: 1,
    backgroundColor: Colors.border,
    marginBottom: 16,
    marginHorizontal: 4,
  },
  stepLineDone: { backgroundColor: Colors.primary },

  // Step header
  stepTitle: { color: Colors.text, fontSize: 20, fontWeight: '700', marginBottom: 6 },
  stepSub:   { color: Colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 20 },

  // Sports grid
  sportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  sportBtn: {
    width: '47%',
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 10,
  },
  sportBtnSel: {
    borderColor: Colors.primary,
    borderWidth: 2,
    backgroundColor: Colors.card2,
  },
  sportIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.card2,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  sportIconWrapSel: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  sportLabel:    { color: Colors.text,    fontSize: 13, fontWeight: '600' },
  sportLabelSel: { color: Colors.primary, fontSize: 13, fontWeight: '700' },

  // Tags grid
  tagCounter: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 14,
  },
  tagCounterText: { color: Colors.primary, fontSize: 13, fontWeight: '600' },

  tagsGrid: { gap: 10 },
  tagBtn: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
  },
  tagBtnSel:      { borderColor: Colors.primary, borderWidth: 2, backgroundColor: Colors.card2 },
  tagBtnDisabled: { opacity: 0.4 },
  tagRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  tagLabel:    { color: Colors.text,    fontSize: 14, fontWeight: '600' },
  tagLabelSel: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  tagDesc: { color: Colors.textMuted, fontSize: 12, lineHeight: 17 },

  // Form
  formGroup:  { marginBottom: 20 },
  formLabel:  { color: Colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  charCount:  { color: Colors.textMuted, fontSize: 11, textAlign: 'right', marginTop: 4 },

  input: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: Colors.text,
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  textarea: {
    height: 100,
    paddingTop: 13,
  },
  inputWithIcon: { position: 'relative' },
  inputIcon:     { position: 'absolute', left: 14, top: 15, zIndex: 1 },
  inputPaddedLeft: { paddingLeft: 38 },

  // Upload / cover
  uploadBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    backgroundColor: Colors.card,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    gap: 8,
  },
  uploadIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.card2,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  uploadText: { color: Colors.textMuted, fontSize: 14, fontWeight: '500' },
  uploadSub:  { color: Colors.textMuted, fontSize: 11 },
  coverPreview: { width: '100%', height: '100%', position: 'absolute' },
  coverOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, gap: 8,
  },
  coverOverlayText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Visibility
  visRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  visCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    alignItems: 'center',
    gap: 8,
    position: 'relative',
  },
  visCardSel: { borderColor: Colors.primary, borderWidth: 2 },
  visIconWrap: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.card2,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  visIconWrapSel: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  visTitle:    { color: Colors.text,    fontSize: 15, fontWeight: '700' },
  visTitleSel: { color: Colors.primary },
  visDesc: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', lineHeight: 15 },
  visCheck: { position: 'absolute', top: 10, right: 10 },

  // Summary
  summaryCard: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  summaryHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.card2,
  },
  summaryHeaderText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  sumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  sumKey: { color: Colors.textMuted, fontSize: 13 },
  sumVal: { color: Colors.text, fontSize: 13, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },

  // Navigation
  navRow: { flexDirection: 'row', gap: 12, marginTop: 28 },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.card,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: 18, paddingVertical: 15,
  },
  backBtnText: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  nextBtn: {
    flex: 2,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 15,
  },
  nextBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  createBtn: { flex: 1 },
})