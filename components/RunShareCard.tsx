import React, { forwardRef, useImperativeHandle, useRef } from "react";
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Colors } from "../constants/colors";
import MapViewCard from "../components/Cards/MapViewCard";
import MainCard from "../components/Cards/MainCard";
import MapOnlyCard from "../components/Cards/MapOnlyCard";
import MinimalCard from "../components/Cards/MinimalCard";
import MapMinimalCard from '../components/Cards/MapMinimalCard';


const { width: WIN_WIDTH } = Dimensions.get("window");
export const CARD_WIDTH = WIN_WIDTH - 40;
export const CARD_HEIGHT = Math.round(CARD_WIDTH * 1.45);
const SIDE_PADDING = (WIN_WIDTH - CARD_WIDTH) / 2;
const CARD_STEP = CARD_WIDTH + SIDE_PADDING;

export type CardDesign =
  | "map-only"
  | "main"
  | "map-view"
  | "minimal"
  | "map-minimal";

export interface RunShareCardProps {
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
  steps?: number;
}

export interface RunShareCardHandle {
  /** Returns the id of the currently visible card and its ref, so the
   *  parent can capture a clean off-screen twin that lives outside the Modal. */
  getActiveId: () => CardDesign;
}

export const ALL_CARDS = [
  { id: "minimal"    as CardDesign, component: MinimalCard,   label: "Minimal",  bg: "transparent"     },
  { id: "map-minimal" as CardDesign, component: MapMinimalCard, label: "Map Minimal", bg: "transparent" },
  { id: "main"       as CardDesign, component: MainCard,      label: "Main",     bg: "transparent" },
  { id: "map-only"   as CardDesign, component: MapOnlyCard,   label: "Map Only", bg: "transparent" },
  { id: "map-view"   as CardDesign, component: MapViewCard,   label: "Map View", bg: Colors.card },

];

const RunShareCard = forwardRef<RunShareCardHandle, RunShareCardProps>(
  (props, ref) => {
    const activeIndexRef = useRef(0);

    const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / CARD_STEP);
      activeIndexRef.current = Math.max(0, Math.min(index, ALL_CARDS.length - 1));
    };

    useImperativeHandle(ref, () => ({
      getActiveId: () => ALL_CARDS[activeIndexRef.current].id,
    }));

    return (
      <View style={styles.root}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={CARD_STEP}
          decelerationRate="fast"
          contentContainerStyle={styles.scrollContent}
          contentInset={{ left: SIDE_PADDING, right: SIDE_PADDING }}
          contentOffset={{ x: -SIDE_PADDING, y: 0 }}
          contentInsetAdjustmentBehavior="never"
          onMomentumScrollEnd={handleScroll}
          onScrollEndDrag={handleScroll}
        >
          {ALL_CARDS.map(({ id, component: CardComponent, label, bg }) => (
            <View key={id} style={styles.cardWrapper}>
              <View style={[styles.cardContainer, { backgroundColor: bg }]}>
                <CardComponent {...props} />
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  root: { alignItems: "center", width: "100%", paddingVertical: 10 },
  title: { fontSize: 18, fontWeight: "700", color: Colors.text, marginBottom: 16 },
  scrollContent: { paddingVertical: 10, gap: SIDE_PADDING },
  cardWrapper: { alignItems: "center" },
  cardContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  cardLabel: { marginTop: 10, fontSize: 14, fontWeight: "600", color: Colors.textMuted },
});

RunShareCard.displayName = "RunShareCard";
export default RunShareCard;