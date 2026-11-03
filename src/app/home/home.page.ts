import { Component, HostListener, OnDestroy, signal } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { IonButton, IonContent, IonSpinner } from '@ionic/angular';
import { Capacitor } from '@capacitor/core';
import { Geolocation, type Position, type PositionOptions } from '@capacitor/geolocation';
import { TrackingMapComponent } from '../tracking-map/tracking-map.component';
import { prepareBackgroundTracking, startLocationWatch, stopLocationWatch, supportsBackgroundTracking } from './location-watch';
import {
  displayDistance, displaySpeed, distanceBetween, formatDuration, isUsablePoint, movementBetween,
  type DistanceUnit, type TrackPoint,
} from './tracking';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [IonButton, IonContent, IonSpinner, DecimalPipe, DatePipe, TrackingMapComponent],
  templateUrl: './home.page.html',
  styleUrl: './home.page.scss',
})
export class HomePage implements OnDestroy {
  readonly canTrackInBackground = supportsBackgroundTracking();
  readonly status = signal<'ready' | 'locating' | 'tracking' | 'finished'>('ready');
  readonly unit = signal<DistanceUnit>('km');
  readonly startPoint = signal<TrackPoint | null>(null);
  readonly latestPoint = signal<TrackPoint | null>(null);
  readonly routePoints = signal<TrackPoint[]>([]);
  readonly distanceMeters = signal(0);
  readonly speedMetersPerSecond = signal<number | null>(null);
  readonly startedAt = signal<number | null>(null);
  readonly finishedAt = signal<number | null>(null);
  readonly now = signal(Date.now());
  readonly error = signal('');
  readonly gpsMessage = signal('');

  private distanceAnchor: TrackPoint | null = null;
  private watchId: string | null = null;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private session = 0;

  private readonly locationOptions: PositionOptions = {
    enableHighAccuracy: true,
    timeout: 15000,
    maximumAge: 0,
    minimumUpdateInterval: 2000,
    interval: 2000,
  };

  get distance(): number {
    return displayDistance(this.distanceMeters(), this.unit());
  }

  get speed(): number | null {
    const speed = this.speedMetersPerSecond();
    return speed === null ? null : displaySpeed(speed, this.unit());
  }

  get elapsedSeconds(): number {
    const start = this.startedAt();
    return start === null ? 0 : Math.max(0, ((this.finishedAt() ?? this.now()) - start) / 1000);
  }

  get duration(): string {
    return formatDuration(this.elapsedSeconds);
  }

  get averageSpeed(): number {
    const seconds = this.elapsedSeconds;
    return seconds > 0 ? displaySpeed(this.distanceMeters() / seconds, this.unit()) : 0;
  }

  get speedUnit(): string {
    return this.unit() === 'km' ? 'km/h' : 'mph';
  }

  get speedIsStale(): boolean {
    const point = this.latestPoint();
    return this.status() === 'tracking' && point !== null && this.now() - point.timestamp > 15000;
  }

  async startTrip(): Promise<void> {
    if (this.status() === 'locating' || this.status() === 'tracking') return;

    const session = ++this.session;
    this.resetReadings();
    this.status.set('locating');

    try {
      if (!Capacitor.isNativePlatform() && (!window.isSecureContext || !navigator.geolocation)) {
        throw new Error('Browser location needs HTTPS or localhost. Use the Android app on your phone.');
      }
      // The browser requests permission through getCurrentPosition instead.
      if (Capacitor.isNativePlatform()) {
        let permission = await Geolocation.checkPermissions();
        if (permission.location !== 'granted') {
          permission = await Geolocation.requestPermissions({ permissions: ['location'] });
        }
        if (permission.location !== 'granted') {
          throw new Error('Allow precise location in your phone settings, then try again.');
        }
      }

      await prepareBackgroundTracking();
      const position = await Geolocation.getCurrentPosition(this.locationOptions);
      if (session !== this.session) return;
      if (this.canTrackInBackground && document.hidden) {
        throw new Error('Keep Field Tracker open until the trip starts, then lock your screen.');
      }

      const point = this.toTrackPoint(position);
      if (!isUsablePoint(point)) {
        throw new Error('GPS is not precise enough yet. Move outdoors and try again.');
      }

      this.startPoint.set(point);
      this.latestPoint.set(point);
      this.routePoints.set([point]);
      this.distanceAnchor = point;
      this.startedAt.set(Date.now());
      this.now.set(Date.now());
      this.status.set('tracking');
      this.timerId = setInterval(() => this.now.set(Date.now()), 1000);

      const watchId = await startLocationWatch(this.locationOptions, (nextPosition, locationError) => {
        if (session !== this.session || this.status() !== 'tracking') return;
        if (locationError) {
          this.speedMetersPerSecond.set(null);
          this.gpsMessage.set(this.locationErrorMessage(locationError));
          return;
        }
        if (nextPosition) this.recordPosition(nextPosition);
      });

      // Finish or Cancel may run before the native watcher returns its ID.
      if (session !== this.session) {
        await stopLocationWatch(watchId);
      } else {
        this.watchId = watchId;
      }
    } catch (locationError) {
      if (session !== this.session) return;
      this.error.set(this.locationErrorMessage(locationError));
      this.stopTimer();
      this.finishedAt.set(this.startedAt() === null ? null : Date.now());
      this.status.set(this.startedAt() === null ? 'ready' : 'finished');
    }
  }

