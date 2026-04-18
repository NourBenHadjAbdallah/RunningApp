import React, { useEffect, useState } from 'react'
import {
  View, Text, ScrollView, TouchableOpacity,
  Image, ActivityIndicator, Linking, StyleSheet,
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { myeventsService, Event } from '../services/myeventsService'
import { Colors } from '../constants/colors'

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const event = new Date(dateStr)
  return Math.ceil((event.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

export default function TunisianEventsSection() {
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    myeventsService
      .getUpcomingEvents()
      .then(setEvents)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={Colors.primary} />
        <Text style={styles.loadingText}>Loading events…</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Could not load events</Text>
      </View>
    )
  }

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.sectionTitle}>🇹🇳 Upcoming Races</Text>
        <Text style={styles.source}>myevents.tn</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {events.map((event, i) => {
          const days = daysUntil(event.date)
          const isVerySoon = days <= 7

          return (
            <TouchableOpacity
              key={i}
              style={styles.card}
              onPress={() => Linking.openURL(event.url)}
              activeOpacity={0.85}
            >
              {event.image ? (
                <Image source={{ uri: event.image }} style={styles.poster} resizeMode="cover" />
              ) : (
                <View style={[styles.poster, styles.posterPlaceholder]}>
                  <FontAwesome5 name="running" size={28} color={Colors.textMuted} />
                </View>
              )}

              {/* Urgency badge */}
              <View style={[styles.badge, isVerySoon ? styles.badgeSoon : styles.badgeNormal]}>
                <Text style={styles.badgeText}>
                  {days === 0 ? 'TODAY' : days === 1 ? 'TOMORROW' : `${days}d`}
                </Text>
              </View>

              <View style={styles.info}>
                <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
                {event.location && (
                  <View style={styles.row}>
                    <FontAwesome5 name="map-marker-alt" size={10} color={Colors.primary} />
                    <Text style={styles.location} numberOfLines={1}>{event.location}</Text>
                  </View>
                )}
                <View style={styles.row}>
                  <FontAwesome5 name="calendar" size={10} color={Colors.textMuted} />
                  <Text style={styles.date}>{formatEventDate(event.date)}</Text>
                </View>
                <View style={styles.registerRow}>
                  <Text style={styles.registerText}>View details</Text>
                  <FontAwesome5 name="external-link-alt" size={10} color={Colors.primary} />
                </View>
              </View>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
    </View>
  )
}

const CARD_WIDTH = 200

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  loadingText: { color: Colors.textMuted, fontSize: 13 },
  errorText: { color: Colors.textMuted, fontSize: 13 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 10,
  },
  sectionTitle: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  source: { color: Colors.textMuted, fontSize: 11 },

  scroll: { paddingHorizontal: 16, gap: 12, paddingBottom: 4 },

  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  poster: { width: CARD_WIDTH, height: 120 },
  posterPlaceholder: {
    backgroundColor: Colors.card2,
    justifyContent: 'center', alignItems: 'center',
  },

  badge: {
    position: 'absolute', top: 8, right: 8,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20,
  },
  badgeSoon: { backgroundColor: Colors.danger },
  badgeNormal: { backgroundColor: 'rgba(0,0,0,0.65)' },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  info: { padding: 12, gap: 5 },
  title: { color: Colors.text, fontSize: 13, fontWeight: '700', lineHeight: 17 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  location: { color: Colors.primary, fontSize: 11, flex: 1 },
  date: { color: Colors.textMuted, fontSize: 11 },

  registerRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4,
  },
  registerText: { color: Colors.primary, fontSize: 11, fontWeight: '600' },
})