import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import MapView, { Polyline, Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { formatTime, formatPace } from '../../utils/calculations';
import { Colors } from '../../constants/colors';
import { getBounds } from './shared';

const LOGO = require('../../assets/images/android-icon-negative.png');

const MapViewCard = (props: any) => {
  const region = useMemo(() => {
    const bounds = getBounds(props.route);
    if (!bounds) return null;
    const latDelta = (bounds.maxLat - bounds.minLat) * 1.4;
    const lngDelta = (bounds.maxLng - bounds.minLng) * 1.4;
    return {
      latitude:  (bounds.minLat + bounds.maxLat) / 2,
      longitude: (bounds.minLng + bounds.maxLng) / 2,
      latitudeDelta:  Math.max(latDelta, 0.005),
      longitudeDelta: Math.max(lngDelta, 0.005),
    };
  }, [props.route]);

  const start = props.route?.[0];
  const end   = props.route?.[props.route.length - 1];

  return (
    <View style={styles.container}>
      <View style={styles.mapSection}>
        {region && (
          <MapView
            style={styles.absoluteFill}
            provider={PROVIDER_DEFAULT}
            initialRegion={region}
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            pointerEvents="none"
          >
            <Polyline
              coordinates={props.route}
              strokeColor={Colors.primary}
              strokeWidth={4}
            />
            {start && <Marker coordinate={start} pinColor="#22c55e" />}
            {end   && <Marker coordinate={end}   pinColor={Colors.primary} />}
          </MapView>
        )}
      </View>

      <View style={styles.infoSection}>
        {/* Brand row */}
        <View style={styles.brandRow}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
          <Text style={styles.appName}>RUNUP</Text>
        </View>

        <Text style={styles.distance}>{props.distance.toFixed(2)} km</Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatTime(props.duration)}</Text>
            <Text style={styles.statLabel}>Duration</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatPace(props.pace)}</Text>
            <Text style={styles.statLabel}>Avg Pace</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.stat}>
            <Text style={styles.statValue}>{Math.round(props.calories)}</Text>
            <Text style={styles.statLabel}>kcal</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%', height: '100%', backgroundColor: '#fff' },
  mapSection: { height: '58%', overflow: 'hidden' },
  absoluteFill: { ...StyleSheet.absoluteFillObject },
  infoSection: { padding: 24, backgroundColor: '#fff', flex: 1, justifyContent: 'space-between' },

  /* ── Brand ── */
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: 32,
    height: 32,
    tintColor: '#000',
  },
  appName: {
    color: '#000',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },

  distance: { color: '#000', fontSize: 52, fontWeight: '900' },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: '#000', fontSize: 18, fontWeight: '700' },
  statLabel: { color: '#888', fontSize: 11, marginTop: 3 },
  divider: { width: 1, height: 32, backgroundColor: '#e5e5e5' },
});

export default MapViewCard;