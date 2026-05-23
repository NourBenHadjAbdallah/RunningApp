// components/tracking/ActivityTypePicker.tsx
//
// Full-screen bottom-sheet shown when the user first lands on the Tracking tab
// (before any activity has started). They pick Run, Walk, or Ride, then the
// sheet dismisses and tracking becomes available.
//
// Usage in TrackingScreen:
//
//   const [activityType, setActivityType] = useState<ActivityType | null>(null)
//
//   <ActivityTypePicker
//     visible={!activityType}
//     onSelect={setActivityType}
//   />

import React, { memo, useRef, useEffect } from 'react'
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
} from 'react-native'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'

// ─── Public type (re-export so TrackingScreen can import from one place) ───────

export type ActivityType = 'run' | 'walk' | 'ride'

export interface ActivityTypeConfig {
  type: ActivityType
  label: string
  icon: string          // FontAwesome5 name
  description: string
  defaultTitle: string  // pre-filled into SaveModal
  color: string
  accentBg: string      // subtle tint for the icon circle
}

export const ACTIVITY_CONFIGS: ActivityTypeConfig[] = [
  {
    type: 'run',
    label: 'Run',
    icon: 'running',
    description: 'Track pace, splits & elevation',
    defaultTitle: 'Morning Run',
    color: Colors.primary,
    accentBg: 'rgba(56,184,158,0.15)',
  },
  {
    type: 'walk',
    label: 'Walk',
    icon: 'walking',
    description: 'Steps, distance & calories',
    defaultTitle: 'Afternoon Walk',
    color: '#60a5fa',   // sky-blue accent
    accentBg: 'rgba(96,165,250,0.15)',
  },
  {
    type: 'ride',
    label: 'Ride',
    icon: 'bicycle',
    description: 'Speed, distance & route',
    defaultTitle: 'Bike Ride',
    color: '#f59e0b',   // amber accent
    accentBg: 'rgba(245,158,11,0.15)',
  },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface ActivityTypePickerProps {
  visible: boolean
  onSelect: (type: ActivityType) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

function ActivityTypePicker({ visible, onSelect }: ActivityTypePickerProps) {
  // Staggered entrance animations for each card
  const anims = useRef(ACTIVITY_CONFIGS.map(() => new Animated.Value(0))).current

  useEffect(() => {
    if (visible) {
      Animated.stagger(
        80,
        anims.map((anim) =>
          Animated.spring(anim, {
            toValue: 1,
            useNativeDriver: true,
            damping: 14,
            stiffness: 120,
          })
        )
      ).start()
    } else {
      anims.forEach((a) => a.setValue(0))
    }
  }, [visible])

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Handle bar */}
          <View style={styles.handle} />

          {/* Header */}
          <Text style={styles.heading}>What are you doing?</Text>
          <Text style={styles.subheading}>Choose your activity to get started</Text>

          {/* Activity cards */}
          <View style={styles.cards}>
            {ACTIVITY_CONFIGS.map((cfg, idx) => (
              <Animated.View
                key={cfg.type}
                style={{
                  opacity: anims[idx],
                  transform: [
                    {
                      translateY: anims[idx].interpolate({
                        inputRange: [0, 1],
                        outputRange: [30, 0],
                      }),
                    },
                  ],
                }}
              >
                <ActivityCard config={cfg} onPress={() => onSelect(cfg.type)} />
              </Animated.View>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  )
}

// ─── Activity card ────────────────────────────────────────────────────────────

interface ActivityCardProps {
  config: ActivityTypeConfig
  onPress: () => void
}

const ActivityCard = memo(function ActivityCard({ config, onPress }: ActivityCardProps) {
  const scale = useRef(new Animated.Value(1)).current

  const onPressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40 }).start()
  const onPressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start()

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={styles.card}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        {/* Icon circle */}
        <View style={[styles.iconCircle, { backgroundColor: config.accentBg }]}>
          <FontAwesome5 name={config.icon} size={26} color={config.color} />
        </View>

        {/* Labels */}
        <View style={styles.cardText}>
          <Text style={styles.cardLabel}>{config.label}</Text>
          <Text style={styles.cardDesc}>{config.description}</Text>
        </View>

        {/* Arrow */}
        <View style={[styles.arrow, { backgroundColor: config.accentBg }]}>
          <FontAwesome5 name="chevron-right" size={12} color={config.color} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  )
})

export default memo(ActivityTypePicker)
ActivityTypePicker.displayName = 'ActivityTypePicker'

// ─── Styles ───────────────────────────────────────────────────────────────────

const { height: SCREEN_H } = Dimensions.get('window')

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 40,
    // cap height on tall phones
    maxHeight: SCREEN_H * 0.65,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    marginBottom: 24,
  },
  heading: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  subheading: {
    color: Colors.textMuted,
    fontSize: 14,
    marginBottom: 28,
  },
  cards: {
    gap: 12,
  },

  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card2 ?? 'rgba(255,255,255,0.06)',
    borderRadius: 18,
    padding: 18,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  iconCircle: {
    width: 54,
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardText: {
    flex: 1,
  },
  cardLabel: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 3,
  },
  cardDesc: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  arrow: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
})