import React, { useState } from 'react'
import { View, TouchableOpacity, StyleSheet, Dimensions, Text, Modal, Pressable } from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'

const PANEL_H = Dimensions.get('window').height * 0.33

interface MapActionButtonsProps {
  locating: boolean
  waypointCount: number
  onLocate: () => void
  onFit: () => void
  onUndo: () => void
  onDeleteAll: () => void
  onSave: () => void
}

export function MapActionButtons({
  locating,
  waypointCount,
  onLocate,
  onFit,
  onUndo,
  onDeleteAll,
  onSave,
}: MapActionButtonsProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <View style={styles.cluster}>
        {/* Location */}
        <TouchableOpacity style={styles.btn} onPress={onLocate} disabled={locating} activeOpacity={0.8}>
          <FontAwesome5 name={locating ? 'circle-notch' : 'crosshairs'} size={17} color="#fff" />
        </TouchableOpacity>

        {waypointCount > 1 && (
          <TouchableOpacity style={styles.btn} onPress={onFit} activeOpacity={0.8}>
            <FontAwesome5 name="compress-arrows-alt" size={15} color="#fff" />
          </TouchableOpacity>
        )}

        {waypointCount > 0 && (
          <TouchableOpacity style={styles.btn} onPress={onUndo} activeOpacity={0.8}>
            <FontAwesome5 name="undo" size={15} color="#fff" />
          </TouchableOpacity>
        )}

        {/* Three-dot menu */}
        <TouchableOpacity style={styles.btn} onPress={() => setMenuOpen(true)} activeOpacity={0.8}>
          <FontAwesome5 name="ellipsis-v" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Dropdown menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setMenuOpen(false)}>
          <View style={styles.menu}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setMenuOpen(false); onSave() }}
              activeOpacity={0.75}
            >
              <FontAwesome5 name="bookmark" size={14} color="#fff" />
              <Text style={styles.menuText}>Save route</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => { setMenuOpen(false); onDeleteAll() }}
              activeOpacity={0.75}
            >
              <FontAwesome5 name="trash-alt" size={14} color="#ff3b30" />
              <Text style={[styles.menuText, styles.menuTextDanger]}>Delete all</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
  cluster: {
    position: 'absolute',
    right: 14,
    bottom: PANEL_H + 16,
    gap: 8,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  overlay: {
    flex: 1,
  },
  menu: {
    position: 'absolute',
    right: 66,
    bottom: PANEL_H + 16,
    backgroundColor: '#1c1c1e',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
    minWidth: 160,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  menuText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  menuTextDanger: { color: '#ff3b30' },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginHorizontal: 0,
  },
})