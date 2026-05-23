import { useMemo } from 'react';
import { Colors } from '../../constants/colors';

export function getBounds(coords: { latitude: number; longitude: number }[]) {
  if (!coords.length) return null;
  let minLat = coords[0].latitude, maxLat = coords[0].latitude;
  let minLng = coords[0].longitude, maxLng = coords[0].longitude;
  for (const c of coords) {
    if (c.latitude < minLat) minLat = c.latitude;
    if (c.latitude > maxLat) maxLat = c.latitude;
    if (c.longitude < minLng) minLng = c.longitude;
    if (c.longitude > maxLng) maxLng = c.longitude;
  }
  const padLat = (maxLat - minLat) * 0.2 || 0.005;
  const padLng = (maxLng - minLng) * 0.2 || 0.005;
  return { minLat: minLat - padLat, maxLat: maxLat + padLat, minLng: minLng - padLng, maxLng: maxLng + padLng };
}

export function buildStaticMapUrl(coords: { latitude: number; longitude: number }[], w: number, h: number): string | null {
  return buildStaticMapUrlWithStyle(coords, w, h, 'dark-matter');
}

/**
 * Like buildStaticMapUrl but lets you pick any Geoapify map style.
 * Popular styles: 'dark-matter', 'osm-bright', 'klokantech-basic', 'positron'
 */
export function buildStaticMapUrlWithStyle(
  coords: { latitude: number; longitude: number }[],
  w: number,
  h: number,
  style: string,
  pathColor?: string,
): string | null {
  const GEOAPIFY_KEY = 'YOUR_GEOAPIFY_KEY';
  if (coords.length < 2 || GEOAPIFY_KEY === 'YOUR_GEOAPIFY_KEY') return null;
  const bounds = getBounds(coords);
  if (!bounds) return null;
  const step = Math.max(1, Math.floor(coords.length / 100));
  const thinned = coords.filter((_, i) => i % step === 0);
  const pathPoints = thinned.map(c => `${c.longitude},${c.latitude}`).join('|');
  const color = pathColor ?? Colors.primary;
  return `https://maps.geoapify.com/v1/staticmap?style=${style}&width=${Math.round(w)}&height=${Math.round(h)}&bbox=${bounds.minLng},${bounds.minLat},${bounds.maxLng},${bounds.maxLat}&path=color%3A${encodeURIComponent(color)}|weight%3A5|${pathPoints}&apiKey=${GEOAPIFY_KEY}`;
}

export function useSvgRoute(route: { latitude: number; longitude: number }[], w: number, h: number) {
  return useMemo(() => {
    if (!route || route.length < 2) return { points: '', startPt: null, endPt: null };
    const bounds = getBounds(route);
    if (!bounds) return { points: '', startPt: null, endPt: null };
    const { minLat, maxLat, minLng, maxLng } = bounds;
    const latRange = maxLat - minLat || 0.001;
    const lngRange = maxLng - minLng || 0.001;

    // Correct for longitude compression at non-equatorial latitudes
    const midLat = (minLat + maxLat) / 2;
    const cosLat = Math.cos((midLat * Math.PI) / 180);
    const adjustedLngRange = lngRange * cosLat;

    // Fit the route inside the box while preserving true shape (no stretch)
    const scaleX = w / (adjustedLngRange || 0.001);
    const scaleY = h / (latRange || 0.001);
    const scale  = Math.min(scaleX, scaleY);

    const routeW = adjustedLngRange * scale;
    const routeH = latRange * scale;
    const offsetX = (w - routeW) / 2;
    const offsetY = (h - routeH) / 2;

    const toXY = (c: any) => ({
      x: ((c.longitude - minLng) * cosLat * scale) + offsetX,
      y: ((maxLat - c.latitude)  * scale)          + offsetY,
    });

    const points = route.map(c => {
      const p = toXY(c);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    }).join(' ');
    return { points, startPt: toXY(route[0]), endPt: toXY(route[route.length - 1]) };
  }, [route, w, h]);
}