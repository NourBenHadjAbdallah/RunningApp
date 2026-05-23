// components/Profile/ProfileHero.tsx
import React, { useState } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image, Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FontAwesome5 } from '@expo/vector-icons'
import { router } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { decode } from 'base64-arraybuffer'
import { supabase } from '../../services/supabase'
import { Colors } from '../../constants/colors'

interface Profile {
  username: string
  full_name: string
  created_at?: string
  location?: string | null
}

interface Props {
  profile:        Profile | null
  followersCount: number
  followingCount: number
  totalRuns:      number
  avatarUrl?:     string | null
  // Self view
  isSelf?:        boolean
  onAddPost?:     () => void
  onAvatarUpdated?: (url: string) => void
  // Other user view
  isFollowing?:   boolean
  followLoading?: boolean
  onFollow?:      () => void
  onBack?:        () => void
}

function HexAvatar({
  initial, avatarUrl, isSelf, onPress, uploading,
}: {
  initial: string
  avatarUrl: string | null | undefined
  isSelf: boolean
  onPress: () => void
  uploading: boolean
}) {
  return (
    <TouchableOpacity
      onPress={isSelf ? onPress : undefined}
      activeOpacity={isSelf ? 0.8 : 1}
      style={styles.hexOuter}
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
      ) : (
        <View style={styles.hexInner}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
      )}
      {isSelf && (
        <View style={styles.cameraBadge}>
          {uploading
            ? <ActivityIndicator size="small" color="#fff" />
            : <FontAwesome5 name="camera" size={9} color="#fff" />}
        </View>
      )}
    </TouchableOpacity>
  )
}

export function ProfileHero({
  profile, followersCount, followingCount, totalRuns,
  avatarUrl,
  isSelf = true, onAddPost, onAvatarUpdated,
  isFollowing = false, followLoading = false, onFollow, onBack,
}: Props) {
  const [uploading, setUploading] = useState(false)
  const insets = useSafeAreaInsets()

  const initial =
    profile?.full_name?.[0]?.toUpperCase() ??
    profile?.username?.[0]?.toUpperCase()  ??
    '?'

  const handleAvatarPress = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access in Settings to change your profile picture.')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    })

    if (result.canceled || !result.assets?.[0]) return
    const asset = result.assets[0]
    if (!asset.base64) {
      Alert.alert('Error', 'Could not read image data.')
      return
    }

    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const mimeType = asset.mimeType ?? 'image/jpeg'
      const ext      = mimeType === 'image/png' ? 'png' : 'jpg'
      const filePath = `avatars/${user.id}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, decode(asset.base64), {
          contentType: mimeType,
          upsert: true,
        })
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

      const finalUrl = `${publicUrl}?t=${Date.now()}`

      const { error: dbError } = await supabase
        .from('profiles')
        .update({ avatar_url: finalUrl })
        .eq('id', user.id)
      if (dbError) throw dbError

      onAvatarUpdated?.(finalUrl)
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Something went wrong. Try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <View style={[styles.hero, { paddingTop: insets.top + 8 }]}>

      {/* ── Single row: avatar + name | buttons ── */}
      <View style={styles.topRow}>

        {/* Left: back arrow (other user) */}
        {!isSelf && onBack && (
          <TouchableOpacity style={styles.iconBtn} onPress={onBack} activeOpacity={0.7}>
            <FontAwesome5 name="arrow-left" size={14} color={Colors.text} />
          </TouchableOpacity>
        )}

        {/* Avatar */}
        <HexAvatar
          initial={initial}
          avatarUrl={avatarUrl}
          isSelf={isSelf}
          onPress={handleAvatarPress}
          uploading={uploading}
        />

        {/* Name + location */}
        <View style={styles.heroInfo}>
          <Text style={styles.fullName} numberOfLines={1}>
            {profile?.full_name ?? 'Runner'}
          </Text>
          {profile?.location ? (
            <Text style={styles.location} numberOfLines={1}>{profile.location}</Text>
          ) : null}
        </View>

        {/* Right: + post + gear (self only) */}
        {isSelf && (
          <View style={styles.topBarRight}>
            {onAddPost && (
              <TouchableOpacity style={styles.iconBtn} onPress={onAddPost} activeOpacity={0.7}>
                <FontAwesome5 name="plus" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push('/(tabs)/settings')}
              activeOpacity={0.7}
            >
              <FontAwesome5 name="cog" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Follow button (other user only) ── */}
      {!isSelf && onFollow && (
        <TouchableOpacity
          style={[styles.followBtn, isFollowing && styles.followingBtn]}
          onPress={onFollow}
          disabled={followLoading}
          activeOpacity={0.8}
        >
          {followLoading ? (
            <ActivityIndicator size="small" color={isFollowing ? Colors.primary : '#fff'} />
          ) : (
            <>
              <FontAwesome5
                name={isFollowing ? 'user-check' : 'user-plus'}
                size={13}
                color={isFollowing ? Colors.primary : '#fff'}
              />
              <Text style={[styles.followBtnText, isFollowing && styles.followingBtnText]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* ── Stats ── */}
      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>Following</Text>
          <Text style={styles.statValue}>{followingCount}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>Followers</Text>
          <Text style={styles.statValue}>{followersCount}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statCol}>
          <Text style={styles.statLabel}>Runs</Text>
          <Text style={styles.statValue}>{totalRuns}</Text>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  hero: {
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },

  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  iconBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.card2,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  hexOuter: {
    width: 64, height: 64,
    borderRadius: 14, borderWidth: 2, borderColor: Colors.primary,
    borderTopLeftRadius: 18, borderTopRightRadius: 6,
    borderBottomLeftRadius: 6, borderBottomRightRadius: 18,
    flexShrink: 0, overflow: 'hidden',
  },
  hexInner: {
    flex: 1,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarImg:  { width: '100%', height: '100%', resizeMode: 'cover' },
  avatarText: { color: '#fff', fontSize: 24, fontWeight: '800' },

  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.card,
  },

  heroInfo: { flex: 1, gap: 2 },
  fullName: { color: Colors.text, fontSize: 17, fontWeight: '800', lineHeight: 22 },
  location: { color: Colors.textMuted, fontSize: 12, lineHeight: 16 },

  // Follow button
  followBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: Colors.primary,
    paddingVertical: 8, borderRadius: 20,
    minWidth: 100, alignSelf: 'flex-start', paddingHorizontal: 18,
  },
  followingBtn: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary },
  followBtnText:    { color: '#fff', fontWeight: '700', fontSize: 13 },
  followingBtnText: { color: Colors.primary },

  // Stats
  statsRow:    { flexDirection: 'row', alignItems: 'center' },
  statCol:     { flex: 1, alignItems: 'flex-start', gap: 1 },
  statLabel:   { color: Colors.textMuted, fontSize: 11, fontWeight: '500' },
  statValue:   { color: Colors.text, fontSize: 19, fontWeight: '800' },
  statDivider: {
    width: 1, height: 28,
    backgroundColor: Colors.border,
    marginHorizontal: 12, alignSelf: 'center',
  },
})