// components/tracking/ShareModal.tsx
// Full-screen modal shown after saving a run.
// Renders the RunShareCard and exposes save-to-photos / share / view-details actions.

import React, { memo } from 'react'
import {
  Modal, View, Text, ScrollView,
  TouchableOpacity, ActivityIndicator, StyleSheet, Dimensions,
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import RunShareCard, { RunShareCardHandle } from '../../components/RunShareCard'
import type { RunSnapshot } from './tracking'

const { width: SCREEN_W } = Dimensions.get('window')

interface ShareModalProps {
  visible: boolean
  data: RunSnapshot | null
  captureLoading: boolean
  shareCardRef: React.RefObject<RunShareCardHandle>
  onSaveImage: () => void
  onShareImage: () => void
  onViewActivity: () => void
  onClose: () => void
}

function ShareModal({
  visible, data, captureLoading, shareCardRef,
  onSaveImage, onShareImage, onViewActivity, onClose,
}: ShareModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.heading}>Your Run Card 🏃</Text>
          <Text style={styles.subheading}>Save or share your achievement</Text>

          {data && (
            <View style={styles.cardWrapper}>
              <RunShareCard
                ref={shareCardRef}
                title={data.title}
                distance={data.distance}
                duration={data.duration}
                pace={data.pace}
                calories={data.calories}
                route={data.route}
                elevGain={data.elevGain}
                maxElev={data.maxElev}
                steps={data.steps}
              />
            </View>
          )}

          {/* Primary actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={onSaveImage}
              disabled={captureLoading}
            >
              {captureLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <FontAwesome5 name="download" size={18} color="#fff" />
              }
              <Text style={styles.actionBtnText}>Save to Photos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnOutline]}
              onPress={onShareImage}
              disabled={captureLoading}
            >
              <FontAwesome5 name="share-alt" size={18} color={Colors.primary} />
              <Text style={[styles.actionBtnText, { color: Colors.primary }]}>Share</Text>
            </TouchableOpacity>
          </View>

          {/* Secondary links */}
          <View style={styles.secondary}>
            <TouchableOpacity onPress={onViewActivity}>
              <Text style={styles.secondaryLink}>View activity details</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.secondaryClose}>Close</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  )
}

export default memo(ShareModal)
ShareModal.displayName = 'ShareModal'

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  scroll: {
    flexGrow: 1, alignItems: 'center',
    paddingTop: 60, paddingBottom: 48, paddingHorizontal: 20,
  },
  heading: {
    color: '#fff', fontSize: 24, fontWeight: '800',
    letterSpacing: -0.5, marginBottom: 4,
  },
  subheading: { color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 28 },
  cardWrapper: {
    width: SCREEN_W - 40,
    aspectRatio: 360 / 540,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 28, width: '100%' },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14,
  },
  actionBtnOutline: {
    backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary,
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  secondary: {
    flexDirection: 'row', justifyContent: 'space-between',
    width: '100%', marginTop: 20, paddingHorizontal: 4,
  },
  secondaryLink:  { color: Colors.primary, fontSize: 14, fontWeight: '600' },
  secondaryClose: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
})