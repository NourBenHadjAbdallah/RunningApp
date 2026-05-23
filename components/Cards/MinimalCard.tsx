import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { formatTime, formatPace } from '../../utils/calculations';

// Adjust this path to wherever your logo lives in assets
const LOGO = require('../../assets/images/android-icon-negative.png');

interface MinimalCardProps {
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

const MinimalCard = (props: MinimalCardProps) => {
  const {
    distance,
    pace,
    duration,
    calories,
    elevGain = 0,
    maxElev = 0,
  } = props;

  const stats = [
    { label: 'Distance', value: `${distance.toFixed(2)} km` },
    { label: 'Pace',     value: `${formatPace(pace)} /km`   },
    { label: 'Time',     value: formatTime(duration)         },
    { label: 'Elev Gain',value: `${Math.round(elevGain)} m` },
    { label: 'Calories', value: `${Math.round(props.calories)} kcal` },
    { label: 'Max Elev', value: `${Math.round(maxElev)} m`  },
  ];

  return (
    <View style={styles.container}>
      {/* Brand row */}
      <View style={styles.brandRow}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.appName}>RUNUP</Text>
      </View>

      {/* Stats grid — 3 columns × 2 rows */}
      <View style={styles.grid}>
        {stats.map((s, i) => (
          <View key={i} style={styles.cell}>
            <Text style={styles.cellLabel}>{s.label}</Text>
            <Text style={styles.cellValue}>{s.value}</Text>
          </View>
        ))}
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
    marginBottom: 13,
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

  /* ── Stats grid ── */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '33%',
    marginBottom: 20,
  },
  cellLabel: {
    color: '#e7e5e5',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
    opacity: 0.9,
  },
  cellValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});

export default MinimalCard;