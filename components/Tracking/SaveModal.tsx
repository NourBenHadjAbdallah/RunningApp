// components/tracking/SaveModal.tsx
// Bottom-sheet modal shown after the user stops a run.
// Lets them name the activity, save it, or discard it.

import React, { memo } from 'react'
import {
  Modal, View, Text, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, StyleSheet,
} from 'react-native'
import { Colors } from '../../constants/colors'

interface SaveModalProps {
  visible: boolean
  title: string
  saving: boolean
  onChangeTitle: (t: string) => void
  onSave: () => void
  onDiscard: () => void
}

function SaveModal({ visible, title, saving, onChangeTitle, onSave, onDiscard }: SaveModalProps) {
  const confirmDiscard = () => {
    Alert.alert('Discard run?', 'This will permanently delete your current run data.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: onDiscard },
    ])
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.heading}>Save your run</Text>

          <TextInput
            style={styles.input}
            placeholder="Activity name"
            placeholderTextColor={Colors.textDim}
            value={title}
            onChangeText={onChangeTitle}
            returnKeyType="done"
          />

          <TouchableOpacity style={styles.saveBtn} onPress={onSave} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>Save Activity</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity onPress={confirmDiscard} disabled={saving}>
            <Text style={styles.discardText}>Discard run</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

export default memo(SaveModal)
SaveModal.displayName = 'SaveModal'

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end',
  },
  box: {
    backgroundColor: Colors.card, padding: 24,
    borderTopLeftRadius: 25, borderTopRightRadius: 25,
  },
  heading: { color: Colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  input: {
    backgroundColor: Colors.card2, color: Colors.text,
    padding: 15, borderRadius: 10, marginBottom: 20,
  },
  saveBtn: {
    backgroundColor: Colors.primary, padding: 18, borderRadius: 10,
    alignItems: 'center', marginBottom: 12,
  },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  discardText: { color: Colors.textMuted, textAlign: 'center', paddingVertical: 4 },
})