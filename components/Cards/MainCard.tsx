import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Svg, { Polyline as SvgPolyline, Circle } from 'react-native-svg';
import { FontAwesome5 } from '@expo/vector-icons';
import { formatTime, formatPace } from '../../utils/calculations';
import { Colors } from '../../constants/colors';
import { useSvgRoute } from './shared';

const LOGO = require('../../assets/images/android-icon-negative.png');

const MainCard = (props: any) => {
  const { points, startPt, endPt } = useSvgRoute(props.route, 340, 180);

  return (
    <View style={styles.container}>
      {/* Brand row — logo + RUNUP centered */}
      <View style={styles.brandRow}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.appName}>RUNUP</Text>
      </View>

      <View style={styles.mapContainer}>
        <Svg width="100%" height="100%">
          {points && <SvgPolyline points={points} fill="none" stroke={Colors.primary} strokeWidth="3.5" strokeLinecap="round" />}
          {startPt && <Circle cx={startPt.x} cy={startPt.y} r={7} fill="#22c55e" stroke="#fff" strokeWidth={2} />}
          {endPt && <Circle cx={endPt.x} cy={endPt.y} r={7} fill={Colors.primary} stroke="#fff" strokeWidth={2} />}
        </Svg>
      </View>

      <View style={styles.distanceRow}>
        <Text style={styles.distance}>{props.distance.toFixed(2)}</Text>
        <Text style={styles.unit}>km</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <FontAwesome5 name="clock" size={18} color="#fff" />
          <Text style={styles.statValue}>{formatTime(props.duration)}</Text>
          <Text style={styles.statLabel}>TIME</Text>
        </View>
        <View style={styles.statItem}>
          <FontAwesome5 name="running" size={18} color="#fff" />
          <Text style={styles.statValue}>{formatPace(props.pace)}</Text>
          <Text style={styles.statLabel}>PACE</Text>
        </View>
        <View style={styles.statItem}>
          <FontAwesome5 name="fire-alt" size={18} color="#fff" />
          <Text style={styles.statValue}>{Math.round(props.calories)}</Text>
          <Text style={styles.statLabel}>KCAL</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent', paddingVertical: 30, alignItems: 'center' },

  /* ── Brand ── */
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logo: {
    width: 32,
    height: 32,
  },
  appName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 2,
  },

  mapContainer: { height: 180, width: '100%'},
  distanceRow: { flexDirection: 'row', alignItems: 'flex-end', marginVertical: 10 },
  distance: { color: '#fff', fontSize: 54, fontWeight: '900' },
  unit: { color: '#888', fontSize: 24, marginLeft: 8, marginBottom: 8 },
  statsRow: { flexDirection: 'row', width: '88%', justifyContent: 'space-between', marginTop: 20 },
  statItem: { alignItems: 'center', gap: 6 },
  statValue: { color: '#fff', fontSize: 17, fontWeight: '700' },
  statLabel: { color: '#888', fontSize: 9.5, fontWeight: '600' },
});

export default MainCard;