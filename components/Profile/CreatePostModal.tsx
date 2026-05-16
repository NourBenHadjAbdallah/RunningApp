// components/Profile/CreatePostModal.tsx
import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, ScrollView, ActivityIndicator, KeyboardAvoidingView,
  Platform, Alert,
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { supabase } from '../../services/supabase'
import { Group } from '../../services/activityService'

interface Props {
  visible: boolean
  onClose: () => void
  groups: Group[]
}

export function CreatePostModal({ visible, onClose, groups }: Props) {
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null)
  const [caption, setCaption]             = useState('')
  const [loading, setLoading]             = useState(false)

  const joinedGroups = groups.filter(g => g.joined)

  const reset = () => {
    setSelectedGroup(null)
    setCaption('')
    setLoading(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handlePost = async () => {
    if (!selectedGroup) {
      Alert.alert('Select a group', 'Please choose a group to post in.')
      return
    }
    if (!caption.trim()) {
      Alert.alert('Write something', 'Add some text to your post.')
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('group_posts').insert({
        group_id: selectedGroup.id,
        user_id: user?.id,
        content: caption.trim(),
      })
      if (error) throw error
      Alert.alert('Posted! 🎉', `Your post was shared in ${selectedGroup.name}.`)
      handleClose()
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to post. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconCircle}>
                <FontAwesome5 name="pen" size={13} color={Colors.primary} />
              </View>
              <Text style={styles.headerTitle}>New Post</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
              <FontAwesome5 name="times" size={15} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Group picker */}
            <Text style={styles.sectionLabel}>Post in</Text>

            {joinedGroups.length === 0 ? (
              <View style={styles.noGroupsBox}>
                <FontAwesome5 name="users" size={20} color={Colors.textMuted} />
                <Text style={styles.noGroupsText}>You haven&apos;t joined any groups yet.</Text>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.groupScroll}
              >
                {joinedGroups.map(g => {
                  const isSelected = selectedGroup?.id === g.id
                  return (
                    <TouchableOpacity
                      key={g.id}
                      style={[styles.groupChip, isSelected && styles.groupChipSelected]}
                      onPress={() => setSelectedGroup(isSelected ? null : g)}
                      activeOpacity={0.75}
                    >
                      <Text style={styles.groupChipIcon}>{g.icon}</Text>
                      <Text style={[styles.groupChipName, isSelected && styles.groupChipNameSelected]}>
                        {g.name}
                      </Text>
                      {isSelected && (
                        <FontAwesome5 name="check-circle" size={12} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            )}

            {/* Caption */}
            <Text style={styles.sectionLabel}>Caption</Text>
            <View style={styles.inputWrap}>
              <TextInput
                style={styles.input}
                placeholder="Whats on your mind?"
                placeholderTextColor={Colors.textMuted}
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={500}
                autoFocus={false}
              />
              <Text style={styles.charCount}>{caption.length}/500</Text>
            </View>

            {/* Post button */}
            <TouchableOpacity
              style={[
                styles.postBtn,
                (!selectedGroup || !caption.trim()) && styles.postBtnDisabled,
              ]}
              onPress={handlePost}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <FontAwesome5 name="paper-plane" size={15} color="#fff" />
                  <Text style={styles.postBtnText}>Post to {selectedGroup?.name ?? 'group'}</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    maxHeight: '85%',
  },
  handleBar: {
    width: 44, height: 5, borderRadius: 3,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 12, marginBottom: 4,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconCircle: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: `${Colors.primary}18`,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.card2,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },

  body: { paddingHorizontal: 20, paddingTop: 20 },

  sectionLabel: {
    color: Colors.textMuted, fontSize: 12, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: 10, marginTop: 4,
  },

  // Group chips
  groupScroll: { gap: 10, paddingBottom: 20, paddingRight: 4 },
  groupChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.card2,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  groupChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}12`,
  },
  groupChipIcon: { fontSize: 18 },
  groupChipName: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  groupChipNameSelected: { color: Colors.primary },

  noGroupsBox: {
    alignItems: 'center', gap: 8, paddingVertical: 20,
    backgroundColor: Colors.card2,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    marginBottom: 20,
  },
  noGroupsText: { color: Colors.textMuted, fontSize: 13 },

  // Input
  inputWrap: {
    backgroundColor: Colors.card2,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.border,
    padding: 14, marginBottom: 20, minHeight: 120,
  },
  input: {
    color: Colors.text, fontSize: 15, lineHeight: 22,
    flex: 1, textAlignVertical: 'top',
  },
  charCount: {
    color: Colors.textMuted, fontSize: 11,
    textAlign: 'right', marginTop: 8,
  },

  // Post button
  postBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: Colors.primary,
    borderRadius: 16, paddingVertical: 16,
  },
  postBtnDisabled: { opacity: 0.45 },
  postBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
})