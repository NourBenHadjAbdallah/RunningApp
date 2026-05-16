import { FontAwesome5 } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import { router, useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { captureRef } from "react-native-view-shot";
import MapView, { Marker, Polyline } from "react-native-maps";
import RunShareCard, { RunShareCardHandle } from "../components/RunShareCard";
import { Colors } from "../constants/colors";
import { Activity, activityService } from "../services/activityService";
import { supabase } from "../services/supabase";
import { formatDate, formatPace, formatTime } from "../utils/calculations";

import { ElevationChart } from "../components/Analytics/ElevationChart";
import { PaceChart } from "../components/Analytics/PaceChart";
import { PaceZonesCard } from "../components/Analytics/PaceZonesCard";
import { SplitsTable } from "../components/Analytics/SplitsTable";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// ── 3 snap points (measured from TOP of screen) ───────────────────────────────
// SNAP_TOP    → sheet nearly full-screen (default) — analytics fully visible
// SNAP_MID    → halfway — header + stats, half the map visible
// SNAP_BOTTOM → sheet fully down — full map exposed
const SNAP_TOP    = 80;                // full sheet — analytics
const SNAP_MID    = SCREEN_H * 0.45;  // halfway — DEFAULT
const SNAP_BOTTOM = SCREEN_H * 0.78;  // mostly hidden — full map, pill above navbar

type SnapPoint = 'top' | 'mid' | 'bottom';

function getBoundingRegion(coords: { latitude: number; longitude: number }[]) {
  if (coords.length === 0) return null;
  const lats = coords.map((c) => c.latitude);
  const lngs = coords.map((c) => c.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude:  (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta:  Math.max((maxLat - minLat) * 1.4, 0.008),
    longitudeDelta: Math.max((maxLng - minLng) * 1.4, 0.008),
  };
}

// ─── Comment types ───────────────────────────────────────────────────────────

interface Comment {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles?: { username: string; full_name?: string | null; avatar_url?: string | null };
}

function normaliseProfiles<T extends { profiles?: unknown }>(rows: T[]): T[] {
  return rows.map((row) => ({
    ...row,
    profiles: Array.isArray(row.profiles) ? row.profiles[0] ?? undefined : row.profiles,
  }));
}

function CommentAvatar({ url, name }: { url?: string | null; name: string }) {
  const size = 32;
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 1.5, borderColor: Colors.border }}
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>{name[0]?.toUpperCase() ?? "?"}</Text>
    </View>
  );
}

