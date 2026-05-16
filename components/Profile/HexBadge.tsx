// components/Profile/HexBadge.tsx
import React from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import Svg, { Polygon, Defs, LinearGradient, Stop, RadialGradient } from 'react-native-svg'
import { FontAwesome5 } from '@expo/vector-icons'
import { Trophy, TIER_COLORS } from '../../services/trophyDefinitions'
const AppLogo = require('../../assets/images/android-icon-negative.png');
import { Colors } from '../../constants/colors'

interface Props {
  trophy: Trophy
  size?: number
}

// ── App brand colours ──────────────────────────────────────────────────────────
const TEAL_BRIGHT = '#5bd3b8'   // Colors.primaryLight
const TEAL_MID    = '#38b89e'   // Colors.primary
const TEAL_DARK   = '#28806e'   // Colors.primaryDark

// Unlocked badge face: very dark teal-tinted navy
const FACE_DARK   = '#0a1f1c'
const FACE_MID    = '#112923'

// Locked
const LOCKED_FACE   = '#1a1a1a'
const LOCKED_BORDER = '#2e2e2e'

// ── Hex geometry ───────────────────────────────────────────────────────────────
function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 180) * (60 * i)
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
  }).join(' ')
}

export function HexBadge({ trophy, size = 72 }: Props) {
  const locked    = !trophy.unlocked
  const tierColor = TIER_COLORS[trophy.tier]

  const cx     = size / 2
  const cy     = size / 2
  const outerR = size / 2 - 1
  const innerR = outerR - size * 0.09

  const logoSize  = size * 0.2   // app logo mark at top
  const numSize   = trophy.badgeNumber && trophy.badgeNumber >= 100
    ? size * 0.2 : size * 0.30
  const iconSize  = size * 0.22

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          {/* Border: teal gradient when unlocked, flat dark when locked */}
          <LinearGradient id={`border_${trophy.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%"   stopColor={locked ? LOCKED_BORDER : TEAL_BRIGHT} />
            <Stop offset="50%"  stopColor={locked ? LOCKED_BORDER : TEAL_MID}    />
            <Stop offset="100%" stopColor={locked ? LOCKED_BORDER : TEAL_DARK}   />
          </LinearGradient>

          {/* Face: dark teal-navy radial when unlocked, dark grey when locked */}
          <RadialGradient id={`face_${trophy.id}`} cx="40%" cy="30%" r="70%">
            <Stop offset="0%"   stopColor={locked ? '#242424' : FACE_MID}  />
            <Stop offset="100%" stopColor={locked ? LOCKED_FACE : FACE_DARK} />
          </RadialGradient>

          {/* Subtle inner glow ring — only when unlocked */}
          {!locked && (
            <RadialGradient id={`glow_${trophy.id}`} cx="50%" cy="50%" r="50%">
              <Stop offset="60%" stopColor="transparent"        stopOpacity="0" />
              <Stop offset="100%" stopColor={TEAL_MID}          stopOpacity="0.18" />
            </RadialGradient>
          )}
        </Defs>

        {/* Border hex */}
        <Polygon points={hexPoints(cx, cy, outerR)} fill={`url(#border_${trophy.id})`} />

        {/* Face hex */}
        <Polygon points={hexPoints(cx, cy, innerR)} fill={`url(#face_${trophy.id})`} />

        {/* Glow ring overlay */}
        {!locked && (
          <Polygon points={hexPoints(cx, cy, innerR)} fill={`url(#glow_${trophy.id})`} />
        )}
      </Svg>

      {/* Overlaid content */}
      <View style={[StyleSheet.absoluteFill, styles.content]}>

        {/* App logo mark at the top of the badge face */}
        <Image
          source={AppLogo}
          style={[
            styles.logoMark,
            {
              width:  logoSize,
              height: logoSize,
              opacity: locked ? 0.2 : 0.85,
              tintColor: locked ? Colors.textDim : TEAL_MID,
            },
          ]}
          resizeMode="contain"
        />

        {/* Badge face: number or category icon */}
        {trophy.badgeNumber != null ? (
          <Text style={[
            styles.number,
            {
              fontSize: numSize,
              color: locked ? Colors.textDim : Colors.text,
            },
          ]}>
            {trophy.badgeNumber}
          </Text>
        ) : (
          <FontAwesome5
            name={trophy.icon}
            size={iconSize}
            color={locked ? Colors.textDim : tierColor}
          />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  logoMark: {
    position: 'absolute',
    top: '16%',
  },
  number: {
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 8,
  },
})