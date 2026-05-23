// components/Profile/TrophySection.tsx
// Profile-screen summary card — shows the 4 most recent unlocked trophies
// as hexagonal badges (like the first screenshot), then "All trophies →".

import React, { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { Activity } from '../../services/activityService'
import { computeTrophies, Trophy, TIER_COLORS } from '../../services/trophyDefinitions'
import { HexBadge } from './HexBadge'
import { TrophyModal } from './TrophyModal'

interface Props {
  activities: Activity[]
  /** Extra trophies from challenges / events — pass from the parent screen */
  extraTrophies?: Trophy[]
}

export function TrophySection({ activities, extraTrophies = [] }: Props) {
  const [modalVisible, setModalVisible] = useState(false)

  const trophies = computeTrophies(activities, extraTrophies)
  const unlocked = trophies.filter(t => t.unlocked)

  // Show up to 4 most-recently unlocked badges in the preview row
  const preview = unlocked
    .slice()
    .sort((a, b) =>
      (b.unlockedAt ? new Date(b.unlockedAt).getTime() : 0) -
      (a.unlockedAt ? new Date(a.unlockedAt).getTime() : 0)
    )
    .slice(0, 4)

  return (
    <>
      <View style={styles.section}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Trophy Case</Text>
          <Text style={styles.count}>{unlocked.length}</Text>
        </View>

        {unlocked.length === 0 ? (
          <View style={styles.emptyCard}>
            <FontAwesome5 name="trophy" size={28} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Start running to earn your first trophy!</Text>
          </View>
        ) : (
          /* Badge row — matches screenshot 1 layout */
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.badgeRow}
          >
            {preview.map(t => (
              <TouchableOpacity
                key={t.id}
                style={styles.badgeItem}
                onPress={() => setModalVisible(true)}
                activeOpacity={0.8}
              >
                <HexBadge trophy={t} size={80} />
                <Text style={styles.badgeLabel} numberOfLines={2}>
                  {t.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* "All trophies →" row */}
        <TouchableOpacity
          style={styles.allRow}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.75}
        >
          <Text style={styles.allText}>All trophies</Text>
          <FontAwesome5 name="chevron-right" size={13} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>

      <TrophyModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        trophies={trophies}
      />
    </>
  )
}

const styles = StyleSheet.create({
  section: {
    marginTop: 20,
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 16,
    overflow: 'hidden',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  title: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  count: {
    color: Colors.textMuted,
    fontSize: 18,
    fontWeight: '600',
  },

  // Badge row
  badgeRow: {
    paddingHorizontal: 12,
    gap: 6,
    paddingBottom: 8,
  },
  badgeItem: {
    alignItems: 'center',
    width: 96,
    gap: 8,
  },
  badgeLabel: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },

  // Empty state
  emptyCard: {
    alignItems: 'center',
    gap: 10,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },

  // Footer row
  allRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 4,
  },
  allText: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
})