function CommentsSection({ activityId }: { activityId: string }) {
  const [comments,    setComments]    = useState<Comment[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submitting,  setSubmitting]  = useState(false);

  const loadComments = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("comments")
      .select("id, user_id, body, created_at, profiles:profiles(username, full_name, avatar_url)")
      .eq("activity_id", activityId)
      .order("created_at", { ascending: true });
    if (data) setComments(normaliseProfiles(data) as unknown as Comment[]);
    setLoading(false);
  }, [activityId]);

  useEffect(() => { loadComments(); }, [loadComments]);

  const submit = async () => {
    const text = commentText.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("comments")
        .insert({ activity_id: activityId, user_id: user.id, body: text })
        .select("id, user_id, body, created_at, profiles:profiles(username, full_name, avatar_url)")
        .single();
      if (error) throw error;
      const normalised = normaliseProfiles([data])[0] as unknown as Comment;
      setComments((prev) => [...prev, normalised]);
      setCommentText("");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not post comment.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={cs.section}>
      <View style={cs.sectionHeader}>
        <Text style={cs.sectionTitle}>💬 Comments{comments.length > 0 ? ` (${comments.length})` : ""}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={Colors.primary} style={{ marginVertical: 16 }} />
      ) : comments.length === 0 ? (
        <View style={cs.emptyBox}>
          <Text style={cs.emptyText}>No comments yet — be the first!</Text>
        </View>
      ) : (
        <View style={cs.list}>
          {comments.map((c, idx) => {
            const cp   = c.profiles as any;
            const name = cp?.full_name?.trim() || cp?.username?.trim() || "Runner";
            const time = new Date(c.created_at).toLocaleString("en-GB", {
              day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
            });
            return (
              <View key={c.id} style={[cs.commentRow, idx < comments.length - 1 && cs.commentBorder]}>
                <CommentAvatar url={cp?.avatar_url} name={name} />
                <View style={cs.bubble}>
                  <View style={cs.meta}>
                    <Text style={cs.author}>{name}</Text>
                    <Text style={cs.time}>{time}</Text>
                  </View>
                  <Text style={cs.body}>{c.body}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={cs.inputRow}>
          <TextInput
            style={cs.input}
            placeholder="Add a comment…"
            placeholderTextColor={Colors.textMuted}
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={300}
          />
          <TouchableOpacity
            style={[cs.sendBtn, (!commentText.trim() || submitting) && cs.sendBtnOff]}
            onPress={submit}
            disabled={!commentText.trim() || submitting}
            activeOpacity={0.8}
          >
            {submitting
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={cs.sendIcon}>↑</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const cs = StyleSheet.create({
  section: { marginHorizontal: 20, marginTop: 20, marginBottom: 8, backgroundColor: Colors.card, borderRadius: 16, borderWidth: 1, borderColor: Colors.border, overflow: "hidden" },
  sectionHeader: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: Colors.border },
  sectionTitle: { color: Colors.text, fontSize: 15, fontWeight: "700" },
  emptyBox: { alignItems: "center", paddingVertical: 20 },
  emptyText: { color: Colors.textMuted, fontSize: 14 },
  list: { paddingHorizontal: 14, paddingTop: 10 },
  commentRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 10 },
  commentBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  bubble: { flex: 1, backgroundColor: Colors.card, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: Colors.border },
  meta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  author: { color: Colors.text, fontSize: 13, fontWeight: "700" },
  time: { color: Colors.textMuted, fontSize: 11 },
  body: { color: Colors.text, fontSize: 14, lineHeight: 20 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  input: { flex: 1, backgroundColor: Colors.card, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: 14, paddingVertical: 10, color: Colors.text, fontSize: 14, maxHeight: 90 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  sendBtnOff: { opacity: 0.35 },
  sendIcon: { color: "#fff", fontSize: 18, fontWeight: "800" },
});

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ActivityDetailScreen() {
  const { id, source } = useLocalSearchParams<{ id: string; source?: string }>();
  const [activity,       setActivity]       = useState<Activity | null>(null);
  const [loading,        setLoading]        = useState(true);
  const [shareModal,     setShareModal]     = useState(false);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [menuVisible,    setMenuVisible]    = useState(false);
  const [routeSaving,    setRouteSaving]    = useState(false);

  // Bottom sheet state — default: mid (halfway)
  const sheetY         = useRef(new Animated.Value(SNAP_MID)).current;
  const lastY          = useRef(SNAP_MID);
  const [snapPoint,    setSnapPoint]   = useState<SnapPoint>('mid');
  const sheetScrollRef = useRef<ScrollView>(null);

  const mapRef       = useRef<MapView>(null);
  const shareCardRef = useRef<RunShareCardHandle>(null);
  const cardViewRef  = useRef<View>(null);

  // Fetch activity data
  useEffect(() => {
    if (id) loadActivity();
  }, [id]);

  useEffect(() => {
    if (!activity || !mapRef.current) return;
    const coords = activity.route ?? [];
    if (coords.length > 1) {
      setTimeout(() => {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 120, right: 60, bottom: 80, left: 60 },
          animated: true,
        });
      }, 500);
    }
  }, [activity]);

  const loadActivity = async () => {
    setLoading(true);
    try {
      const found = await activityService.getActivityById(id);
      setActivity(found);
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Failed to load activity");
    } finally {
      setLoading(false);
    }
  };

  // Snap sheet to a named position
  const snapTo = (point: SnapPoint) => {
    const toValue = point === 'top' ? SNAP_TOP : point === 'mid' ? SNAP_MID : SNAP_BOTTOM;
    Animated.spring(sheetY, {
      toValue,
      useNativeDriver: false,
      bounciness: 3,
      speed: 20,
    }).start();
    lastY.current = toValue;
    setSnapPoint(point);
  };

  // Pan responder — ONLY on the pill handle, only activates on a real drag
  const panResponder = useRef(
    PanResponder.create({
      // Don't steal the touch on start — wait to see if it's a drag
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      // Only claim the gesture once the user has clearly dragged vertically
      onMoveShouldSetPanResponder:  (_, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dy) > 8 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        const next = lastY.current + g.dy;
        sheetY.setValue(Math.max(SNAP_TOP, Math.min(SNAP_BOTTOM, next)));
      },
      onPanResponderRelease: (_, g) => {
        const current  = lastY.current + g.dy;
        const velocity = g.vy; // positive = downward

        // Fast flick down → go one step lower
        if (velocity > 0.8) {
          if (lastY.current <= SNAP_TOP + 20)  { snapTo('mid');    return; }
          if (lastY.current <= SNAP_MID + 20)  { snapTo('bottom'); return; }
          snapTo('bottom');
          return;
        }
        // Fast flick up → go one step higher
        if (velocity < -0.8) {
          if (lastY.current >= SNAP_BOTTOM - 20) { snapTo('mid'); return; }
          if (lastY.current >= SNAP_MID    - 20) { snapTo('top'); return; }
          snapTo('top');
          return;
        }

        // Slow drag — snap to nearest point
        const distTop    = Math.abs(current - SNAP_TOP);
        const distMid    = Math.abs(current - SNAP_MID);
        const distBottom = Math.abs(current - SNAP_BOTTOM);
        const nearest    = Math.min(distTop, distMid, distBottom);
        if (nearest === distTop)      snapTo('top');
        else if (nearest === distMid) snapTo('mid');
        else                          snapTo('bottom');
      },
      onPanResponderTerminationRequest: () => false,
    })
  ).current;

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleDelete = () => {
    setMenuVisible(false);
    Alert.alert("Delete Activity", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          Alert.alert("Deleted", "Activity has been removed.");
          router.replace("/(tabs)/profile");
        },
      },
    ]);
  };

  const handleSaveRoute = async () => {
    if (!activity) return;
    setMenuVisible(false);
    Alert.prompt(
      "Save Route",
      "Give this route a name:",
      async (name) => {
        if (!name?.trim()) return;
        setRouteSaving(true);
        try {
          await activityService.saveRoute(name.trim(), activity.route ?? [], activity.distance);
          Alert.alert("Route saved! 📍", `"${name.trim()}" added to your saved routes.`);
        } catch (e: any) {
          Alert.alert("Error", e.message ?? "Could not save route.");
        } finally {
          setRouteSaving(false);
        }
      },
      "plain-text",
      activity.title,
    );
  };

  const handleSaveImage = async () => {
    setCaptureLoading(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow photo library access to save the image.");
        return;
      }
      const uri = await captureRef(cardViewRef, { format: "png", quality: 1, result: "tmpfile" });
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
      const available = await Sharing.isAvailableAsync();
      if (!available) { Alert.alert("Sharing not available on this device"); return; }
      const uri = await captureRef(cardViewRef, { format: "png", quality: 1, result: "tmpfile" });
      await Sharing.shareAsync(uri, { mimeType: "image/png" });
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setCaptureLoading(false);
    }
  };

  // ── Loading / error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!activity) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>Activity not found</Text>
      </View>
    );
  }

  const routeCoords = activity.route ?? [];
  const mapRegion = getBoundingRegion(routeCoords) ?? {
    latitude:  36.8065,
    longitude: 10.1815,
    latitudeDelta:  0.015,
    longitudeDelta: 0.015,
  };

  // Derive avatar / profile info from activity (if your Activity type exposes it)
  const profileAvatar  = (activity as any).profiles?.avatar_url ?? null;
  const profileName    = (activity as any).profiles?.full_name ?? (activity as any).profiles?.username ?? "Runner";
  const activityDate   = formatDate(activity.started_at);
  const activityTime   = new Date(activity.started_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const activityPlace  = (activity as any).location ?? null;

  return (
    <>
      {/* ── Full-screen map (always underneath) ── */}
      <View style={s.mapFull}>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          region={mapRegion}
          scrollEnabled={snapPoint === 'bottom'}
          zoomEnabled={snapPoint === 'bottom'}
          rotateEnabled={false}
          pitchEnabled={false}
          onPress={() => {
            if (snapPoint !== 'bottom') snapTo('bottom');
          }}
        >
          {routeCoords.length > 1 && (
            <Polyline
              coordinates={routeCoords}
              strokeColor={Colors.primary}
              strokeWidth={6}
              lineCap="round"
              lineJoin="round"
            />
          )}
          {routeCoords.length > 0 && (
            <Marker coordinate={routeCoords[0]} title="Start">
              <View style={s.startMarker} />
            </Marker>
          )}
          {routeCoords.length > 1 && (
            <Marker coordinate={routeCoords[routeCoords.length - 1]} title="Finish">
              <View style={s.finishMarker} />
            </Marker>
          )}
        </MapView>

        {/* Back button */}
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => {
            if (source === "home") router.replace("/(tabs)");
            else router.replace("/(tabs)/profile");
          }}
        >
          <FontAwesome5 name="chevron-left" size={16} color="#fff" />
        </TouchableOpacity>

        {/* Top-right actions */}
        <View style={s.topRightBtns}>
          <TouchableOpacity style={s.mapIconBtn} onPress={handleSaveRoute} disabled={routeSaving}>
            {routeSaving
              ? <ActivityIndicator size="small" color="#fff" />
              : <FontAwesome5 name="bookmark" size={14} color="#fff" />
            }
          </TouchableOpacity>
          <TouchableOpacity style={s.mapIconBtn} onPress={() => setMenuVisible(true)}>
            <FontAwesome5 name="ellipsis-v" size={15} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Restore sheet button — only visible when map is fully exposed */}
        {snapPoint === 'bottom' && (
          <TouchableOpacity
            style={s.restoreBtn}
            onPress={() => snapTo('mid')}
            activeOpacity={0.85}
          >
            <FontAwesome5 name="chevron-up" size={13} color="#fff" />
            <Text style={s.restoreBtnText}>Show details</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Bottom Sheet ── */}
      <Animated.View style={[s.sheet, { top: sheetY }]}>
        {/* Drag handle — pan responder only on the pill area */}
        <View {...panResponder.panHandlers} style={s.dragArea}>
          <View style={s.pill} />
        </View>

        {/* Single ScrollView — draggable when not at top, scrollable when at top */}
        <ScrollView
          ref={sheetScrollRef}
          style={s.sheetScroll}
          contentContainerStyle={s.sheetContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={snapPoint === 'top'}
          bounces={false}
          {...(snapPoint !== 'top' ? panResponder.panHandlers : {})}
        >
          {/* Row: avatar + meta */}
          <View style={s.profileRow}>
            {profileAvatar ? (
              <Image source={{ uri: profileAvatar }} style={s.avatar} />
            ) : (
              <View style={s.avatarFallback}>
                <Text style={s.avatarInitial}>{profileName[0]?.toUpperCase() ?? "R"}</Text>
              </View>
            )}
            <View style={s.profileMeta}>
              <Text style={s.profileName}>{profileName}</Text>
              <Text style={s.profileSub}>
                {activityDate}
                {activityTime ? `  ·  ${activityTime}` : ""}
                {activityPlace ? `  ·  ${activityPlace}` : ""}
              </Text>
            </View>
          </View>

          {/* Activity title */}
          <Text style={s.activityTitle} numberOfLines={2}>{activity.title}</Text>

          {/* 5-stat 2-column grid (no Steps) */}
          <View style={s.statsGrid}>
            <View style={s.statCell}>
              <Text style={s.statCellLabel}>Distance</Text>
              <Text style={s.statCellValue}>{activity.distance.toFixed(2)} km</Text>
            </View>
            <View style={s.statCell}>
              <Text style={s.statCellLabel}>Avg Pace</Text>
              <Text style={s.statCellValue}>{formatPace(activity.pace)} /km</Text>
            </View>
            <View style={s.statCell}>
              <Text style={s.statCellLabel}>Moving Time</Text>
              <Text style={s.statCellValue}>{formatTime(activity.moving_time ?? activity.duration)}</Text>
            </View>
            <View style={s.statCell}>
              <Text style={s.statCellLabel}>Elevation Gain</Text>
              <Text style={s.statCellValue}>{activity.elevation_gain ?? 0} m</Text>
            </View>
            <View style={s.statCell}>
              <Text style={s.statCellLabel}>Max Elevation</Text>
              <Text style={s.statCellValue}>{activity.max_elevation ?? 0} m</Text>
            </View>
          </View>

          {/* Analytics */}
          {(activity.elevation_data || activity.elevation_gain != null) && (
            <View style={s.analyticsBlock}>
              <Text style={s.analyticsLabel}>Elevation</Text>
              <ElevationChart
                data={activity.elevation_data ?? []}
                elevationGain={activity.elevation_gain ?? 0}
                maxElevation={activity.max_elevation ?? 0}
              />
            </View>
          )}

          {(activity.pace_data || activity.moving_time != null) && (
            <View style={s.analyticsBlock}>
              <Text style={s.analyticsLabel}>Pace</Text>
              <PaceChart
                data={activity.pace_data ?? []}
                avgPace={activity.pace}
                movingTime={activity.moving_time ?? activity.duration}
                fastestSplit={activity.fastest_split ?? 0}
              />
            </View>
          )}

          {activity.splits && activity.splits.length > 0 && (
            <View style={s.analyticsBlock}>
              <Text style={s.analyticsLabel}>Splits</Text>
              <SplitsTable splits={activity.splits} avgPace={activity.pace} />
            </View>
          )}

          {activity.pace_zones && activity.pace_zones.length > 0 && (
            <View style={s.analyticsBlock}>
              <Text style={s.analyticsLabel}>Pace Zones</Text>
              <PaceZonesCard zones={activity.pace_zones} />
            </View>
          )}

          {/* Comments */}
          <CommentsSection activityId={activity.id} />
        </ScrollView>
      </Animated.View>

      {/* ── 3-dot menu modal ── */}
      <Modal visible={menuVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={s.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={s.menuCard}>
                <Text style={s.menuTitle}>Activity options</Text>

                <TouchableOpacity style={s.menuItem} onPress={() => { setMenuVisible(false); setShareModal(true); }}>
                  <View style={[s.menuIconCircle, { backgroundColor: `${Colors.primary}20` }]}>
                    <FontAwesome5 name="share-alt" size={14} color={Colors.primary} />
                  </View>
                  <View>
                    <Text style={s.menuItemLabel}>Share Activity</Text>
                    <Text style={s.menuItemSub}>Save or share your run card</Text>
                  </View>
                </TouchableOpacity>

                <View style={s.menuDivider} />

                <TouchableOpacity style={s.menuItem} onPress={handleSaveRoute}>
                  <View style={[s.menuIconCircle, { backgroundColor: `${Colors.primary}20` }]}>
                    <FontAwesome5 name="bookmark" size={14} color={Colors.primary} />
                  </View>
                  <View>
                    <Text style={s.menuItemLabel}>Save Route</Text>
                    <Text style={s.menuItemSub}>Add this path to your saved routes</Text>
                  </View>
                </TouchableOpacity>

                <View style={s.menuDivider} />

                <TouchableOpacity style={s.menuItem} onPress={handleDelete}>
                  <View style={[s.menuIconCircle, { backgroundColor: `${Colors.danger}20` }]}>
                    <FontAwesome5 name="trash-alt" size={14} color={Colors.danger} />
                  </View>
                  <View>
                    <Text style={[s.menuItemLabel, { color: Colors.danger }]}>Delete Activity</Text>
                    <Text style={s.menuItemSub}>This cannot be undone</Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={s.menuCancelBtn} onPress={() => setMenuVisible(false)}>
                  <Text style={s.menuCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── Share card modal ── */}
      <Modal visible={shareModal} transparent animationType="fade">
        <View style={s.shareOverlay}>
          <ScrollView contentContainerStyle={s.shareScroll} showsVerticalScrollIndicator={false}>
            <TouchableOpacity style={s.closeBtn} onPress={() => setShareModal(false)}>
              <FontAwesome5 name="times" size={20} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>

            <Text style={s.shareHeading}>Share your run 🏃</Text>
            <Text style={s.shareSubheading}>Save or send your run card</Text>

            <View ref={cardViewRef} collapsable={false}>
              <RunShareCard
                ref={shareCardRef}
                title={activity.title}
                distance={activity.distance}
                duration={activity.duration}
                pace={activity.pace}
                calories={activity.calories}
                route={routeCoords}
                date={formatDate(activity.started_at)}
                elevGain={activity.elevation_gain ?? 0}
                steps={activity.steps ?? 0}
                maxElev={activity.max_elevation ?? 0}
              />
            </View>

            <View style={s.shareActions}>
              <TouchableOpacity style={s.actionBtn} onPress={handleSaveImage} disabled={captureLoading}>
                {captureLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <FontAwesome5 name="download" size={18} color="#fff" />
                }
                <Text style={s.actionBtnText}>Save to Photos</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[s.actionBtn, s.actionBtnOutline]} onPress={handleShareImage} disabled={captureLoading}>
                <FontAwesome5 name="share-alt" size={18} color={Colors.primary} />
                <Text style={[s.actionBtnText, { color: Colors.primary }]}>Share</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  center:    { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: Colors.background },
  errorText: { color: Colors.textMuted, fontSize: 17 },

  // ── Full-screen map ──
  mapFull: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.background,
  },

  // ── Map controls ──
  backBtn: {
    position: "absolute",
    top: 52,
    left: 16,
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center", alignItems: "center",
  },
  topRightBtns: {
    position: "absolute",
    top: 52, right: 16,
    flexDirection: "row", gap: 10,
  },
  mapIconBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center", alignItems: "center",
  },

  // ── Route markers ──
  startMarker:  { width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.success, borderWidth: 3, borderColor: "#fff" },
  finishMarker: { width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.danger,  borderWidth: 3, borderColor: "#fff" },

  // Restore sheet button (shown when map is fully exposed)
  restoreBtn: {
    position: "absolute",
    bottom: 110,
    alignSelf: "center",
    left: "50%",
    transform: [{ translateX: -60 }],
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
  },
  restoreBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },

  // ── Bottom Sheet ──
  sheet: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    // subtle shadow upward
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 20,
  },

  dragArea: {
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  pill: {
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
  },

  // ── Sheet scroll ──
  sheetScroll: { flex: 1 },
  sheetContent: {
    paddingHorizontal: 22,
    paddingBottom: 100, // clears the tab bar (typically ~49px + safe area)
  },

  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  avatar: {
    width: 44, height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  avatarFallback: {
    width: 44, height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: "center", alignItems: "center",
  },
  avatarInitial: { color: "#fff", fontSize: 18, fontWeight: "700" },

  profileMeta: { flex: 1 },
  profileName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  profileSub: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
    letterSpacing: 0.2,
  },

  activityTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.4,
    marginBottom: 18,
    lineHeight: 28,
  },

  // 6-stat 2-column grid
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },
  statCell: {
    width: "50%",
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  statCellLabel: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: "400",
    marginBottom: 4,
  },
  statCellValue: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.3,
  },

  // Details rows
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailText: { color: Colors.textMuted, fontSize: 14 },

  // Analytics blocks
  analyticsBlock: { paddingTop: 24, paddingHorizontal: 0 },
  analyticsLabel: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    paddingHorizontal: 22,
    marginBottom: 10,
  },

  // ── 3-dot menu ──
  menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  menuCard: { backgroundColor: Colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  menuTitle: { color: Colors.textMuted, fontSize: 12, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase", marginBottom: 20 },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 16, paddingVertical: 12 },
  menuIconCircle: { width: 42, height: 42, borderRadius: 12, justifyContent: "center", alignItems: "center" },
  menuItemLabel: { color: Colors.text, fontSize: 16, fontWeight: "600" },
  menuItemSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  menuDivider: { height: 1, backgroundColor: Colors.border, marginVertical: 4 },
  menuCancelBtn: { marginTop: 16, paddingVertical: 14, borderRadius: 14, backgroundColor: Colors.background, alignItems: "center" },
  menuCancelText: { color: Colors.textMuted, fontSize: 15, fontWeight: "600" },

  // ── Share modal ──
  shareOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.93)" },
  shareScroll: { flexGrow: 1, alignItems: "center", paddingTop: 56, paddingBottom: 48, paddingHorizontal: 20 },
  closeBtn: { alignSelf: "flex-end", padding: 8, marginBottom: 16 },
  shareHeading: { color: "#fff", fontSize: 22, fontWeight: "800", marginBottom: 4 },
  shareSubheading: { color: "rgba(255,255,255,0.5)", fontSize: 13, marginBottom: 24 },
  shareActions: { flexDirection: "row", gap: 12, marginTop: 24, width: "100%" },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 14 },
  actionBtnOutline: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: Colors.primary },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});