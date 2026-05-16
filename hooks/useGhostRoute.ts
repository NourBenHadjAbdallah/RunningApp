// hooks/useGhostRoute.ts
// Manages the "saved route overlay" (ghost polyline) shown on the map
// and the locate-me camera animation.

import { useCallback, useRef, useState } from "react";
import { Alert } from "react-native";
import MapView from "react-native-maps";
import type { Coordinate, SavedRoute } from "../components/Tracking/tracking";
import { activityService } from "../services/activityService";

interface GhostRouteState {
  mapRef: React.RefObject<MapView | null>;
  ghostRoute: Coordinate[] | null;
  ghostLabel: string | null;
  routeModal: boolean;
  savedRoutes: SavedRoute[];
  routesLoading: boolean;
  handleLocateMe: (currentLocation: Coordinate | null) => void;
  openRouteModal: () => Promise<void>;
  handleSelectRoute: (r: SavedRoute) => void;
  handleClearGhostRoute: () => void;
  closeRouteModal: () => void;
}

export function useGhostRoute(): GhostRouteState {
  const mapRef = useRef<MapView>(null);

  const [ghostRoute, setGhostRoute] = useState<Coordinate[] | null>(null);
  const [ghostLabel, setGhostLabel] = useState<string | null>(null);
  const [routeModal, setRouteModal] = useState(false);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [routesLoading, setRoutesLoading] = useState(false);

  // ── Locate me ─────────────────────────────────────────────────────────────

  const handleLocateMe = useCallback((currentLocation: Coordinate | null) => {
    if (!currentLocation) {
      Alert.alert(
        "Location unavailable",
        "GPS fix not yet acquired. Try again in a moment.",
      );
      return;
    }
    mapRef.current?.animateToRegion(
      {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      },
      400,
    );
  }, []);

  // ── Route modal ───────────────────────────────────────────────────────────

  const openRouteModal = useCallback(async () => {
    setRouteModal(true);
    setRoutesLoading(true);
    try {
      const routes = await activityService.getSavedRoutes();
      setSavedRoutes(routes as SavedRoute[]);
    } catch (e: any) {
      Alert.alert("Error loading routes", e.message);
    } finally {
      setRoutesLoading(false);
    }
  }, []);

  const closeRouteModal = useCallback(() => setRouteModal(false), []);

  const handleSelectRoute = useCallback((r: SavedRoute) => {
    setGhostRoute(r.waypoints);
    setGhostLabel(r.name);
    setRouteModal(false);

    if (r.waypoints.length > 0) {
      mapRef.current?.fitToCoordinates(r.waypoints, {
        edgePadding: { top: 60, right: 40, bottom: 200, left: 40 },
        animated: true,
      });
    }
  }, []);

  const handleClearGhostRoute = useCallback(() => {
    setGhostRoute(null);
    setGhostLabel(null);
  }, []);

  return {
    mapRef,
    ghostRoute,
    ghostLabel,
    routeModal,
    savedRoutes,
    routesLoading,
    handleLocateMe,
    openRouteModal,
    handleSelectRoute,
    handleClearGhostRoute,
    closeRouteModal,
  };
}
