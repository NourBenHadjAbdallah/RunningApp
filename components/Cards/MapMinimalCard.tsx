import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Svg, { Polyline as SvgPolyline, Circle } from 'react-native-svg';
import { formatTime, formatPace } from '../../utils/calculations';
import { Colors } from '../../constants/colors';
import { useSvgRoute } from './shared';

const LOGO = require('../../assets/images/android-icon-negative.png');

interface MapMinimalCardProps {
  title: string;
  distance: number;
  duration: number;
  pace: number;
  calories: number;
  route: { latitude: number; longitude: number }[];
  date?: string;
  username?: string;
  elevGain?: number;
  maxElev?: number;
}

const MapMinimalCard = (props: MapMinimalCardProps) => {
  const {
    distance,
    pace,
    duration,
    calories,
    elevGain = 0,
    maxElev = 0,
  } = props;

  const { points, startPt, endPt } = useSvgRoute(props.route, 160, 200);

  const stats = [
    { label: 'Distance', value: `${distance.toFixed(2)} km` },
    { label: 'Pace',     value: `${formatPace(pace)} /km`   },
    { label: 'Time',     value: formatTime(duration)         },
    { label: 'Elev Gain',value: `${Math.round(elevGain)} m` },
    { label: 'Calories', value: `${Math.round(calories)} kcal` },
    { label: 'Max Elev', value: `${Math.round(maxElev)} m`  },
  ];

  return (
    <View style={styles.container}>
      {/* Brand row */}
      <View style={styles.brandRow}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.appName}>RUNUP</Text>
      </View>

      {/* Map + Stats side by side */}
      <View style={styles.body}>
        {/* Route map — left half */}
        <View style={styles.mapContainer}>
          <Svg width="100%" height="100%">
            {points && (
              <SvgPolyline
                points={points}
                fill="none"
                stroke={Colors.primary}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {startPt && <Circle cx={startPt.x} cy={startPt.y} r={7} fill="#22c55e" stroke="#fff" strokeWidth={2} />}
            {endPt   && <Circle cx={endPt.x}   cy={endPt.y}   r={7} fill={Colors.primary} stroke="#fff" strokeWidth={2} />}
          </Svg>
        </View>

        {/* Stats grid — right half, 2 columns × 3 rows */}
        <View style={styles.grid}>
          {stats.map((s, i) => (
            <View key={i} style={styles.cell}>
              <Text style={styles.cellLabel}>{s.label}</Text>
              <Text style={styles.cellValue}>{s.value}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },

  /* ── Brand ── */
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  logo: {
    width: 52,
    height: 52,
  },
  appName: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 2,
  },

  /* ── Body row ── */
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },

  /* ── Map ── */
  mapContainer: {
    flex: 1,
    height: 200,
  },

  /* ── Stats grid — 2 cols × 3 rows ── */
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '50%',
    marginBottom: 18,
  },
  cellLabel: {
    color: '#e7e5e5',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 3,
    opacity: 0.9,
  },
  cellValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});

export default MapMinimalCard;