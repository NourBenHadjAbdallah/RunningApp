// components/Profile/ProfileTabBar.tsx
import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'

export type ProfileTab = 'stats' | 'runs' | 'routes'

interface Tab {
  key: ProfileTab
  label: string
  icon: string
}

const ALL_TABS: Tab[] = [
  { key: 'stats',  label: 'Statistics', icon: 'chart-bar'     },
  { key: 'runs',   label: 'Activities', icon: 'running'        },
  { key: 'routes', label: 'Routes',     icon: 'map-marked-alt' },
]

interface Props {
  activeTab:     ProfileTab
  onTabChange:   (tab: ProfileTab) => void
  availableTabs?: ProfileTab[]   // subset to show; defaults to all three
}

export function ProfileTabBar({ activeTab, onTabChange, availableTabs }: Props) {
  const tabs = availableTabs
    ? ALL_TABS.filter(t => availableTabs.includes(t.key))
    : ALL_TABS

  return (
    <View style={styles.tabBar}>
      {tabs.map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={[styles.tabBtn, activeTab === tab.key && styles.tabBtnActive]}
          onPress={() => onTabChange(tab.key)}
          activeOpacity={0.8}
        >
          <FontAwesome5
            name={tab.icon}
            size={13}
            color={activeTab === tab.key ? Colors.primary : Colors.textMuted}
          />
          <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderColor: Colors.border,
  },
  tabBtn: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    gap: 7, paddingVertical: 13,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabBtnActive:   { borderBottomColor: Colors.primary },
  tabLabel:       { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  tabLabelActive: { color: Colors.primary },
})