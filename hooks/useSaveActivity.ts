// hooks/useSaveActivity.ts
// Handles saving a finished run to Supabase and driving the share-card flow.
// Keeps all async save logic and share-card state out of TrackingScreen.

import * as MediaLibrary from "expo-media-library";
import { router } from "expo-router";
import * as Sharing from "expo-sharing";
import { useCallback, useRef, useState } from "react";
import { Alert } from "react-native";
import type { RunShareCardHandle } from "../components/RunShareCard";
import type { RunSnapshot } from "../components/Tracking/tracking";
import { activityService } from "../services/activityService";

interface SaveActivityParams {
  title: string;
  distance: number;
  duration: number;
  pace: number;
  calories: number;
  route: { latitude: number; longitude: number }[];
  steps: number;
  getAnalytics: () => any;
}

interface UseSaveActivityReturn {
  shareCardRef: React.RefObject<RunShareCardHandle | null>;
  saveModal: boolean;
  shareModal: boolean;
  activityTitle: string;
  saving: boolean;
  captureLoading: boolean;
  savedData: RunSnapshot | null;
  openSaveModal: () => void;
  closeSaveModal: () => void;
  setActivityTitle: (t: string) => void;
  saveActivity: (params: SaveActivityParams) => Promise<void>;
  handleSaveImage: () => Promise<void>;
  handleShareImage: () => Promise<void>;
  handleCloseShare: (resetTracking: () => void) => void;
  handleViewActivity: (resetTracking: () => void) => void;
}

export function useSaveActivity(): UseSaveActivityReturn {
  const shareCardRef = useRef<RunShareCardHandle>(null);

  const [saveModal, setSaveModal] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [activityTitle, setActivityTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [captureLoading, setCaptureLoading] = useState(false);
  const [savedData, setSavedData] = useState<RunSnapshot | null>(null);

  // Store latest activity ID between save and view-details tap
  const latestActivityId = useRef<string | null>(null);

  // ── Modal helpers ──────────────────────────────────────────────────────────

  const openSaveModal = useCallback(() => setSaveModal(true), []);
  const closeSaveModal = useCallback(() => setSaveModal(false), []);

  // ── Save run ───────────────────────────────────────────────────────────────

  const saveActivity = useCallback(
    async ({
      title,
      distance,
      duration,
      pace,
      calories,
      route,
      steps,
      getAnalytics,
    }: SaveActivityParams) => {
      setSaving(true);
      try {
        const finalTitle = title.trim() || "Morning Run";
        const analytics = getAnalytics();

        await activityService.saveActivity({
          title: finalTitle,
          distance,
          duration,
          pace,
          calories,
          route,
          ...(analytics.elevation_data.length > 0 && {
            elevation_gain: analytics.elevation_gain,
            max_elevation: analytics.max_elevation,
            elevation_data: analytics.elevation_data,
          }),
          ...(analytics.pace_data.length > 0 && {
            pace_data: analytics.pace_data,
            moving_time: analytics.moving_time,
            fastest_split: analytics.fastest_split,
          }),
          ...(analytics.splits.length > 0 && { splits: analytics.splits }),
          ...(analytics.pace_zones.some((z: any) => z.percentage > 0) && {
            pace_zones: analytics.pace_zones,
          }),
        });

        const activities = await activityService.getMyActivities();
        latestActivityId.current = activities[0]?.id ?? null;

        setSavedData({
          title: finalTitle,
          distance,
          duration,
          pace,
          calories,
          route,
          steps,
          elevGain: analytics.elevation_gain,
          maxElev: analytics.max_elevation,
        });
        setSaveModal(false);
        setActivityTitle("");
        setShareModal(true);
      } catch (e: any) {
        Alert.alert("Error", e.message);
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  // ── Share-card actions ─────────────────────────────────────────────────────

  const handleSaveImage = useCallback(async () => {
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
      const uri = await (shareCardRef.current as any)?.capture();
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("Saved! 📸", "Share card saved to your Photos.");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setCaptureLoading(false);
    }
  }, []);

  const handleShareImage = useCallback(async () => {
    setCaptureLoading(true);
    try {
      const uri = await (shareCardRef.current as any)?.capture();
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Sharing not available on this device");
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
  }, []);

  const handleCloseShare = useCallback((resetTracking: () => void) => {
    setShareModal(false);
    setSavedData(null);
    resetTracking();
  }, []);

  const handleViewActivity = useCallback((resetTracking: () => void) => {
    setShareModal(false);
    setSavedData(null);
    resetTracking();
    if (latestActivityId.current) {
      router.push({
        pathname: "/(tabs)/activity",
        params: { id: latestActivityId.current },
      });
    }
  }, []);

  return {
    shareCardRef,
    saveModal,
    shareModal,
    activityTitle,
    saving,
    captureLoading,
    savedData,
    openSaveModal,
    closeSaveModal,
    setActivityTitle,
    saveActivity,
    handleSaveImage,
    handleShareImage,
    handleCloseShare,
    handleViewActivity,
  };
}
