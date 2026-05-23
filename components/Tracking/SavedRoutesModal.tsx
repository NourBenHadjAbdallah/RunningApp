// components/tracking/SavedRoutesModal.tsx
// Bottom-sheet modal that lists the user's saved routes.
// Tapping a row overlays that route as a ghost polyline on the map.

import React, { memo } from 'react'
import {
  Modal, View, Text, FlatList,
  TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import type { SavedRoute } from './tracking'

interface SavedRoutesModalProps {
  visible: boolean
  routes: SavedRoute[]
  loading: boolean
  onSelect: (r: SavedRoute) => void
  onClose: () => void
}

function SavedRoutesModal({ visible, routes, loading, onSelect, onClose }: SavedRoutesModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.heading}>Saved Routes</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <FontAwesome5 name="times" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Body */}
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={styles.loader} />
          ) : routes.length === 0 ? (
            <EmptyState />
          ) : (
            <FlatList
              data={routes}
              keyExtractor={(r) => r.id}
              style={styles.list}
              ItemSeparatorComponent={Separator}
              renderItem={({ item }) => (
                <RouteRow route={item} onPress={() => onSelect(item)} />
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

const Separator = memo(function Separator() {
  return <View style={styles.sep} />
})

const RouteRow = memo(function RouteRow({
  route,
  onPress,
}: {
  route: SavedRoute
  onPress: () => void
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <FontAwesome5 name="route" size={14} color={Colors.primary} style={styles.rowIcon} />
      <View style={styles.info}>
        <Text style={styles.routeName} numberOfLines={1}>{route.name}</Text>
        <Text style={styles.routeMeta}>{route.distance_km.toFixed(2)} km</Text>
      </View>
      <FontAwesome5 name="chevron-right" size={13} color={Colors.textDim} />
    </TouchableOpacity>
  )
})

const EmptyState = memo(function EmptyState() {
  return (
    <View style={styles.empty}>
      <FontAwesome5 name="map-marked-alt" size={32} color={Colors.textDim} />
      <Text style={styles.emptyTitle}>No saved routes yet</Text>
      <Text style={styles.emptySub}>
        Plan a route in the Explore tab and save it to see it here.
      </Text>
    </View>
  )
})

SavedRoutesModal.displayName = 'SavedRoutesModal'
export default memo(SavedRoutesModal)

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end',
  },
  box: {
    backgroundColor: Colors.card, padding: 24,
    borderTopLeftRadius: 25, borderTopRightRadius: 25,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 16,
  },
  heading: { color: Colors.text, fontSize: 20, fontWeight: 'bold' },
  loader:  { marginVertical: 32 },
  list:    { maxHeight: 320 },

  sep: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, gap: 12,
  },
  rowIcon: {
    width: 36, textAlign: 'center',
    color: Colors.primary,
  },
  info:      { flex: 1 },
  routeName: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  routeMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  empty: { alignItems: 'center', paddingVertical: 36, gap: 8 },
  emptyTitle: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  emptySub: {
    color: Colors.textMuted, fontSize: 13,
    textAlign: 'center', lineHeight: 18, paddingHorizontal: 12,
  },
})