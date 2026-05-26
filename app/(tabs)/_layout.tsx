import { useEffect, useRef } from 'react'
import { Tabs } from 'expo-router'
import { FontAwesome5 } from '@expo/vector-icons'
import { Colors } from '../../constants/colors'
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Text,
  Animated,
} from 'react-native'
import { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// ─── Export this so any screen can pad its content correctly ──────────────────
// Usage: import { TAB_BAR_HEIGHT } from './_layout'
// Then add paddingBottom: TAB_BAR_HEIGHT to your scrollable content

export const BAR_HEIGHT    = 62
export const H_MARGIN      = 16
export const CORNER        = 28
const        RUN_BTN_H     = 56
const        RUN_BTN_W     = 56

// ─── Regular Tab ───────────────────────────────────────────────────────────────

function RegularTab({
  isFocused,
  onPress,
  iconName,
  label,
}: {
  route: any
  isFocused: boolean
  onPress: () => void
  iconName: string
  label: string
}) {
  const scale       = useRef(new Animated.Value(1)).current
  const dotOpacity  = useRef(new Animated.Value(isFocused ? 1 : 0)).current
  const glowOpacity = useRef(new Animated.Value(isFocused ? 1 : 0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: isFocused ? 1.12 : 1,
        useNativeDriver: true,
        tension: 180,
        friction: 12,
      }),
      Animated.timing(dotOpacity, {
        toValue: isFocused ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(glowOpacity, {
        toValue: isFocused ? 1 : 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start()
  }, [isFocused])

  return (
    <TouchableOpacity
      style={styles.tab}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Animated.View style={[styles.iconWrap, { transform: [{ scale }] }]}>
        <Animated.View style={[styles.iconGlow, { opacity: glowOpacity }]} />
        <FontAwesome5
          name={iconName}
          size={17}
          color={isFocused ? Colors.primary : 'rgba(255,255,255,0.35)'}
        />
      </Animated.View>

      <Text style={[styles.tabLabel, isFocused ? styles.tabLabelActive : styles.tabLabelInactive]}>
        {label}
      </Text>

      <Animated.View style={[styles.activeDot, { opacity: dotOpacity }]} />
    </TouchableOpacity>
  )
}

// ─── Run Tab ───────────────────────────────────────────────────────────────────

function RunTab({
  isFocused,
  onPress,
}: {
  isFocused: boolean
  onPress: () => void
}) {
  const runScale = useRef(new Animated.Value(1)).current

  const handlePressIn = () =>
    Animated.spring(runScale, { toValue: 0.92, useNativeDriver: true, tension: 200 }).start()
  const handlePressOut = () =>
    Animated.spring(runScale, { toValue: 1, useNativeDriver: true, tension: 200 }).start()

  return (
    <View style={styles.runSlot}>
      <Animated.View style={{ transform: [{ scale: runScale }] }}>
        <TouchableOpacity
          style={styles.runBtnOuter}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
        >
          <View style={[styles.runGlowRing, isFocused && styles.runGlowRingActive]} />
          <View style={styles.runBtn}>
            <FontAwesome5 name="running" size={20} color="#fff" />
            <Text style={styles.runLabel}>RUN</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  )
}

// ─── Custom Tab Bar ────────────────────────────────────────────────────────────

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()

  // Hide the tab bar entirely on the tracking screen
  const activeRoute = state.routes[state.index]
  if (activeRoute?.name === 'track') return null

  // How much space below the pill (safe area + breathing room)
  const bottomPad = Math.max(insets.bottom, 8) + 8

  const VISIBLE = ['index', 'explore', 'track', 'route-planner', 'profile']

  const visibleRoutes = state.routes
    .filter((r) => VISIBLE.includes(r.name))
    .sort((a, b) => VISIBLE.indexOf(a.name) - VISIBLE.indexOf(b.name))

  const iconMap: Record<string, string> = {
    index:           'home',
    explore:         'compass',
    track:           'running',
    'route-planner': 'map-marked-alt',
    profile:         'user-alt',
  }
  const labelMap: Record<string, string> = {
    index:           'Feed',
    explore:         'Explore',
    track:           'Run',
    'route-planner': 'Routes',
    profile:         'Profile',
  }

  return (
    // ── Outer wrapper — transparent, floats above content ──────────────────
    <View
      style={[styles.floatingWrapper, { paddingBottom: bottomPad }]}
      pointerEvents="box-none"
    >
      {/* ── Pill container ── */}
      <View style={styles.floatingContainer}>
        {/* Frosted-glass dark fill */}
        <View style={[StyleSheet.absoluteFillObject, styles.pillBg]} />
        {/* Top highlight line */}
        <View style={styles.topHighlight} />
        {/* Inner sheen */}
        <View style={styles.innerSheen} />

        <View style={styles.bar}>
          {visibleRoutes.map((route) => {
            const isFocused = state.index === state.routes.indexOf(route)
            const isRun     = route.name === 'track'

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              })
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name)
              }
            }

            if (isRun) {
              return <RunTab key={route.key} isFocused={isFocused} onPress={onPress} />
            }

            return (
              <RegularTab
                key={route.key}
                route={route}
                isFocused={isFocused}
                onPress={onPress}
                iconName={iconMap[route.name]}
                label={labelMap[route.name]}
              />
            )
          })}
        </View>
      </View>
    </View>
  )
}

