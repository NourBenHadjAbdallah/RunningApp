// screens/PublicProfileScreen.tsx
import { FontAwesome5 } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { Colors } from "../constants/colors";
import { Activity } from "../services/activityService";
import { followService, PublicProfile } from "../services/followService";
import { supabase } from "../services/supabase";
import { formatDate, formatPace, formatTime } from "../utils/calculations";

// Extend PublicProfile to include avatar_url
interface ExtendedPublicProfile extends PublicProfile {
  avatar_url?: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function avgPace(activities: Activity[]): string {
  const valid = activities.filter((a) => a.pace > 0);
  if (!valid.length) return "--'--\"";
  return formatPace(valid.reduce((s, a) => s + a.pace, 0) / valid.length);
}

// ─── Follower/Following Modal ─────────────────────────────────────────────────

function PeopleListModal({
  visible,
  title,
  profiles,
  onClose,
  onPressProfile,
}: {
  visible: boolean;
  title: string;
  profiles: ExtendedPublicProfile[];
  onClose: () => void;
  onPressProfile: (id: string) => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={modal.overlay}>
        <View style={modal.sheet}>
          <View style={modal.header}>
            <Text style={modal.title}>{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <FontAwesome5 name="times" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {profiles.length === 0 ? (
            <View style={modal.empty}>
              <FontAwesome5
                name="user-friends"
                size={28}
                color={Colors.textMuted}
              />
              <Text style={modal.emptyText}>No one here yet</Text>
            </View>
          ) : (
            <FlatList
              data={profiles}
              keyExtractor={(p) => p.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 32 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={modal.row}
                  onPress={() => {
                    onClose();
                    onPressProfile(item.id);
                  }}
                  activeOpacity={0.75}
                >
                  <View style={modal.avatar}>
                    {item.avatar_url ? (
                      <Image
                        source={{ uri: item.avatar_url }}
                        style={modal.avatarImg}
                      />
                    ) : (
                      <Text style={modal.avatarText}>
                        {item.username?.[0]?.toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={modal.rowName}>
                      {item.full_name ?? item.username}
                    </Text>
                    <Text style={modal.rowUser}>@{item.username}</Text>
                  </View>
                  <FontAwesome5
                    name="chevron-right"
                    size={12}
                    color={Colors.textMuted}
                  />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [profile, setProfile] = useState<ExtendedPublicProfile | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [isSelf, setIsSelf] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [listModal, setListModal] = useState<{
    title: string;
    profiles: ExtendedPublicProfile[];
  } | null>(null);
  const [listLoading, setListLoading] = useState(false);

  // ── Load Profile ───────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const meId = await followService.currentUserId();
      setCurrentUserId(meId);

      const targetId = id || meId;

      if (!targetId) {
        Alert.alert("Error", "Unable to load profile");
        return;
      }

      const [profData, { data: actsData }, following] = await Promise.all([
        followService.getPublicProfile(targetId),
        supabase
          .from("activities")
          .select("*")
          .eq("user_id", targetId)
          .order("created_at", { ascending: false })
          .limit(20),
        followService.isFollowing(targetId).catch(() => false),
      ]);

      const prof = profData as ExtendedPublicProfile | null;

      setProfile(prof);
      setActivities((actsData as Activity[]) ?? []);
      setIsSelf(meId === targetId);
      setIsFollowing(following);
    } catch (e: any) {
      console.error("Profile load error:", e);
      Alert.alert("Error", e.message ?? "Failed to load profile");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  // ── Follow Toggle ──────────────────────────────────────────────────────────
  const handleFollow = async () => {
    if (!profile || isSelf) return;

    setFollowLoading(true);
    try {
      const next = await followService.toggle(profile.id, isFollowing);
      setIsFollowing(next);
      setProfile((prev) =>
        prev
          ? { ...prev, follower_count: prev.follower_count + (next ? 1 : -1) }
          : prev,
      );
    } catch (e: any) {
      Alert.alert("Error", e.message ?? "Failed to update follow");
    } finally {
      setFollowLoading(false);
    }
  };

  // ── List Modals ────────────────────────────────────────────────────────────
  const openFollowers = async () => {
    if (!profile) return;
    setListLoading(true);
    try {
      const list = await followService.getFollowers(profile.id);
      setListModal({
        title: "Followers",
        profiles: list as ExtendedPublicProfile[],
      });
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setListLoading(false);
    }
  };

  const openFollowing = async () => {
    if (!profile) return;
    setListLoading(true);
    try {
      const list = await followService.getFollowing(profile.id);
      setListModal({
        title: "Following",
        profiles: list as ExtendedPublicProfile[],
      });
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setListLoading(false);
    }
  };

  // ── Fixed Navigation ───────────────────────────────────────────────────────
  const navigateToProfile = (profileId: string) => {
    if (!profileId) return;

    if (profileId === currentUserId) {
      // Navigate to your own profile screen - CHANGE THIS PATH if needed
      router.push("/(tabs)/profile");
    } else {
      // Navigate to public profile using dynamic route
      // navigate directly to the resolved path to satisfy router types
      router.push(`/profile/${profileId}` as any);
    }
  };

  // ── Render Activity ────────────────────────────────────────────────────────
  const renderActivity = ({ item }: { item: Activity }) => (
    <TouchableOpacity
      style={styles.activityCard}
      activeOpacity={0.8}
      onPress={() => router.push(`/activity/${item.id}` as any)}
    >
      <View style={styles.activityIconCircle}>
        <FontAwesome5 name="running" size={16} color={Colors.primary} />
      </View>
      <View style={styles.activityMiddle}>
        <Text style={styles.activityTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.activityDate}>{formatDate(item.started_at)}</Text>
      </View>
      <View style={styles.activityRight}>
        <Text style={styles.activityDistance}>
          {item.distance.toFixed(2)} km
        </Text>
        <Text style={styles.activityTime}>{formatTime(item.duration)}</Text>
        <Text style={styles.activityPace}>{formatPace(item.pace)} /km</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Profile not found</Text>
        <TouchableOpacity
          style={styles.backBtnFull}
          onPress={() => router.back()}
        >
          <Text style={styles.backBtnText}>Go back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const initials = profile.username?.[0]?.toUpperCase() ?? "?";

  const ListHeader = (
    <View>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <FontAwesome5 name="arrow-left" size={16} color={Colors.text} />
      </TouchableOpacity>

      <View style={styles.hero}>
        <View style={styles.avatarWrap}>
          {profile.avatar_url ? (
            <Image
              source={{ uri: profile.avatar_url }}
              style={styles.avatarImg}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
        </View>

        <Text style={styles.fullName}>
          {profile.full_name ?? profile.username}
        </Text>
        <Text style={styles.username}>@{profile.username}</Text>

        {!isSelf && (
          <TouchableOpacity
            style={[styles.followBtn, isFollowing && styles.followingBtn]}
            onPress={handleFollow}
            disabled={followLoading}
          >
            {followLoading ? (
              <ActivityIndicator
                size="small"
                color={isFollowing ? Colors.primary : "#fff"}
              />
            ) : (
              <>
                <FontAwesome5
                  name={isFollowing ? "user-check" : "user-plus"}
                  size={13}
                  color={isFollowing ? Colors.primary : "#fff"}
                />
                <Text
                  style={[
                    styles.followBtnText,
                    isFollowing && styles.followingBtnText,
                  ]}
                >
                  {isFollowing ? "Following" : "Follow"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        <View style={styles.followRow}>
          <TouchableOpacity
            style={styles.followItem}
            onPress={openFollowers}
            disabled={listLoading}
          >
            <Text style={styles.followCount}>
              {profile.follower_count ?? 0}
            </Text>
            <Text style={styles.followLabel}>Followers</Text>
          </TouchableOpacity>
          <View style={styles.followDivider} />
          <TouchableOpacity
            style={styles.followItem}
            onPress={openFollowing}
            disabled={listLoading}
          >
            <Text style={styles.followCount}>
              {profile.following_count ?? 0}
            </Text>
            <Text style={styles.followLabel}>Following</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {profile.total_distance?.toFixed(1) ?? "0"}
          </Text>
          <Text style={styles.statLabel}>Total km</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{profile.total_runs ?? 0}</Text>
          <Text style={styles.statLabel}>Runs</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{avgPace(activities)}</Text>
          <Text style={styles.statLabel}>Avg pace</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Recent Runs</Text>
    </View>
  );

  return (
    <>
      <FlatList
        data={activities}
        keyExtractor={(a) => a.id}
        renderItem={renderActivity}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIconCircle}>
              <FontAwesome5 name="running" size={28} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>No runs yet</Text>
            <Text style={styles.emptyText}>
              This runner hasnt logged any activities
            </Text>
          </View>
        }
        contentContainerStyle={{
          paddingBottom: 60,
          backgroundColor: Colors.background,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      />

      {listModal && (
        <PeopleListModal
          visible
          title={listModal.title}
          profiles={listModal.profiles}
          onClose={() => setListModal(null)}
          onPressProfile={navigateToProfile}
        />
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.background,
    gap: 16,
  },
  errorText: { color: Colors.textMuted, fontSize: 17 },
  backBtnFull: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backBtnText: { color: Colors.text, fontWeight: "600" },

  backBtn: {
    margin: 16,
    marginTop: 56,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    alignSelf: "flex-start",
  },

  hero: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 24,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  avatarWrap: { marginBottom: 12 },
  avatarImg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: Colors.background,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: Colors.background,
  },
  avatarText: { color: "#fff", fontSize: 36, fontWeight: "800" },

  fullName: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 3,
  },
  username: { color: Colors.textMuted, fontSize: 14, marginBottom: 16 },

  followBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 24,
    marginBottom: 20,
    minWidth: 120,
    justifyContent: "center",
  },
  followingBtn: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  followBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  followingBtnText: { color: Colors.primary },

  followRow: {
    flexDirection: "row",
    backgroundColor: Colors.card2,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    width: "100%",
  },
  followItem: { flex: 1, alignItems: "center" },
  followCount: { color: Colors.primary, fontSize: 22, fontWeight: "800" },
  followLabel: { color: Colors.textMuted, fontSize: 12, marginTop: 3 },
  followDivider: { width: 1, backgroundColor: Colors.border },

  statsCard: {
    flexDirection: "row",
    backgroundColor: Colors.card2,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statItem: { flex: 1, alignItems: "center", gap: 6 },
  statValue: { color: Colors.primary, fontSize: 22, fontWeight: "800" },
  statLabel: { color: Colors.textMuted, fontSize: 12 },
  statDivider: { width: 1, backgroundColor: Colors.border },

  sectionTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "700",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 10,
  },

  activityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activityIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.card2,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 12,
  },
  activityMiddle: { flex: 1 },
  activityTitle: { color: Colors.text, fontSize: 15, fontWeight: "600" },
  activityDate: { color: Colors.textMuted, fontSize: 12, marginTop: 3 },
  activityRight: { alignItems: "flex-end" },
  activityDistance: { color: Colors.primary, fontSize: 16, fontWeight: "700" },
  activityTime: { color: Colors.textMuted, fontSize: 12, marginTop: 3 },
  activityPace: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },

  empty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: 40 },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.card2,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "70%",
    paddingTop: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { color: Colors.text, fontSize: 17, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarImg: { width: 44, height: 44, borderRadius: 22 },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 17 },
  rowName: { color: Colors.text, fontSize: 15, fontWeight: "600" },
  rowUser: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  empty: { alignItems: "center", gap: 12, paddingVertical: 48 },
  emptyText: { color: Colors.textMuted, fontSize: 15 },
});
