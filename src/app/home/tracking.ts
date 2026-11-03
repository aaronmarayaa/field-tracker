export interface TrackPoint {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  speed: number | null;
}

export type DistanceUnit = 'km' | 'mi';

export function distanceBetween(first: TrackPoint, second: TrackPoint): number {
  const radians = Math.PI / 180;
  const latitudeChange = (second.latitude - first.latitude) * radians;
  const longitudeChange = (second.longitude - first.longitude) * radians;
  const arc = Math.sin(latitudeChange / 2) ** 2
    + Math.cos(first.latitude * radians) * Math.cos(second.latitude * radians)
    * Math.sin(longitudeChange / 2) ** 2;

  // The Haversine formula measures distance along the earth, in meters.
  return 6371000 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - Math.min(1, arc)));
}

export function isUsablePoint(point: TrackPoint): boolean {
  return Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90
    && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180
    && Number.isFinite(point.accuracy) && point.accuracy >= 0 && point.accuracy <= 50
    && Number.isFinite(point.timestamp) && point.timestamp > 0;
}

export function movementBetween(first: TrackPoint, second: TrackPoint): number {
  const seconds = (second.timestamp - first.timestamp) / 1000;
  if (seconds <= 0) return 0;

  const meters = distanceBetween(first, second);
  const noiseThreshold = Math.max(5, first.accuracy / 2, second.accuracy / 2);

  // Ignore small GPS drift and jumps faster than 100 meters per second.
  return meters >= noiseThreshold && meters / seconds <= 100 ? meters : 0;
}

export function displayDistance(meters: number, unit: DistanceUnit): number {
  return meters / (unit === 'km' ? 1000 : 1609.344);
}

export function displaySpeed(metersPerSecond: number, unit: DistanceUnit): number {
  return metersPerSecond * (unit === 'km' ? 3.6 : 2.2369362921);
}

export function formatDuration(seconds: number): string {
  const wholeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainingSeconds = wholeSeconds % 60;
  return [hours, minutes, remainingSeconds].map((value) => String(value).padStart(2, '0')).join(':');
}
