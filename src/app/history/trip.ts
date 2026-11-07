import { displayDistance, formatDuration, type DistanceUnit, type TrackPoint } from '../home/tracking';

export interface RoutePoint { latitude: number; longitude: number; }

export interface Trip {
  id: string;
  user_id: string;
  started_at: string;
  finished_at: string;
  distance_meters: number;
  duration_seconds: number;
  unit: DistanceUnit;
  route: RoutePoint[];
  background: number;
  syncState: 'pending' | 'saved';
}

export const tripBackgrounds = [
  { src: 'assets/trip-backgrounds/starting-line.png', name: 'Starting line' },
  { src: 'assets/trip-backgrounds/grass-runner.png', name: 'Grass runner' },
  { src: 'assets/trip-backgrounds/road-runner.png', name: 'Road runner' },
];

export function tripDistance(trip: Trip): string {
  return displayDistance(trip.distance_meters, trip.unit).toFixed(2);
}

export function tripPace(trip: Trip): string {
  const distance = displayDistance(trip.distance_meters, trip.unit);
  if (distance <= 0 || trip.duration_seconds <= 0) return '···';
  const seconds = Math.round(trip.duration_seconds / distance);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function tripTime(trip: Trip): string { return formatDuration(trip.duration_seconds); }

export function newTripId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}

export function snapshotRoute(points: readonly TrackPoint[]): RoutePoint[] {
  const stride = Math.max(1, Math.ceil(points.length / 4999));
  return points.filter((_, index) => index % stride === 0 || index === points.length - 1)
    .map(({ latitude, longitude }) => ({ latitude, longitude }));
}
