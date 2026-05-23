// components/RunDetailSheet.tsx
import { FontAwesome5 } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { Colors } from "../../constants/colors";
import { Activity } from "../../services/activityService";
import { formatDate, formatPace, formatTime } from "../../utils/calculations";
import RunShareCard, { RunShareCardHandle } from "../RunShareCard";

// ── Analytics sub-components ──────────────────────────────────────────────────
import { ElevationChart } from "./ElevationChart";
import { PaceChart } from "./PaceChart";
import { PaceZonesCard } from "./PaceZonesCard";
import { SplitsTable } from "./SplitsTable";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.92; // taller to fit analytics

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBoundingRegion(coords: { latitude: number; longitude: number }[]) {
  if (coords.length === 0) return null;
  const lats = coords.map((c) => c.latitude);
  const lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats),
    maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs),
    maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.008),
    longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.008),
  };
}

// ─── Detail Row ───────────────────────────────────────────────────────────────

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <FontAwesome5 name={icon} size={14} color={Colors.primary} />
      </View>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

// ─── Analytics Section Header ─────────────────────────────────────────────────

function AnalyticsSectionHeader({
  icon,
  title,
}: {
  icon: string;
  title: string;
}) {
  return (
    <View style={styles.analyticsSectionHeader}>
      <View style={styles.analyticsIconCircle}>
        <FontAwesome5 name={icon} size={12} color={Colors.primary} />
      </View>
      <Text style={styles.analyticsSectionTitle}>{title}</Text>
    </View>
  );
}

// ─── Tab pill ─────────────────────────────────────────────────────────────────

type SheetTab = "overview" | "analytics";

