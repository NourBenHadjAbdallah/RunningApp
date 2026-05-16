// components/home/CreateGroupSheet.tsx
// Animated bottom sheet for creating a new running group.
// Extracted because it owns: PanResponder, spring animation, image upload,
// and Supabase insert — enough complexity to justify a separate file.

import React, { useEffect, useRef, useState } from 'react'
import {
  Animated, Alert, ActivityIndicator, Dimensions,
  Image, KeyboardAvoidingView, Modal, Platform,
  PanResponder, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '../../services/supabase'
import { Colors } from '../../constants/colors'
import type { Group } from '../../services/activityService'

const SCREEN_HEIGHT = Dimensions.get('window').height
const SHEET_H = SCREEN_HEIGHT * 0.82

interface CreateGroupSheetProps {
  visible: boolean
  onClose: () => void
  onCreated: (group: Group) => void
}

export default function CreateGroupSheet({ visible, onClose, onCreated }: CreateGroupSheetProps) {
  const translateY = useRef(new Animated.Value(SHEET_H)).current

  const [name,          setName]          = useState('')
  const [description,   setDescription]   = useState('')
  const [localImageUri, setLocalImageUri] = useState<string | null>(null)
  const [uploading,     setUploading]     = useState(false)
  const [saving,        setSaving]        = useState(false)

  // ── Animation ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (visible) {
      translateY.setValue(SHEET_H)
      Animated.spring(translateY, {
        toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
      }).start()
    }
  }, [visible])

  const close = () => {
    Animated.timing(translateY, {
      toValue: SHEET_H, duration: 260, useNativeDriver: true,
    }).start(onClose)
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gs) => { if (gs.dy > 0) translateY.setValue(gs.dy) },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 100 || gs.vy > 0.5) close()
        else Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start()
      },
    })
  ).current

  // ── Image picker ───────────────────────────────────────────────────────────

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to choose a group image.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    })
    if (!result.canceled && result.assets[0]) {
      setLocalImageUri(result.assets[0].uri)
    }
  }

  // ── Upload to Supabase Storage ─────────────────────────────────────────────

  const uploadImage = async (uri: string): Promise<string> => {
    setUploading(true)
    try {
      const ext      = uri.split('.').pop()?.toLowerCase() ?? 'jpg'
      const filename = `group_${Date.now()}.${ext}`
      const path     = `group-images/${filename}`

      const response = await fetch(uri)
      const blob     = await response.blob()

      const { error: uploadError } = await supabase.storage
        .from('group-images')
        .upload(path, blob, { contentType: `image/${ext}`, upsert: false })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('group-images').getPublicUrl(path)
      return data.publicUrl
    } finally {
      setUploading(false)
    }
  }

  // ── Create group ───────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!name.trim()) return Alert.alert('Missing name', 'Please give your group a name.')
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const userId = session?.user?.id
      if (!userId) throw new Error('Not logged in')

      let imageUrl: string | null = null
      if (localImageUri) imageUrl = await uploadImage(localImageUri)

      const { data, error } = await supabase
        .from('groups')
        .insert({
          name:         name.trim(),
          description:  description.trim() || null,
          image_url:    imageUrl,
          icon:         'users',
          category:     'running',
          member_count: 1,
          created_by:   userId,
        })
        .select()
        .single()

      if (error) throw error

      // Auto-join the creator
      await supabase.from('group_members').insert({ group_id: data.id, user_id: userId })

      onCreated({ ...data, joined: true })

      // Reset form
      setName('')
      setDescription('')
      setLocalImageUri(null)
      close()
    } catch (e: any) {
      Alert.alert('Error', e.message)
    }
    setSaving(false)
  }

  if (!visible) return null

  const isBusy = saving || uploading

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <TouchableOpacity style={cs.backdrop} activeOpacity={1} onPress={close} />
      <Animated.View style={[cs.container, { height: SHEET_H, transform: [{ translateY }] }]}>

        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={cs.handleArea}>
          <View style={cs.handle} />
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={cs.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <View style={cs.header}>
              <View style={cs.headerIcon}>
                <FontAwesome5 name="users" size={18} color={Colors.primary} />
              </View>
              <Text style={cs.headerTitle}>Create a Group</Text>
              <TouchableOpacity onPress={close} style={cs.closeBtn}>
                <FontAwesome5 name="times" size={15} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Image picker */}
            <TouchableOpacity
              style={cs.imagePickerBtn}
              onPress={pickImage}
              activeOpacity={0.8}
              disabled={isBusy}
            >
              {localImageUri ? (
                <>
                  <Image source={{ uri: localImageUri }} style={cs.imagePreviewImg} resizeMode="cover" />
                  <View style={cs.imageEditOverlay}>
                    <FontAwesome5 name="camera" size={16} color="#fff" />
                    <Text style={cs.imageEditText}>Change photo</Text>
                  </View>
                </>
              ) : (
                <View style={cs.imagePickerPlaceholder}>
                  <View style={cs.imagePickerIconCircle}>
                    <FontAwesome5 name="camera" size={22} color={Colors.primary} />
                  </View>
                  <Text style={cs.imagePickerLabel}>Add Group Photo</Text>
                  <Text style={cs.imagePickerSub}>Tap to choose from your library</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Name */}
            <Text style={cs.label}>Group Name *</Text>
            <View style={cs.inputRow}>
              <FontAwesome5 name="users" size={13} color={Colors.textDim} style={cs.inputIcon} />
              <TextInput
                style={cs.input}
                placeholder="e.g. Tunis Morning Runners"
                placeholderTextColor={Colors.textDim}
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                maxLength={50}
              />
            </View>

            {/* Description */}
            <Text style={cs.label}>Description</Text>
            <View style={[cs.inputRow, { alignItems: 'flex-start', paddingTop: 12 }]}>
              <FontAwesome5 name="align-left" size={13} color={Colors.textDim} style={[cs.inputIcon, { marginTop: 2 }]} />
              <TextInput
                style={[cs.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="What's this group about?"
                placeholderTextColor={Colors.textDim}
                value={description}
                onChangeText={setDescription}
                multiline
                maxLength={200}
              />
            </View>

            {/* Create button */}
            <TouchableOpacity
              style={[cs.createBtn, isBusy && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={isBusy}
              activeOpacity={0.85}
            >
              {isBusy ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={cs.createBtnText}>{uploading ? 'Uploading image…' : 'Creating…'}</Text>
                </View>
              ) : (
                <>
                  <FontAwesome5 name="plus-circle" size={16} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={cs.createBtnText}>Create Group</Text>
                </>
              )}
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const cs = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  container: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.card,
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    overflow: 'hidden',
  },
  handleArea: { width: '100%', alignItems: 'center', paddingTop: 12, paddingBottom: 6 },
  handle: { width: 44, height: 5, borderRadius: 3, backgroundColor: Colors.border },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, marginBottom: 8,
    borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 12,
  },
  headerIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.card2, justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  headerTitle: { flex: 1, color: Colors.text, fontSize: 18, fontWeight: '700' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.card2, justifyContent: 'center', alignItems: 'center',
  },

  imagePickerBtn: {
    height: 180, borderRadius: 16, overflow: 'hidden',
    marginTop: 16, marginBottom: 4,
    borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed',
  },
  imagePreviewImg: { width: '100%', height: '100%' },
  imageEditOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', gap: 6,
  },
  imageEditText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  imagePickerPlaceholder: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.card2, gap: 10,
  },
  imagePickerIconCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: `${Colors.primary}18`,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: `${Colors.primary}40`,
  },
  imagePickerLabel: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  imagePickerSub: { color: Colors.textMuted, fontSize: 12 },

  label: { color: Colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 8, marginTop: 16 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card2, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: Colors.text, fontSize: 15, paddingVertical: 14 },

  createBtn: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.primary, borderRadius: 16,
    paddingVertical: 16, marginTop: 24,
  },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
})