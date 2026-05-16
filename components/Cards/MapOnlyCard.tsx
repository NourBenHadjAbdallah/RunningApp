import React, { useMemo } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Svg, { Polyline as SvgPolyline, Circle } from 'react-native-svg';
import { buildStaticMapUrl, useSvgRoute } from './shared';
import { Colors } from '../../constants/colors';

const LOGO = require('../../assets/images/android-icon-negative.png');

const MapOnlyCard = (props: any) => {
  const { points, startPt, endPt } = useSvgRoute(props.route, 340, 480);
  const mapUrl = useMemo(() => buildStaticMapUrl(props.route, 700, 700), [props.route]);

  return (
    <View style={styles.container}>
      {mapUrl ? (
        <Image source={{ uri: mapUrl }} style={styles.absoluteFill} />
      ) : (
        <Svg width="100%" height="100%">
          {points && <SvgPolyline points={points} fill="none" stroke={Colors.primary} strokeWidth="5" strokeLinejoin="round" />}
          {startPt && <Circle cx={startPt.x} cy={startPt.y} r={7} fill="#22c55e" stroke="#fff" strokeWidth={2} />}
          {endPt && <Circle cx={endPt.x} cy={endPt.y} r={7} fill={Colors.primary} stroke="#fff" strokeWidth={2} />}
        </Svg>
      )}

      <View style={styles.overlay}>
        {/* Logo + app name + date */}
        <View>
          <View style={styles.brandRow}>
            <Image source={LOGO} style={styles.logo} resizeMode="contain" />
            <Text style={styles.appName}>RUNUP</Text>
          </View>
          <Text style={styles.date}>{props.date}</Text>
        </View>

        <View style={styles.distanceContainer}>
          <Text style={styles.distance}>{props.distance.toFixed(2)}</Text>
          <Text style={styles.unit}>km</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%', height: '100%', overflow: 'hidden', backgroundColor: 'transparent' },
  absoluteFill: { ...StyleSheet.absoluteFillObject },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  logo: {
    width: 36,
    height: 36,
  },
  appName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
  },
  date: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 },
  distanceContainer: { alignItems: 'flex-end' },
  distance: { color: Colors.primary, fontSize: 44, fontWeight: '900' },
  unit: { color: 'rgba(255,255,255,0.6)', fontSize: 18, fontWeight: '600' },
});

export default MapOnlyCard;