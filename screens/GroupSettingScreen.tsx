// screens/GroupSettingsScreen.tsx
import React, { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Switch,TextInput, 
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase } from '../services/supabase'
import { Colors } from '../constants/colors'

interface GroupDetail {
  id: string
  name: string
  description: string | null
  image_url: string | null
  location: string | null
  visibility: 'public' | 'private'
  member_count: number
  created_by: string
}

export default function GroupSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  
  const [group, setGroup] = useState<GroupDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOwner, setIsOwner] = useState(false)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')

  useEffect(() => {
    loadGroup()
  }, [id])

  const loadGroup = async () => {
    if (!id) return
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { data, error } = await supabase
        .from('groups')
        .select('*')
        .eq('id', id)
        .single()

      if (error || !data) throw error

      setGroup(data)
      setName(data.name)
      setDescription(data.description || '')
      setLocation(data.location || '')
      setVisibility(data.visibility || 'public')
      setIsOwner(data.created_by === user.id)
    } catch (e: any) {
      Alert.alert('Error', e.message)
      router.back()
    } finally {
      setLoading(false)
    }
  }

  const saveChanges = async () => {
    if (!id || !isOwner) return
    setSaving(true)

    try {
      const { error } = await supabase
        .from('groups')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          location: location.trim() || null,
          visibility,
        })
        .eq('id', id)

      if (error) throw error

      Alert.alert('Success', 'Group settings updated successfully', [
        { text: 'OK', onPress: () => router.back() }
      ])
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setSaving(false)
    }
  }

  const deleteGroup = () => {
    Alert.alert(
      'Delete Group',
      'This action cannot be undone. All posts and members will be removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Group',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('groups').delete().eq('id', id)
              Alert.alert('Group deleted', '', [
                { text: 'OK', onPress: () => router.replace('/(tabs)') }
              ])
            } catch (e: any) {
              Alert.alert('Error', e.message)
            }
          }
        }
      ]
    )
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  if (!group || !isOwner) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{"You don't have permission to edit this group"}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text>Go Back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <FontAwesome5 name="arrow-left" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Basic Information</Text>

          <Text style={styles.label}>Group Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Group name"
          />

          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            value={description}
            onChangeText={setDescription}
            placeholder="What is this group about?"
            multiline
            numberOfLines={4}
          />

          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="City or area"
          />

          <Text style={styles.label}>Visibility</Text>
          <View style={styles.visibilityRow}>
            <TouchableOpacity
              style={[styles.visOption, visibility === 'public' && styles.visOptionActive]}
              onPress={() => setVisibility('public')}
            >
              <FontAwesome5 name="globe-africa" size={18} color={visibility === 'public' ? '#fff' : Colors.textMuted} />
              <Text style={[styles.visText, visibility === 'public' && styles.visTextActive]}>Public</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.visOption, visibility === 'private' && styles.visOptionActive]}
              onPress={() => setVisibility('private')}
            >
              <FontAwesome5 name="lock" size={18} color={visibility === 'private' ? '#fff' : Colors.textMuted} />
              <Text style={[styles.visText, visibility === 'private' && styles.visTextActive]}>Private</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.card}>
          <Text style={styles.dangerTitle}>Danger Zone</Text>
          <TouchableOpacity style={styles.deleteBtn} onPress={deleteGroup}>
            <FontAwesome5 name="trash-alt" size={16} color="#fff" />
            <Text style={styles.deleteBtnText}>Delete Group</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity 
          style={styles.saveButton} 
          onPress={saveChanges}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

// Styles
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: Colors.textMuted, fontSize: 16 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },

  scrollContent: { padding: 16 },

  card: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  label: { color: Colors.textMuted, fontSize: 13, fontWeight: '600', marginTop: 12, marginBottom: 6 },

  input: {
    backgroundColor: Colors.card2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    color: Colors.text,
    fontSize: 15,
  },
  textarea: { height: 100, textAlignVertical: 'top' },

  visibilityRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  visOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card2,
  },
  visOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  visText: { fontWeight: '600', color: Colors.textMuted },
  visTextActive: { color: '#fff' },

  dangerTitle: { color: Colors.danger, fontWeight: '700', marginBottom: 12 },
  deleteBtn: {
    backgroundColor: Colors.danger,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  deleteBtnText: { color: '#fff', fontWeight: '700' },

  saveButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  backBtn: {
    padding: 12,
    backgroundColor: Colors.card,
    borderRadius: 8,
    marginTop: 20,
  },
})