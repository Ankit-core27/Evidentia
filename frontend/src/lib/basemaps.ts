// Map tiles that need no API key, shared by the dashboard map (Leaflet) and the case's
// area view (Cesium). Both credit their source on the map.

/** Esri World Imagery: real satellite and aerial photographs. */
export const SATELLITE = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  maxZoom: 19,
  attribution: 'Imagery © Esri, Maxar, Earthstar Geographics and the GIS User Community'
};

/** Esri place and boundary names, drawn over the satellite imagery. */
export const SATELLITE_LABELS = {
  url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  maxZoom: 19,
  attribution: 'Labels © Esri'
};

/** The standard OpenStreetMap street map. */
export const STREETS = {
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  maxZoom: 19,
  attribution: '© OpenStreetMap contributors'
};

export type BasemapKind = 'satellite' | 'streets';
