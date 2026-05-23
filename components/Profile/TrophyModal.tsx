// components/Profile/TrophyModal.tsx
// Full trophy case — categorised sections with hex-grid layout (3 per row),
// matching screenshot 2 (Milestones, Distance, Streaks, Speed…).

import React, { useState } from 'react'
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  SectionList, Platform, Dimensions,
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import { Trophy, TrophyTier, TrophyCategory, TIER_COLORS } from '../../services/trophyDefinitions'
import { HexBadge } from './HexBadge'

const { width: SW } = Dimensions.get('window')
const BADGE_SIZE    = Math.floor((SW - 32 - 48) / 3)   // 3 per row, 16px outer padding each side, 24px total gap

// ── Section order & labels ─────────────────────────────────────────────────────

const SECTION_ORDER: TrophyCategory[] = [
  'milestone', 'distance', 'streak', 'speed', 'consistency', 'challenge', 'event',
]
const SECTION_LABELS: Record<TrophyCategory, string> = {
  milestone:   'Milestones',
  distance:    'Distance',
  streak:      'Streaks',
  speed:       'Speed',
  consistency: 'Consistency',
  challenge:   'Challenges',
  event:       'Events',
}
const SECTION_ICONS: Record<TrophyCategory, string> = {
  milestone:   'flag-checkered',
  distance:    'road',
  streak:      'fire',
  speed:       'tachometer-alt',
  consistency: 'calendar-check',
  challenge:   'dumbbell',
  event:       'running',
}

// ── Helper: chunk array into rows of N ────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < arr.length; i += size) rows.push(arr.slice(i, i + size))
  return rows
}

// ── Badge grid row ─────────────────────────────────────────────────────────────

function BadgeRow({ items }: { items: (Trophy | null)[] }) {
  return (
    <View style={styles.badgeRow}>
      {items.map((t, i) =>
        t ? (
          <View key={t.id} style={styles.badgeCell}>
            <HexBadge trophy={t} size={BADGE_SIZE} />
            <Text style={[styles.badgeLabel, !t.unlocked && styles.badgeLabelLocked]} numberOfLines={2}>
              {t.title}
            </Text>
          </View>
        ) : (
          <View key={`empty_${i}`} style={styles.badgeCell} />
        )
      )}
    </View>
  )
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({ category, count, total }: {
  category: TrophyCategory
  count: number
  total: number
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <FontAwesome5 name={SECTION_ICONS[category]} size={13} color={Colors.primary} />
        <Text style={styles.sectionTitle}>{SECTION_LABELS[category]}</Text>
      </View>
      <Text style={styles.sectionCount}>{count}/{total}</Text>
    </View>
  )
}

// ── Main modal ─────────────────────────────────────────────────────────────────

interface Props {
  visible: boolean
  onClose: () => void
  trophies: Trophy[]
}

type FilterStatus = 'all' | 'unlocked' | 'locked'

export function TrophyModal({ visible, onClose, trophies }: Props) {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')

  const unlocked = trophies.filter(t => t.unlocked).length
  const total    = trophies.length

  // Build sections
  const sections = SECTION_ORDER
    .map(cat => {
      const all = trophies.filter(t => t.category === cat)
      if (!all.length) return null
      const filtered = all.filter(t => {
        if (filterStatus === 'unlocked') return t.unlocked
        if (filterStatus === 'locked')   return !t.unlocked
        return true
      })
      // Sort: unlocked first, then by badgeNumber or alphabetically
      const sorted = [...filtered].sort((a, b) => {
        if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1
        if (a.badgeNumber != null && b.badgeNumber != null) return a.badgeNumber - b.badgeNumber
        return a.title.localeCompare(b.title)
      })
      if (!sorted.length) return null
      // Pad to fill last row
      const rows = chunk(sorted, 3)
      const lastRow = rows[rows.length - 1]
      while (lastRow.length < 3) lastRow.push(null as any)
      return {
        key: cat,
        category: cat,
        unlockedCount: all.filter(t => t.unlocked).length,
        totalCount: all.length,
        data: rows,
      }
    })
    .filter(Boolean) as {
      key: TrophyCategory
      category: TrophyCategory
      unlockedCount: number
      totalCount: number
      data: (Trophy | null)[][]
    }[]

  const STATUS_FILTERS: { key: FilterStatus; label: string }[] = [
    { key: 'all',      label: 'All'    },
    { key: 'unlocked', label: 'Earned' },
    { key: 'locked',   label: 'Locked' },
  ]

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <FontAwesome5 name="trophy" size={14} color="#38b89e" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Trophy Case</Text>
                <Text style={styles.headerSub}>{unlocked} of {total} earned</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <FontAwesome5 name="times" size={15} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Overall progress bar */}
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round((unlocked / total) * 100)}%` as any }]} />
            </View>
            <Text style={styles.progressLabel}>{Math.round((unlocked / total) * 100)}%</Text>
          </View>

          {/* Status filter */}
          <View style={styles.filterRow}>
            {STATUS_FILTERS.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, filterStatus === f.key && styles.filterChipActive]}
                onPress={() => setFilterStatus(f.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterText, filterStatus === f.key && styles.filterTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Section list */}
          <SectionList
            sections={sections}
            keyExtractor={(_, index) => String(index)}
            renderSectionHeader={({ section }) => (
              <SectionHeader
                category={section.category}
                count={section.unlockedCount}
                total={section.totalCount}
              />
            )}
            renderItem={({ item }) => <BadgeRow items={item} />}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={false}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <FontAwesome5 name="trophy" size={30} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No trophies match this filter.</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '94%',
  },
  handle: {
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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: 'rgba(56,184,158,0.15)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(56,184,158,0.35)',
  },
  headerTitle: { color: Colors.text, fontSize: 18, fontWeight: '800' },
  headerSub:   { color: Colors.textMuted, fontSize: 12, marginTop: 1 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.card2,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },

  // Progress
  progressWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6,
  },
  progressTrack: {
    flex: 1, height: 6, backgroundColor: Colors.border,
    borderRadius: 3, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: '#38b89e',
    borderRadius: 3, minWidth: 4,
  },
  progressLabel: { color: '#38b89e', fontSize: 12, fontWeight: '700', width: 34, textAlign: 'right' },

  // Filter
  filterRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  filterChip: {
    flex: 1, paddingVertical: 8, borderRadius: 10,
    backgroundColor: Colors.card2,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText:       { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#fff' },

  // Section
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, paddingHorizontal: 2,
  },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { color: Colors.text, fontSize: 15, fontWeight: '700' },
  sectionCount: { color: Colors.textMuted, fontSize: 13 },

  // Badge grid
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 12,
    marginBottom: 20,
  },
  badgeCell: {
    width: BADGE_SIZE,
    alignItems: 'center',
    gap: 8,
  },
  badgeLabel: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 16,
  },
  badgeLabelLocked: { color: Colors.textMuted },

  // Empty
  emptyWrap: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
})