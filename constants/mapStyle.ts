// constants/mapStyle.ts
// Dark map style + default region — imported by TrackingScreen and TrackingMap.

export const DEFAULT_REGION = {
  latitude: 36.8065,
  longitude: 10.1815,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
}

export const DARK_MAP_STYLE: any[] = [
  { elementType: 'geometry',            stylers: [{ color: '#1a1a2e' }] },
  { elementType: 'labels.text.fill',    stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke',  stylers: [{ color: '#1a3646' }] },
  { featureType: 'road',       elementType: 'geometry',        stylers: [{ color: '#2d2d44' }] },
  { featureType: 'road',       elementType: 'geometry.stroke', stylers: [{ color: '#212a37' }] },
  { featureType: 'road.highway', elementType: 'geometry',      stylers: [{ color: '#3c3c58' }] },
  { featureType: 'water',      elementType: 'geometry',        stylers: [{ color: '#0e1626' }] },
  { featureType: 'poi',        elementType: 'geometry',        stylers: [{ color: '#1f2933' }] },
  { featureType: 'poi.park',   elementType: 'geometry',        stylers: [{ color: '#1a2e1a' }] },
  { featureType: 'transit',    elementType: 'geometry',        stylers: [{ color: '#2f3948' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
]