  cancelStart(): void {
    ++this.session;
    this.status.set('ready');
  }

  async finishTrip(): Promise<void> {
    if (this.status() !== 'tracking') return;
    ++this.session;
    this.finishedAt.set(Date.now());
    this.speedMetersPerSecond.set(null);
    this.status.set('finished');
    this.stopTimer();
    await this.stopWatcher();
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (this.canTrackInBackground) {
      if (!document.hidden && this.status() === 'tracking') this.now.set(Date.now());
      return;
    }
    if (document.hidden && this.status() === 'tracking') {
      void this.finishTrip();
      this.error.set('This trip ended when the app was hidden. Keep it open for foreground tracking.');
    } else if (document.hidden && this.status() === 'locating') {
      this.cancelStart();
    }
  }

  ngOnDestroy(): void {
    ++this.session;
    this.stopTimer();
    void this.stopWatcher();
  }

  private recordPosition(position: Position): void {
    const point = this.toTrackPoint(position);
    if (!isUsablePoint(point)) {
      this.gpsMessage.set('Weak GPS signal. Waiting for a more precise location.');
      this.speedMetersPerSecond.set(null);
      return;
    }

    const previous = this.latestPoint();
    if (previous && point.timestamp <= previous.timestamp) return;
    if (previous && distanceBetween(previous, point) / ((point.timestamp - previous.timestamp) / 1000) > 100) {
      this.gpsMessage.set('GPS jumped unexpectedly. Waiting for a reliable reading.');
      this.speedMetersPerSecond.set(null);
      return;
    }

    const meters = this.distanceAnchor ? movementBetween(this.distanceAnchor, point) : 0;
    if (meters > 0) {
      this.distanceMeters.update((total) => total + meters);
      this.distanceAnchor = point;
    }

    const seconds = previous ? (point.timestamp - previous.timestamp) / 1000 : 0;
    const estimatedSpeed = previous && seconds > 0 ? movementBetween(previous, point) / seconds : null;
    const deviceSpeed = point.speed;
    this.speedMetersPerSecond.set(
      deviceSpeed !== null && Number.isFinite(deviceSpeed) && deviceSpeed >= 0 && deviceSpeed <= 100
        ? deviceSpeed : estimatedSpeed,
    );
    this.latestPoint.set(point);
    this.routePoints.update((points) => [...points, point]);
    this.gpsMessage.set('');
    this.now.set(Date.now());
  }

  private toTrackPoint(position: Position): TrackPoint {
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      speed: position.coords.speed ?? null,
      timestamp: position.timestamp,
    };
  }

  private resetReadings(): void {
    this.startPoint.set(null);
    this.latestPoint.set(null);
    this.routePoints.set([]);
    this.distanceMeters.set(0);
    this.speedMetersPerSecond.set(null);
    this.startedAt.set(null);
    this.finishedAt.set(null);
    this.distanceAnchor = null;
    this.error.set('');
    this.gpsMessage.set('');
  }

  private stopTimer(): void {
    if (this.timerId !== null) clearInterval(this.timerId);
    this.timerId = null;
  }

  private async stopWatcher(): Promise<void> {
    const id = this.watchId;
    this.watchId = null;
    if (id === null) return;
    try {
      await stopLocationWatch(id);
    } catch {
      this.error.set('The trip ended, but GPS could not be released. Close the app to stop location use.');
    }
  }

  private locationErrorMessage(locationError: unknown): string {
    const details = locationError as { code?: string | number; message?: string };
    if (details?.code === 1 || details?.code === 'OS-PLUG-GLOC-0003') {
      return 'Location permission was denied. Allow precise location in settings, then try again.';
    }
    if (details?.code === 3 || details?.code === 'OS-PLUG-GLOC-0010') {
      return 'GPS took too long to respond. Move outdoors, check location is on, and try again.';
    }
    return details?.message || 'Location is unavailable. Turn on location services and try again.';
  }
}
