// components/tracking/BattleZoneLayer.tsx
//
// Renders all Battle Zone hex territories directly inside a <MapView>.
// Each hex is a <Polygon> coloured by ownership:
//   • Current user  → vibrant green with solid fill
//   • Enemy         → red with translucent fill
//   • Unclaimed     → faint white outline only
//
// Owner names are shown via <Marker> components with a custom callout label
// centred on each hex.
//
// Drop this component INSIDE your <MapView> as a child:
//
//   <MapView ...>
//     <BattleZoneLayer zones={zones} currentUserId={uid} />
//     <Polyline ... />
//   </MapView>

import React, { memo, useMemo } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Polygon, Marker } from 'react-native-maps'
import { BattleZone, hexCorners } from '../../services/battleZoneService'
import { Colors } from '../../constants/colors'

// ─── Palette ──────────────────────────────────────────────────────────────────

const COLOR_MINE    = Colors.primary          // #38B89E or similar
const COLOR_ENEMY   = '#ef4444'
const COLOR_NEUTRAL = 'rgba(255,255,255,0.15)'

// ─── Props ────────────────────────────────────────────────────────────────────

interface BattleZoneLayerProps {
  zones: BattleZone[]
  currentUserId: string | null
}

// ─── Helper: derive visual config for a zone ──────────────────────────────────

function zoneStyle(zone: BattleZone, currentUserId: string | null) {
  if (!zone.owner_id) {
    return {
      fillColor:   'rgba(255,255,255,0.04)',
      strokeColor: COLOR_NEUTRAL,
      strokeWidth: 1,
      showLabel:   false,
    }
  }
  const isMe = zone.owner_id === currentUserId
  return {
    fillColor:   isMe ? 'rgba(56,184,158,0.28)' : 'rgba(239,68,68,0.22)',
    strokeColor: isMe ? COLOR_MINE : COLOR_ENEMY,
    strokeWidth: isMe ? 2 : 1.5,
    showLabel:   true,
  }
}

// ─── Single hex cell ──────────────────────────────────────────────────────────

const HexCell = memo(function HexCell({
  zone,
  currentUserId,
}: {
  zone: BattleZone
  currentUserId: string | null
}) {
  const corners = useMemo(
    () => hexCorners(zone.center_lat, zone.center_lng),
    [zone.center_lat, zone.center_lng],
  )

  const style = zoneStyle(zone, currentUserId)

  return (
    <>
      <Polygon
        coordinates={corners}
        fillColor={style.fillColor}
        strokeColor={style.strokeColor}
        strokeWidth={style.strokeWidth}
      />

      {style.showLabel && (
        <Marker
          coordinate={{ latitude: zone.center_lat, longitude: zone.center_lng }}
          anchor={{ x: 0.5, y: 0.5 }}
          tracksViewChanges={false}
          flat
        >
          <OwnerLabel
            name={zone.owner_name ?? '?'}
            isMe={zone.owner_id === currentUserId}
            captureCount={zone.capture_count}
            defenseLevel={zone.defense_level ?? 1}
          />
        </Marker>
      )}
    </>
  )
})

// ─── Owner label bubble ───────────────────────────────────────────────────────

const OwnerLabel = memo(function OwnerLabel({
  name,
  isMe,
  captureCount,
  defenseLevel,
}: {
  name: string
  isMe: boolean
  captureCount: number
  defenseLevel: number
}) {
  // Abbreviate long names so they fit in the hex
  const display = name.length > 8 ? name.slice(0, 7) + '…' : name
  const borderColor = isMe ? COLOR_MINE : COLOR_ENEMY

  // Shield icons: one per defense level, capped at 5 for space
  const shields = Math.min(defenseLevel, 5)

  return (
    <View style={[styles.label, { borderColor }]}>
      <Text style={[styles.labelName, { color: isMe ? COLOR_MINE : COLOR_ENEMY }]}>
        {display}
      </Text>
      {/* Defense level indicator */}
      <View style={styles.shieldRow}>
        {Array.from({ length: shields }).map((_, i) => (
          <Text key={i} style={styles.shieldIcon}>🛡</Text>
        ))}
        {defenseLevel > 5 && (
          <Text style={[styles.labelCount, { color: isMe ? COLOR_MINE : COLOR_ENEMY }]}>
            +{defenseLevel - 5}
          </Text>
        )}
      </View>
      {captureCount > 1 && (
        <Text style={[styles.labelCount, { color: isMe ? COLOR_MINE : COLOR_ENEMY }]}>
          ×{captureCount}
        </Text>
      )}
    </View>
  )
})

// ─── Layer ────────────────────────────────────────────────────────────────────

function BattleZoneLayer({ zones, currentUserId }: BattleZoneLayerProps) {
  // Only render owned cells to keep Polygon count low on free-ride maps.
  // Neutral cells are very faint and we still render them for ambience —
  // but cap neutral cells to 200 to avoid frame drops.
  const ownedZones   = useMemo(() => zones.filter((z) => z.owner_id),        [zones])
  const neutralZones = useMemo(
    () => zones.filter((z) => !z.owner_id).slice(0, 200),
    [zones],
  )

  return (
    <>
      {neutralZones.map((z) => (
        <HexCell key={z.cell_id} zone={z} currentUserId={currentUserId} />
      ))}
      {ownedZones.map((z) => (
        <HexCell key={z.cell_id} zone={z} currentUserId={currentUserId} />
      ))}
    </>
  )
}

export default memo(BattleZoneLayer)
BattleZoneLayer.displayName = 'BattleZoneLayer'

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  label: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
    minWidth: 40,
  },
  labelName: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  shieldRow: {
    flexDirection: 'row',
    gap: 1,
    marginTop: 1,
  },
  shieldIcon: {
    fontSize: 7,
    lineHeight: 9,
  },
  labelCount: {
    fontSize: 8,
    fontWeight: '600',
    opacity: 0.8,
  },
})