// components/Explore/BattleTab/SquadFormModal.tsx
//
// All screen components defined at MODULE LEVEL — never inside the modal function —
// so React never sees a new component type and the keyboard never dismisses mid-type.

import React, { useCallback, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Modal,
  KeyboardAvoidingView, Platform, ScrollView,
  TextInput, Image, ActivityIndicator, Alert, FlatList,
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../../../constants/colors'
import { supabase } from '../../../services/supabase'
import { squadService, Squad, CreateSquadPayload } from '../../../services/squadService'
import { RED, GOLD, GREEN, INDIGO, EMOJIS } from './constants'
import { ModalMode, CreateStep, GroupOption } from './types'
import { Country, City } from 'country-state-city'


const MAX_MEMBERS = 100


/** Returns all country names sorted alphabetically. */
const getAllCountryNames = (): string[] =>
  Country.getAllCountries()
    .map(c => c.name)
    .sort()

/** Returns city names for a given country name. */
const getCitiesForCountry = (countryName: string): string[] => {
  const country = Country.getAllCountries().find(c => c.name === countryName)
  if (!country) return []
  return City.getCitiesOfCountry(country.isoCode)?.map(c => c.name) ?? []
}

const COUNTRY_LIST = getAllCountryNames()

// ─── LocationPicker ───────────────────────────────────────────────────────────

const LocationPicker = React.memo(function LocationPicker({
  country, city, onChangeCountry, onChangeCity,
}: { country: string; city: string; onChangeCountry: (c: string) => void; onChangeCity: (c: string) => void }) {
  const [target, setTarget] = useState<'country' | 'city' | null>(null)
  const [search, setSearch] = useState('')

  const items = target === 'country'
    ? COUNTRY_LIST.filter(c => c.toLowerCase().includes(search.toLowerCase()))
    : target === 'city' && country
      ? getCitiesForCountry(country).filter(c => c.toLowerCase().includes(search.toLowerCase()))
      : []

  const open   = (t: 'country' | 'city') => { setSearch(''); setTarget(t) }
  const select = (item: string) => {
    if (target === 'country') { onChangeCountry(item); onChangeCity('') }
    else onChangeCity(item)
    setTarget(null)
  }

  return (
    <>
      <Text style={s.label}>Country</Text>
      <TouchableOpacity style={s.selectBtn} onPress={() => open('country')} activeOpacity={0.8}>
        <Text style={country ? s.selectTxt : s.selectPlaceholder}>{country || 'Select country…'}</Text>
        <FontAwesome5 name="chevron-down" size={12} color={Colors.textMuted} />
      </TouchableOpacity>

      <Text style={[s.label, { marginTop: 16 }]}>City</Text>
      <TouchableOpacity style={[s.selectBtn, !country && { opacity: 0.45 }]} onPress={() => country && open('city')} activeOpacity={country ? 0.8 : 1}>
        <Text style={city ? s.selectTxt : s.selectPlaceholder}>{!country ? 'Select a country first' : city || 'Select city…'}</Text>
        <FontAwesome5 name="chevron-down" size={12} color={Colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={target !== null} transparent animationType="slide" onRequestClose={() => setTarget(null)}>
        <View style={s.pickerOverlay}>
          <View style={s.pickerSheet}>
            <View style={s.pickerHandle} />
            <Text style={s.pickerTitle}>{target === 'country' ? 'Select Country' : 'Select City'}</Text>
            <View style={s.pickerSearch}>
              <FontAwesome5 name="search" size={13} color={Colors.textMuted} style={{ marginRight: 8 }} />
              <TextInput
                style={s.pickerInput}
                placeholder={target === 'country' ? 'Search countries…' : 'Search cities…'}
                placeholderTextColor={Colors.textMuted}
                value={search}
                onChangeText={setSearch}
                autoFocus
              />
              {search.length > 0 && (
                <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <FontAwesome5 name="times-circle" size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <FlatList
              data={items}
              keyExtractor={item => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const sel = target === 'country' ? item === country : item === city
                return (
                  <TouchableOpacity style={[s.pickerItem, sel && s.pickerItemActive]} onPress={() => select(item)} activeOpacity={0.7}>
                    <Text style={[s.pickerItemTxt, sel && s.pickerItemTxtActive]}>{item}</Text>
                    {sel && <FontAwesome5 name="check" size={13} color={INDIGO} />}
                  </TouchableOpacity>
                )
              }}
              ListEmptyComponent={<Text style={s.pickerEmpty}>No results for &quot;{search}&quot;</Text>}
            />
            <TouchableOpacity style={s.pickerCancel} onPress={() => setTarget(null)} activeOpacity={0.8}>
              <Text style={s.pickerCancelTxt}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  )
})

// ─── Shared sub-components ────────────────────────────────────────────────────

const ModalHeader = React.memo(function ModalHeader({
  title, mode, onBack, onClose,
}: { title: string; mode: ModalMode; onBack: () => void; onClose: () => void }) {
  return (
    <View style={s.header}>
      {mode !== 'pick' && (
        <TouchableOpacity onPress={onBack} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <FontAwesome5 name="chevron-left" size={14} color={Colors.text} />
        </TouchableOpacity>
      )}
      <Text style={s.headerTitle}>{title}</Text>
      <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <FontAwesome5 name="times" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
  )
})

const StepDots = React.memo(function StepDots({ createStep }: { createStep: CreateStep }) {
  return (
    <View style={s.dots}>
      {([1, 2, 3] as CreateStep[]).map(i => (
        <View key={i} style={[s.dot, createStep >= i && s.dotActive]} />
      ))}
    </View>
  )
})

// ─── Screens ──────────────────────────────────────────────────────────────────

interface SharedScreen { mode: ModalMode; onBack: () => void; onClose: () => void }

const PickScreen = React.memo(function PickScreen({
  mode, loadingGroups, isGroupAdmin, myGroups,
  onBack, onClose, onCreateNew, onCreateFromGroup, onJoin,
}: SharedScreen & {
  loadingGroups: boolean; isGroupAdmin: boolean; myGroups: GroupOption[]
  onCreateNew: () => void; onCreateFromGroup: (g: GroupOption) => void; onJoin: () => void
}) {
  const OptionRow = ({ icon, iconColor, title, sub, onPress }: any) => (
    <TouchableOpacity style={s.optionCard} onPress={onPress} activeOpacity={0.85}>
      <View style={[s.optionIcon, { backgroundColor: iconColor + '20' }]}>
        <FontAwesome5 name={icon} size={icon === 'user-plus' ? 18 : 22} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.optionTitle}>{title}</Text>
        <Text style={s.optionSub}>{sub}</Text>
      </View>
      <FontAwesome5 name="chevron-right" size={12} color={Colors.textMuted} />
    </TouchableOpacity>
  )

  return (
    <>
      <ModalHeader title="Battle squads" mode={mode} onBack={onBack} onClose={onClose} />
      <ScrollView style={{ flexGrow: 1 }} contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <OptionRow icon="plus-circle" iconColor={INDIGO} title="Create a new squad" sub="You become the admin and get an invite code" onPress={onCreateNew} />
        {loadingGroups
          ? <ActivityIndicator size="small" color={INDIGO} style={{ marginVertical: 8 }} />
          : isGroupAdmin && myGroups.map(g => (
            <TouchableOpacity key={g.id} style={s.optionCard} onPress={() => onCreateFromGroup(g)} activeOpacity={0.85}>
              {g.photo_url
                ? <Image source={{ uri: g.photo_url }} style={s.groupThumb} />
                : <View style={[s.groupThumb, { backgroundColor: INDIGO + '22', justifyContent: 'center', alignItems: 'center' }]}><FontAwesome5 name="users" size={16} color={INDIGO} /></View>}
              <View style={{ flex: 1 }}>
                <Text style={s.optionTitle}>{g.name}</Text>
                <Text style={s.optionSub}>Create squad from this group <Text style={{ color: GOLD }}>· Admin only</Text></Text>
              </View>
              <FontAwesome5 name="chevron-right" size={12} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        <OptionRow icon="user-plus" iconColor={RED} title="Join with invite code" sub="Enter the 6-character code from a teammate" onPress={onJoin} />
      </ScrollView>
    </>
  )
})

const CreateStep1Screen = React.memo(function CreateStep1Screen({
  mode, createStep, name, emoji, sourceGroup,
  onChangeName, onChangeEmoji, onClearSourceGroup, onBack, onClose, onNext,
}: SharedScreen & {
  createStep: CreateStep; name: string; emoji: string; sourceGroup: GroupOption | null
  onChangeName: (t: string) => void; onChangeEmoji: (e: string) => void
  onClearSourceGroup: () => void; onNext: () => void
}) {
  return (
    <>
      <ModalHeader title="Create squad" mode={mode} onBack={onBack} onClose={onClose} />
      <StepDots createStep={createStep} />
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        {sourceGroup ? (
          <View style={s.infoBanner}>
            <FontAwesome5 name="users" size={14} color={INDIGO} />
            <Text style={[s.infoText, { color: INDIGO }]}>Creating squad from <Text style={{ fontWeight: '800' }}>{sourceGroup.name}</Text></Text>
            <TouchableOpacity onPress={onClearSourceGroup}><FontAwesome5 name="times" size={13} color={Colors.textMuted} /></TouchableOpacity>
          </View>
        ) : (
          <View style={s.infoBanner}>
            <FontAwesome5 name="info-circle" size={13} color={INDIGO} />
            <Text style={s.infoText}>You will be the squad admin. Only admins can edit details and invite members.</Text>
          </View>
        )}
        <Text style={s.label}>Pick your squad emoji</Text>
        <View style={s.emojiGrid}>
          {EMOJIS.map(e => (
            <TouchableOpacity key={e} style={[s.emojiBtn, emoji === e && s.emojiBtnActive]} onPress={() => onChangeEmoji(e)}>
              <Text style={{ fontSize: 22 }}>{e}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[s.label, { marginTop: 20 }]}>Squad name *</Text>
        <TextInput style={s.input} placeholder="e.g. Thunderbolts" placeholderTextColor={Colors.textMuted} value={name} onChangeText={onChangeName} maxLength={30} returnKeyType="next" />
        <TouchableOpacity style={[s.nextBtn, { backgroundColor: INDIGO }]} onPress={onNext} activeOpacity={0.85}>
          <Text style={s.nextBtnTxt}>Next — Add details</Text>
          <FontAwesome5 name="chevron-right" size={13} color="#fff" />
        </TouchableOpacity>
      </ScrollView>
    </>
  )
})

const CreateStep2Screen = React.memo(function CreateStep2Screen({
  mode, createStep, country, city, description, photoUri, pickingPhoto,
  onChangeCountry, onChangeCity, onChangeDescription, onPickPhoto, onBack, onClose, onNext,
}: SharedScreen & {
  createStep: CreateStep; country: string; city: string; description: string
  photoUri: string | null; pickingPhoto: boolean
  onChangeCountry: (t: string) => void; onChangeCity: (t: string) => void
  onChangeDescription: (t: string) => void; onPickPhoto: () => void; onNext: () => void
}) {
  return (
    <>
      <ModalHeader title="Squad details" mode={mode} onBack={onBack} onClose={onClose} />
      <StepDots createStep={createStep} />
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <Text style={s.label}>Squad cover photo</Text>
        <TouchableOpacity style={s.photoPicker} onPress={onPickPhoto} activeOpacity={0.85}>
          {photoUri
            ? <Image source={{ uri: photoUri }} style={s.photoPreview} />
            : (
              <View style={s.photoPlaceholder}>
                {pickingPhoto ? <ActivityIndicator color={INDIGO} /> : <><FontAwesome5 name="camera" size={22} color={Colors.textMuted} /><Text style={s.photoHint}>Tap to upload (16:9)</Text></>}
              </View>
            )}
          {photoUri && (
            <View style={s.photoOverlay}>
              <FontAwesome5 name="camera" size={16} color="#fff" />
              <Text style={s.photoChangeTxt}>Change photo</Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={{ marginTop: 16 }}>
          <LocationPicker country={country} city={city} onChangeCountry={onChangeCountry} onChangeCity={onChangeCity} />
        </View>

        <Text style={[s.label, { marginTop: 16 }]}>Description</Text>
        <TextInput style={[s.input, s.textarea]} placeholder="Tell runners what your squad is about…" placeholderTextColor={Colors.textMuted} value={description} onChangeText={onChangeDescription} maxLength={200} multiline numberOfLines={3} />

        <View style={s.infoBanner}>
          <FontAwesome5 name="users" size={12} color={INDIGO} />
          <Text style={s.infoText}>Squads are limited to <Text style={{ fontWeight: '800', color: INDIGO }}>{MAX_MEMBERS} members</Text> max.</Text>
        </View>

        <TouchableOpacity style={[s.nextBtn, { backgroundColor: INDIGO }]} onPress={onNext} activeOpacity={0.85}>
          <Text style={s.nextBtnTxt}>Preview squad</Text>
          <FontAwesome5 name="chevron-right" size={13} color="#fff" />
        </TouchableOpacity>
      </ScrollView>
    </>
  )
})

const CreateStep3Screen = React.memo(function CreateStep3Screen({
  mode, createStep, name, emoji, city, description, photoUri, sourceGroup, loading,
  onBack, onClose, onCreate,
}: SharedScreen & {
  createStep: CreateStep; name: string; emoji: string; city: string; description: string
  photoUri: string | null; sourceGroup: GroupOption | null; loading: boolean; onCreate: () => void
}) {
  return (
    <>
      <ModalHeader title="Preview" mode={mode} onBack={onBack} onClose={onClose} />
      <StepDots createStep={createStep} />
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <View style={s.previewCard}>
          {photoUri
            ? <Image source={{ uri: photoUri }} style={s.previewCover} />
            : <View style={[s.previewCover, { backgroundColor: INDIGO + '22', justifyContent: 'center', alignItems: 'center' }]}><Text style={{ fontSize: 48 }}>{emoji}</Text></View>}
          <View style={s.previewBody}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 26 }}>{emoji}</Text>
              <Text style={s.previewName}>{name}</Text>
            </View>
            {city ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><FontAwesome5 name="map-marker-alt" size={11} color={Colors.textMuted} /><Text style={s.metaTxt}>{city}</Text></View> : null}
            {description ? <Text style={s.metaTxt}>{description}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={s.previewBadge}><FontAwesome5 name="users" size={10} color={INDIGO} /><Text style={s.previewBadgeTxt}>Max {MAX_MEMBERS}</Text></View>
              {sourceGroup && <View style={s.previewBadge}><FontAwesome5 name="link" size={10} color={GOLD} /><Text style={[s.previewBadgeTxt, { color: GOLD }]}>{sourceGroup.name}</Text></View>}
            </View>
          </View>
        </View>
        <Text style={s.previewNote}>Your invite code will be generated automatically. Share it so teammates can join.</Text>
        <TouchableOpacity style={[s.nextBtn, { backgroundColor: GREEN }]} onPress={onCreate} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#fff" size="small" /> : <><FontAwesome5 name="check" size={14} color="#fff" /><Text style={s.nextBtnTxt}>Create squad</Text></>}
        </TouchableOpacity>
      </ScrollView>
    </>
  )
})

const JoinScreen = React.memo(function JoinScreen({
  mode, inviteCode, loading, onChangeCode, onBack, onClose, onJoin,
}: SharedScreen & { inviteCode: string; loading: boolean; onChangeCode: (t: string) => void; onJoin: () => void }) {
  return (
    <>
      <ModalHeader title="Join a squad" mode={mode} onBack={onBack} onClose={onClose} />
      <ScrollView contentContainerStyle={s.body} keyboardShouldPersistTaps="handled">
        <View style={s.infoBanner}>
          <FontAwesome5 name="info-circle" size={13} color={Colors.primary} />
          <Text style={s.infoText}>Ask a squad admin for their 6-character invite code, then enter it below.</Text>
        </View>
        <Text style={[s.label, { marginTop: 8 }]}>Invite code</Text>
        <TextInput style={[s.input, { letterSpacing: 6, fontSize: 20, textTransform: 'uppercase', textAlign: 'center' }]} placeholder="ABC123" placeholderTextColor={Colors.textMuted} value={inviteCode} onChangeText={onChangeCode} maxLength={6} autoCapitalize="characters" autoFocus returnKeyType="go" onSubmitEditing={onJoin} />
        <TouchableOpacity style={[s.nextBtn, { backgroundColor: RED }]} onPress={onJoin} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#fff" size="small" /> : <><FontAwesome5 name="user-plus" size={14} color="#fff" /><Text style={s.nextBtnTxt}>Join squad</Text></>}
        </TouchableOpacity>
      </ScrollView>
    </>
  )
})

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function SquadFormModal({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone: (squad: Squad) => void }) {
  const [mode,        setMode]        = useState<ModalMode>('pick')
  const [createStep,  setCreateStep]  = useState<CreateStep>(1)
  const [name,        setName]        = useState('')
  const [emoji,       setEmoji]       = useState('⚡')
  const [country,     setCountry]     = useState('')
  const [city,        setCity]        = useState('')
  const [description, setDescription] = useState('')
  const [photoUri,    setPhotoUri]    = useState<string | null>(null)
  const [sourceGroup, setSourceGroup] = useState<GroupOption | null>(null)
  const [inviteCode,  setInviteCode]  = useState('')
  const [loading,       setLoading]       = useState(false)
  const [pickingPhoto,  setPickingPhoto]  = useState(false)
  const [myGroups,      setMyGroups]      = useState<GroupOption[]>([])
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [isGroupAdmin,  setIsGroupAdmin]  = useState(false)

  useEffect(() => { if (visible) { setMode('pick'); setCreateStep(1) } }, [visible])

  useEffect(() => {
    if (!visible) return
    setLoadingGroups(true)
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase.from('groups').select('id, name, photo_url').eq('admin_id', user.id)
        const groups = (data ?? []) as GroupOption[]
        setMyGroups(groups)
        setIsGroupAdmin(groups.length > 0)
      } catch { /* groups table may not exist */ }
      finally { setLoadingGroups(false) }
    })()
  }, [visible])

  const reset = useCallback(() => {
    setMode('pick'); setCreateStep(1); setName(''); setEmoji('⚡')
    setCountry(''); setCity(''); setDescription(''); setPhotoUri(null); setSourceGroup(null); setInviteCode('')
  }, [])

  const handleClose = useCallback(() => { reset(); onClose() }, [reset, onClose])

  const handlePickPhoto = useCallback(async () => {
    setPickingPhoto(true)
    try { const uri = await squadService.pickPhoto(); if (uri) setPhotoUri(uri) }
    catch (e: any) { Alert.alert('Photo error', e.message) }
    finally { setPickingPhoto(false) }
  }, [])

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return Alert.alert('Name required', 'Give your squad a name.')
    setLoading(true)
    try {
      const payload: CreateSquadPayload = {
        name, emoji, max_members: MAX_MEMBERS,
        description:     description || undefined,
        city:            city ? (country ? `${city}, ${country}` : city) : (country || undefined),
        photoUri:        photoUri    ?? undefined,
        source_group_id: sourceGroup?.id ?? undefined,
      }
      onDone(await squadService.createSquad(payload))
      reset()
    } catch (e: any) { Alert.alert('Error', e.message) }
    finally { setLoading(false) }
  }, [name, emoji, description, country, city, photoUri, sourceGroup, reset, onDone])

  const handleJoin = useCallback(async () => {
    if (!inviteCode.trim()) return Alert.alert('Code required', 'Enter the 6-character invite code.')
    setLoading(true)
    try { onDone(await squadService.joinByCode(inviteCode)); reset() }
    catch (e: any) { Alert.alert('Error', e.message) }
    finally { setLoading(false) }
  }, [inviteCode, reset, onDone])

  const goBack = useCallback(() => {
    if (mode === 'join') { setMode('pick'); return }
    if (mode === 'create') {
      if (createStep === 1) setMode('pick')
      else setCreateStep(s => (s - 1) as CreateStep)
    }
  }, [mode, createStep])

  const handleCreateNew        = useCallback(() => { setSourceGroup(null); setMode('create'); setCreateStep(1) }, [])
  const handleCreateFromGroup  = useCallback((g: GroupOption) => { setSourceGroup(g); setName(g.name); setMode('create'); setCreateStep(2) }, [])
  const handleJoinMode         = useCallback(() => setMode('join'), [])
  const handleStep1Next        = useCallback(() => { if (!name.trim()) return Alert.alert('Name required', 'Give your squad a name.'); setCreateStep(2) }, [name])
  const handleStep2Next        = useCallback(() => setCreateStep(3), [])
  const handleClearSourceGroup = useCallback(() => setSourceGroup(null), [])
  const handleCodeChange       = useCallback((t: string) => setInviteCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '')), [])

  const shared = { mode, onBack: goBack, onClose: handleClose }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.overlay}>
        <View style={s.sheet}>
          {mode === 'pick' && (
            <PickScreen {...shared} loadingGroups={loadingGroups} isGroupAdmin={isGroupAdmin} myGroups={myGroups} onCreateNew={handleCreateNew} onCreateFromGroup={handleCreateFromGroup} onJoin={handleJoinMode} />
          )}
          {mode === 'create' && createStep === 1 && (
            <CreateStep1Screen {...shared} createStep={createStep} name={name} emoji={emoji} sourceGroup={sourceGroup} onChangeName={setName} onChangeEmoji={setEmoji} onClearSourceGroup={handleClearSourceGroup} onNext={handleStep1Next} />
          )}
          {mode === 'create' && createStep === 2 && (
            <CreateStep2Screen {...shared} createStep={createStep} country={country} city={city} description={description} photoUri={photoUri} pickingPhoto={pickingPhoto} onChangeCountry={setCountry} onChangeCity={setCity} onChangeDescription={setDescription} onPickPhoto={handlePickPhoto} onNext={handleStep2Next} />
          )}
          {mode === 'create' && createStep === 3 && (
            <CreateStep3Screen {...shared} createStep={createStep} name={name} emoji={emoji} city={city ? (country ? `${city}, ${country}` : city) : country} description={description} photoUri={photoUri} sourceGroup={sourceGroup} loading={loading} onCreate={handleCreate} />
          )}
          {mode === 'join' && (
            <JoinScreen {...shared} inviteCode={inviteCode} loading={loading} onChangeCode={handleCodeChange} onJoin={handleJoin} />
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:   { backgroundColor: Colors.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: Colors.border, minHeight: '60%', maxHeight: '92%', paddingBottom: Platform.OS === 'ios' ? 34 : 16 },
  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  backBtn:     { padding: 4 },
  closeBtn:    { padding: 4, marginLeft: 'auto' },
  headerTitle: { color: Colors.text, fontSize: 17, fontWeight: '800', flex: 1 },
  dots:      { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  dot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { backgroundColor: INDIGO, width: 24 },
  body:      { padding: 20, gap: 4 },

  // Options
  optionCard:  { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: Colors.card2, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },
  optionIcon:  { width: 46, height: 46, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  optionTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  optionSub:   { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  groupThumb:  { width: 46, height: 46, borderRadius: 13 },

  // Info banner (replaces separate infoBox + sourceGroupBanner + maxMembersNote)
  infoBanner: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: INDIGO + '10', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: INDIGO + '33', marginBottom: 16 },
  infoText:   { color: Colors.textMuted, fontSize: 13, lineHeight: 18, flex: 1 },

  // Form
  label:    { color: Colors.textMuted, fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },
  input:    { backgroundColor: Colors.card2, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, color: Colors.text, fontSize: 15, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 4 },
  textarea: { height: 90, textAlignVertical: 'top', paddingTop: 12 },

  emojiGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiBtn:      { width: 48, height: 48, borderRadius: 12, backgroundColor: Colors.card2, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  emojiBtnActive:{ borderColor: INDIGO, backgroundColor: INDIGO + '18' },

  photoPicker:     { borderRadius: 14, overflow: 'hidden', marginBottom: 4 },
  photoPreview:    { width: '100%', height: 160 },
  photoPlaceholder:{ width: '100%', height: 160, backgroundColor: Colors.card2, justifyContent: 'center', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed', borderRadius: 14 },
  photoHint:       { color: Colors.textMuted, fontSize: 13 },
  photoOverlay:    { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10 },
  photoChangeTxt:  { color: '#fff', fontSize: 13, fontWeight: '600' },

  // Preview
  previewCard:  { backgroundColor: Colors.card2, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: 16 },
  previewCover: { width: '100%', height: 140 },
  previewBody:  { padding: 16, gap: 8 },
  previewName:  { color: Colors.text, fontSize: 20, fontWeight: '800', flex: 1 },
  metaTxt:      { color: Colors.textMuted, fontSize: 13, lineHeight: 18 },
  previewBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: INDIGO + '15', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: INDIGO + '33' },
  previewBadgeTxt: { color: INDIGO, fontSize: 12, fontWeight: '600' },
  previewNote:  { color: Colors.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 16 },

  nextBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 14, paddingVertical: 15, marginTop: 12 },
  nextBtnTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // Location picker
  selectBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.card2, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 4 },
  selectTxt:         { color: Colors.text, fontSize: 15 },
  selectPlaceholder: { color: Colors.textMuted, fontSize: 15 },
  pickerOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  pickerSheet:       { backgroundColor: Colors.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: Colors.border, maxHeight: '70%', paddingBottom: Platform.OS === 'ios' ? 34 : 16 },
  pickerHandle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  pickerTitle:       { color: Colors.text, fontSize: 16, fontWeight: '800', textAlign: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.border },
  pickerSearch:      { flexDirection: 'row', alignItems: 'center', margin: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: Colors.card2, borderRadius: 12, borderWidth: 1, borderColor: Colors.border },
  pickerInput:       { flex: 1, color: Colors.text, fontSize: 14, padding: 0 },
  pickerItem:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  pickerItemActive:  { backgroundColor: INDIGO + '10' },
  pickerItemTxt:     { color: Colors.text, fontSize: 15 },
  pickerItemTxtActive: { color: INDIGO, fontWeight: '700' },
  pickerEmpty:       { color: Colors.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 28 },
  pickerCancel:      { margin: 12, borderRadius: 12, paddingVertical: 13, backgroundColor: Colors.card2, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  pickerCancelTxt:   { color: Colors.text, fontSize: 15, fontWeight: '700' },
})