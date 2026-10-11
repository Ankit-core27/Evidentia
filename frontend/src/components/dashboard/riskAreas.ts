/**
 * Area risk figures for the dashboard heatmap (components/dashboard/IncidentMap).
 *
 * The map is centred on the Ring Road and 5th Avenue junction, Sector 12, Bengaluru: the
 * incident site of FX-2026-0001 and the junction its 3D reconstruction shows
 * (assets/3d/crime-scenes/scenes/road-accident/junction.json).
 *
 * The figures are illustrative demo values, not drawn from case records; no endpoint serves
 * area statistics yet. Crimes are reported crimes over the last 30 days, risk is a 0 to 100
 * score, and officers are the officers on duty in the area.
 */
export type RiskArea = {
  name: string;
  division: string;
  lat: number;
  lng: number;
  crimes: number;
  risk: number;
  officers: number;
};

export const RISK_REGION = {
  name: 'Bengaluru',
  center: { lat: 12.9716, lng: 77.5946 }
};

export const RISK_AREAS: RiskArea[] = [
  { name: 'Majestic', division: 'West', lat: 12.9767, lng: 77.5713, crimes: 142, risk: 92, officers: 30 },
  { name: 'Shivajinagar', division: 'Central', lat: 12.9857, lng: 77.6057, crimes: 131, risk: 90, officers: 28 },
  { name: 'Sector 12', division: 'Central', lat: 12.9716, lng: 77.5946, crimes: 112, risk: 86, officers: 24 },
  { name: 'Koramangala', division: 'South-East', lat: 12.9352, lng: 77.6245, crimes: 96, risk: 76, officers: 21 },
  { name: 'Peenya', division: 'North-West', lat: 13.0285, lng: 77.5197, crimes: 88, risk: 72, officers: 17 },
  { name: 'Marathahalli', division: 'Whitefield', lat: 12.9569, lng: 77.7011, crimes: 81, risk: 69, officers: 19 },
  { name: 'Indiranagar', division: 'East', lat: 12.9784, lng: 77.6408, crimes: 74, risk: 64, officers: 18 },
  { name: 'KR Puram', division: 'East', lat: 13.0076, lng: 77.695, crimes: 63, risk: 61, officers: 15 },
  { name: 'BTM Layout', division: 'South-East', lat: 12.9166, lng: 77.6101, crimes: 58, risk: 57, officers: 14 },
  { name: 'Rajajinagar', division: 'West', lat: 12.9915, lng: 77.5525, crimes: 57, risk: 55, officers: 14 },
  { name: 'Yeshwanthpur', division: 'North', lat: 13.028, lng: 77.554, crimes: 49, risk: 53, officers: 13 },
  { name: 'Jayanagar', division: 'South', lat: 12.925, lng: 77.5938, crimes: 52, risk: 51, officers: 15 },
  { name: 'Hebbal', division: 'North', lat: 13.0358, lng: 77.597, crimes: 46, risk: 48, officers: 12 },
  { name: 'Banashankari', division: 'South', lat: 12.9255, lng: 77.5468, crimes: 39, risk: 42, officers: 11 }
];

export type RiskBand = 'high' | 'elevated' | 'moderate';

export const riskBand = (risk: number): RiskBand => (risk >= 80 ? 'high' : risk >= 60 ? 'elevated' : 'moderate');