// ─── Layout ────────────────────────────────────────────────────────────────────

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"          options={{ title: 'Feed' }} />
      <Tabs.Screen name="explore"        options={{ title: 'Explore' }} />
      <Tabs.Screen name="track"          options={{ title: 'Run' }} />
      <Tabs.Screen name="route-planner"  options={{ title: 'Routes' }} />
      <Tabs.Screen name="profile"        options={{ title: 'Profile' }} />

      <Tabs.Screen name="activity"      options={{ href: null }} />
      <Tabs.Screen name="search"        options={{ href: null }} />
      <Tabs.Screen name="settings"      options={{ href: null }} />
      <Tabs.Screen name="onboarding"    options={{ href: null }} />
      <Tabs.Screen name="group-detail"  options={{ href: null }} />
      <Tabs.Screen name="create-group"  options={{ href: null }} />
    </Tabs>
  )
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // ── Outer wrapper — sits on top of screen content, transparent bg ──────────
  floatingWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: H_MARGIN,
    // NO backgroundColor here — fully transparent so content shows through
    backgroundColor: 'transparent',
    // Allow touches to pass through the transparent area around the pill
    pointerEvents: 'box-none',
  },

  // ── The pill itself ────────────────────────────────────────────────────────
  floatingContainer: {
    borderRadius: CORNER,
    overflow: 'hidden',
    // Subtle shadow so the pill lifts off the content below
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  // Semi-transparent dark background — content is visible through it
  pillBg: {
    backgroundColor: 'rgba(15,15,15,0.82)',
    borderRadius: CORNER,
  },

  topHighlight: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.14)',
    zIndex: 2,
  },
  innerSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.025)',
    zIndex: 1,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: BAR_HEIGHT,
    zIndex: 3,
  },

  // ── Regular tab ────────────────────────────────────────────────────────────
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingTop: 4,
  },
  iconWrap: {
    width: 36,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconGlow: {
    position: 'absolute',
    width: 36,
    height: 28,
    borderRadius: 10,
    backgroundColor: `${Colors.primary}28`,
  },
  tabLabel: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  tabLabelActive:   { color: Colors.primary },
  tabLabelInactive: { color: 'rgba(255,255,255,0.32)' },
  activeDot: {
    marginTop: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },

  // ── Run button ─────────────────────────────────────────────────────────────
  runSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  runGlowRing: {
    position: 'absolute',
    width: RUN_BTN_W + 16,
    height: RUN_BTN_H + 16,
    borderRadius: (RUN_BTN_H + 16) / 2,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  runGlowRingActive: {
    borderColor: `${Colors.primary}60`,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
  },
  runBtnOuter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  runBtn: {
    width: RUN_BTN_W,
    height: RUN_BTN_H,
    borderRadius: RUN_BTN_H / 2,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.55,
    shadowRadius: 12,
    elevation: 12,
  },
  runLabel: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
})