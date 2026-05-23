// components/EmptyState.tsx
import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'

interface Props {
  icon: string
  title: string
  message: string
}

export function EmptyState({ icon, title, message }: Props) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIconCircle}>
        <FontAwesome5 name={icon} size={26} color={Colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 40 },
  emptyIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.card2, justifyContent: 'center',
    alignItems: 'center', marginBottom: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  emptyTitle: { color: Colors.text, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptyText:  { color: Colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20 },
})