function SheetTabBar({
  active,
  onChange,
}: {
  active: SheetTab;
  onChange: (t: SheetTab) => void;
}) {
  return (
    <View style={styles.sheetTabBar}>
      {(["overview", "analytics"] as SheetTab[]).map((t) => (
        <TouchableOpacity
          key={t}
          style={[styles.sheetTab, active === t && styles.sheetTabActive]}
          onPress={() => onChange(t)}
          activeOpacity={0.8}
        >
          <FontAwesome5
            name={t === "overview" ? "running" : "chart-area"}
            size={11}
            color={active === t ? Colors.primary : Colors.textMuted}
          />
          <Text
            style={[
              styles.sheetTabLabel,
              active === t && styles.sheetTabLabelActive,
            ]}
          >
            {t === "overview" ? "Overview" : "Analytics"}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  activity: Activity | null;
  onClose: () => void;
}

export function RunDetailSheet({ activity, onClose }: Props) {
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const shareCardRef = useRef<RunShareCardHandle>(null);
  const [shareVisible, setShareVisible] = useState(false);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<SheetTab>("overview");

  useEffect(() => {
    if (activity) {
      setShareVisible(false);
      setActiveTab("overview");
      translateY.setValue(SHEET_HEIGHT);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    }
  }, [activity]);

  const close = () => {
    Animated.timing(translateY, {
      toValue: SHEET_HEIGHT,
      duration: 260,
      useNativeDriver: true,
    }).start(onClose);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {},
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateY.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 100 || gs.vy > 0.5) {
          close();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }).start();
        }
      },
    }),
  ).current;

  const handleSaveImage = async () => {
    setCaptureLoading(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Allow photo library access to save the image.",
        );
        return;
      }
      const uri = await shareCardRef.current!.capture();
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("Saved! 📸", "Share card saved to your Photos.");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setCaptureLoading(false);
    }
  };

  const handleShareImage = async () => {
    setCaptureLoading(true);
    try {
      const uri = await shareCardRef.current!.capture();
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert(
          "Not available",
          "Sharing is not available on this device.",
        );
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "Share your run 🏃",
      });
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setCaptureLoading(false);
    }
  };

  if (!activity) return null;

  const coords = activity.route ?? [];
  const region = getBoundingRegion(coords) ?? {
    latitude: 36.8065,
    longitude: 10.1815,
    latitudeDelta: 0.015,
    longitudeDelta: 0.015,
  };

  const hasAnalytics =
    (activity.elevation_data && activity.elevation_data.length > 0) ||
    activity.elevation_gain != null ||
    (activity.pace_data && activity.pace_data.length > 0) ||
    (activity.splits && activity.splits.length > 0) ||
    (activity.pace_zones && activity.pace_zones.length > 0);

  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      {/* Backdrop */}
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={close}
      />

      <Animated.View
        style={[styles.container, { transform: [{ translateY }] }]}
      >
        {/* Drag handle */}
        <View {...panResponder.panHandlers} style={styles.handleArea}>
          <View style={styles.handle} />
        </View>

        {/* ── Share card view ── */}
        {shareVisible ? (
          <ScrollView
            contentContainerStyle={styles.shareScroll}
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity
              style={styles.shareBack}
              onPress={() => setShareVisible(false)}
            >
              <FontAwesome5 name="arrow-left" size={14} color={Colors.text} />
              <Text style={styles.shareBackText}>Back to details</Text>
            </TouchableOpacity>

            <Text style={styles.shareHeading}>Share your run 🏃</Text>
            <Text style={styles.shareSubheading}>
              Save or send your run card
            </Text>

            <RunShareCard
              ref={shareCardRef}
              title={activity.title}
              distance={activity.distance}
              duration={activity.duration}
              pace={activity.pace}
              calories={activity.calories}
              route={coords}
              date={formatDate(activity.started_at)}
            />

            <View style={styles.shareActions}>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSaveImage}
                disabled={captureLoading}
              >
                {captureLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <FontAwesome5 name="download" size={16} color="#fff" />
                )}
                <Text style={styles.actionBtnText}>Save to Photos</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.shareBtn}
                onPress={handleShareImage}
                disabled={captureLoading}
              >
                <FontAwesome5
                  name="share-alt"
                  size={16}
                  color={Colors.primary}
                />
                <Text style={[styles.actionBtnText, { color: Colors.primary }]}>
                  Share
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          /* ── Main view ── */
          <>
            {/* Map (always visible at top) */}
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                region={region}
                scrollEnabled={false}
                zoomEnabled={false}
                rotateEnabled={false}
                pitchEnabled={false}
              >
                {coords.length > 1 && (
                  <Polyline
                    coordinates={coords}
                    strokeColor={Colors.primary}
                    strokeWidth={5}
                    lineCap="round"
                    lineJoin="round"
                  />
                )}
                {coords.length > 0 && (
                  <Marker coordinate={coords[0]} title="Start">
                    <View style={styles.startDot} />
                  </Marker>
                )}
                {coords.length > 1 && (
                  <Marker coordinate={coords[coords.length - 1]} title="Finish">
                    <View style={styles.finishDot} />
                  </Marker>
                )}
              </MapView>

              <View style={styles.mapBadge}>
                <Text style={styles.mapBadgeDist}>
                  {activity.distance.toFixed(2)}
                </Text>
                <Text style={styles.mapBadgeUnit}>km</Text>
              </View>

              <TouchableOpacity onPress={close} style={styles.mapCloseBtn}>
                <FontAwesome5 name="times" size={14} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Tab bar (only if analytics data exists) */}
            {hasAnalytics && (
              <SheetTabBar active={activeTab} onChange={setActiveTab} />
            )}

            {/* Scrollable content */}
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 48 }}
              onStartShouldSetResponder={() => false}
            >
              {/* ══ OVERVIEW TAB ══ */}
              {activeTab === "overview" && (
                <>
                  {/* Title / date */}
                  <View style={styles.header}>
                    <View style={styles.iconCircle}>
                      <FontAwesome5
                        name="running"
                        size={18}
                        color={Colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.title}>{activity.title}</Text>
                      <Text style={styles.date}>
                        {formatDate(activity.started_at)}
                      </Text>
                    </View>
                  </View>

                  {/* Main stats */}
                  <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                      <Text style={styles.statVal}>
                        {activity.distance.toFixed(2)}
                      </Text>
                      <Text style={styles.statLbl}>km</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                      <Text style={styles.statVal}>
                        {formatTime(activity.duration)}
                      </Text>
                      <Text style={styles.statLbl}>time</Text>
                    </View>
                    <View style={styles.statDivider} />
                    <View style={styles.statBox}>
                      <Text style={styles.statVal}>
                        {formatPace(activity.pace)}
                      </Text>
                      <Text style={styles.statLbl}>pace /km</Text>
                    </View>
                  </View>

                  {/* Detail rows */}
                  <View style={styles.detailCard}>
                    <DetailRow
                      icon="fire"
                      label="Calories"
                      value={`${activity.calories} kcal`}
                    />
                    <DetailRow
                      icon="route"
                      label="Distance"
                      value={`${activity.distance.toFixed(2)} km`}
                    />
                    <DetailRow
                      icon="clock"
                      label="Duration"
                      value={formatTime(activity.duration)}
                    />
                    <DetailRow
                      icon="tachometer-alt"
                      label="Avg Pace"
                      value={`${formatPace(activity.pace)} /km`}
                    />
                    {activity.elevation_gain != null && (
                      <DetailRow
                        icon="mountain"
                        label="Elev. Gain"
                        value={`${activity.elevation_gain} m`}
                      />
                    )}
                    {activity.max_elevation != null && (
                      <DetailRow
                        icon="arrow-up"
                        label="Max Elev."
                        value={`${activity.max_elevation} m`}
                      />
                    )}
                    {activity.moving_time != null && (
                      <DetailRow
                        icon="play-circle"
                        label="Moving Time"
                        value={formatTime(activity.moving_time)}
                      />
                    )}
                    {activity.fastest_split != null &&
                      activity.fastest_split > 0 && (
                        <DetailRow
                          icon="bolt"
                          label="Fastest Split"
                          value={`${formatPace(activity.fastest_split)} /km`}
                        />
                      )}
                  </View>

                  {/* Share button */}
                  <TouchableOpacity
                    style={styles.shareActivityBtn}
                    onPress={() => setShareVisible(true)}
                    activeOpacity={0.82}
                  >
                    <FontAwesome5 name="share-alt" size={16} color="#fff" />
                    <Text style={styles.shareActivityBtnText}>
                      Share this Run
                    </Text>
                  </TouchableOpacity>

                  {/* Analytics teaser (only if data & tab bar shown) */}
                  {hasAnalytics && (
                    <TouchableOpacity
                      style={styles.analyticsTeaserBtn}
                      onPress={() => setActiveTab("analytics")}
                      activeOpacity={0.82}
                    >
                      <FontAwesome5
                        name="chart-area"
                        size={15}
                        color={Colors.primary}
                      />
                      <Text style={styles.analyticsTeaserText}>
                        View Advanced Analytics
                      </Text>
                      <FontAwesome5
                        name="chevron-right"
                        size={11}
                        color={Colors.primary}
                      />
                    </TouchableOpacity>
                  )}
                </>
              )}

              {/* ══ ANALYTICS TAB ══ */}
              {activeTab === "analytics" && (
                <View style={styles.analyticsContainer}>
                  {/* ── Elevation ── */}
                  {(activity.elevation_data ||
                    activity.elevation_gain != null) && (
                    <View style={styles.analyticsBlock}>
                      <AnalyticsSectionHeader
                        icon="mountain"
                        title="Elevation"
                      />
                      <ElevationChart
                        data={activity.elevation_data ?? []}
                        elevationGain={activity.elevation_gain ?? 0}
                        maxElevation={activity.max_elevation ?? 0}
                      />
                    </View>
                  )}

                  {/* ── Pace ── */}
                  {(activity.pace_data || activity.moving_time != null) && (
                    <View style={styles.analyticsBlock}>
                      <AnalyticsSectionHeader
                        icon="tachometer-alt"
                        title="Pace"
                      />
                      <PaceChart
                        data={activity.pace_data ?? []}
                        avgPace={activity.pace}
                        movingTime={activity.moving_time ?? activity.duration}
                        fastestSplit={activity.fastest_split ?? 0}
                      />
                    </View>
                  )}

                  {/* ── Splits ── */}
                  {activity.splits && activity.splits.length > 0 && (
                    <View style={styles.analyticsBlock}>
                      <AnalyticsSectionHeader icon="list-ol" title="Splits" />
                      <SplitsTable
                        splits={activity.splits}
                        avgPace={activity.pace}
                      />
                    </View>
                  )}

                  {/* ── Pace Zones ── */}
                  {activity.pace_zones && activity.pace_zones.length > 0 && (
                    <View style={styles.analyticsBlock}>
                      <AnalyticsSectionHeader
                        icon="chart-bar"
                        title="Pace Zones"
                      />
                      <PaceZonesCard zones={activity.pace_zones} />
                    </View>
                  )}

                  {/* Empty fallback */}
                  {!hasAnalytics && (
                    <View style={styles.noAnalytics}>
                      <FontAwesome5
                        name="chart-area"
                        size={28}
                        color={Colors.textMuted}
                      />
                      <Text style={styles.noAnalyticsText}>
                        No analytics data for this run yet.
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </>
        )}
      </Animated.View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    backgroundColor: Colors.card,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: "hidden",
  },
  handleArea: {
    width: "100%",
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 6,
    zIndex: 10,
    backgroundColor: Colors.card,
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
  },

  // ── Map ──
  mapContainer: { height: 190, position: "relative" },
  map: { flex: 1 },
  mapBadge: {
    position: "absolute",
    bottom: 12,
    left: 14,
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 11,
    gap: 4,
  },
  mapBadgeDist: { color: "#fff", fontSize: 28, fontWeight: "800" },
  mapBadgeUnit: { color: "#fff", fontSize: 14 },
  mapCloseBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
  },
  startDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: "#22c55e",
    borderWidth: 2,
    borderColor: "#fff",
  },
  finishDot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: Colors.danger,
    borderWidth: 2,
    borderColor: "#fff",
  },

  // ── Tab bar ──
  sheetTabBar: {
    flexDirection: "row",
    backgroundColor: Colors.card2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sheetTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  sheetTabActive: { borderBottomColor: Colors.primary },
  sheetTabLabel: { fontSize: 13, fontWeight: "600", color: Colors.textMuted },
  sheetTabLabelActive: { color: Colors.primary },

  // ── Overview ──
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.card2,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: { color: Colors.text, fontSize: 17, fontWeight: "700" },
  date: { color: Colors.textMuted, fontSize: 13, marginTop: 2 },

  statsRow: {
    flexDirection: "row",
    margin: 14,
    backgroundColor: Colors.card2,
    borderRadius: 18,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statBox: { flex: 1, alignItems: "center" },
  statVal: { color: Colors.primary, fontSize: 20, fontWeight: "800" },
  statLbl: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  statDivider: { width: 1, backgroundColor: Colors.border },

  detailCard: {
    marginHorizontal: 14,
    backgroundColor: Colors.card2,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: Colors.card,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  detailLabel: { flex: 1, color: Colors.textMuted, fontSize: 14 },
  detailValue: { color: Colors.text, fontSize: 14, fontWeight: "600" },

  shareActivityBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.primary,
    marginHorizontal: 14,
    marginTop: 14,
    paddingVertical: 15,
    borderRadius: 16,
  },
  shareActivityBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  analyticsTeaserBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: `${Colors.primary}12`,
    marginHorizontal: 14,
    marginTop: 10,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: `${Colors.primary}30`,
  },
  analyticsTeaserText: {
    color: Colors.primary,
    fontWeight: "600",
    fontSize: 14,
    flex: 1,
    textAlign: "center",
  },

  // ── Analytics tab ──
  analyticsContainer: { paddingTop: 6, paddingBottom: 8 },
  analyticsBlock: { marginBottom: 6 },
  analyticsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 10,
  },
  analyticsIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: `${Colors.primary}18`,
    justifyContent: "center",
    alignItems: "center",
  },
  analyticsSectionTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "700",
  },

  noAnalytics: {
    alignItems: "center",
    paddingVertical: 48,
    gap: 12,
  },
  noAnalyticsText: { color: Colors.textMuted, fontSize: 14 },

  // ── Share card overlay ──
  shareScroll: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 40,
  },
  shareBack: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    marginBottom: 20,
    paddingVertical: 6,
  },
  shareBackText: { color: Colors.text, fontSize: 14, fontWeight: "600" },
  shareHeading: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
    alignSelf: "flex-start",
  },
  shareSubheading: {
    color: Colors.textMuted,
    fontSize: 13,
    marginBottom: 20,
    alignSelf: "flex-start",
  },
  shareActions: { flexDirection: "row", gap: 12, marginTop: 20, width: "100%" },
  saveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
  },
  shareBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 14,
  },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
