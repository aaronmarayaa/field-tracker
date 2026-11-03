import {
  AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy,
  SimpleChanges, ViewChild, ViewEncapsulation, signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import * as L from 'leaflet';
import type { TrackPoint } from '../home/tracking';

@Component({
  selector: 'app-tracking-map',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './tracking-map.component.html',
  styleUrl: './tracking-map.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class TrackingMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() startPoint: TrackPoint | null = null;
  @Input() latestPoint: TrackPoint | null = null;
  @Input() points: readonly TrackPoint[] = [];
  @Input() finished = false;
  @Input() locating = false;
  @ViewChild('mapContainer') mapContainer!: ElementRef<HTMLDivElement>;

  readonly following = signal(true);
  readonly loading = signal(false);
  readonly tileError = signal(false);
  readonly unavailable = signal(false);

  private map?: L.Map;
  private tiles?: L.TileLayer;
  private route?: L.Polyline;
  private routeOutline?: L.Polyline;
  private locationMarker?: L.CircleMarker;
  private resizeObserver?: ResizeObserver;
  private viewReady = false;
  private lastTimestamp = 0;
  private drawnPointCount = 0;

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.updateMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // A new starting point means a new trip, even at the same coordinates.
    if (changes['startPoint']) this.clearMap();
    if (this.viewReady) this.updateMap();
  }

  ngOnDestroy(): void {
    this.clearMap();
  }

  centerOnMe(): void {
    if (!this.map || !this.latestPoint) return;
    this.following.set(true);
    this.map.setView(
      [this.latestPoint.latitude, this.latestPoint.longitude],
      Math.max(16, this.map.getZoom()),
      { animate: false },
    );
  }

  reloadTiles(): void {
    this.tileError.set(false);
    this.tiles?.redraw();
  }

  private updateMap(): void {
    if (!this.startPoint || !this.latestPoint || this.unavailable()) return;

    try {
      if (!this.map) this.createMap(this.startPoint);
      const point = this.latestPoint;
      const coordinates: L.LatLngTuple = [point.latitude, point.longitude];

      const pendingPoints = this.points.slice(this.drawnPointCount);
      for (const recorded of pendingPoints) {
        if (recorded.timestamp <= this.lastTimestamp) continue;
        const routeCoordinates: L.LatLngTuple = [recorded.latitude, recorded.longitude];
        this.routeOutline?.addLatLng(routeCoordinates);
        this.route?.addLatLng(routeCoordinates);
        this.lastTimestamp = recorded.timestamp;
      }
      this.drawnPointCount = this.points.length;

      if (pendingPoints.length > 0) {
        this.locationMarker?.setLatLng(coordinates);
        if (this.following() && !this.finished) {
          this.map?.panTo(coordinates, { animate: false });
        }
      }

      if (this.finished && this.route) {
        this.map?.fitBounds(this.route.getBounds(), { padding: [24, 24], maxZoom: 16, animate: false });
      }
    } catch {
      this.loading.set(false);
      this.unavailable.set(true);
    }
  }

  private createMap(start: TrackPoint): void {
    const coordinates: L.LatLngTuple = [start.latitude, start.longitude];
    this.map = L.map(this.mapContainer.nativeElement, {
      scrollWheelZoom: false,
      fadeAnimation: false,
      zoomAnimation: false,
    }).setView(coordinates, 16);
    this.map.attributionControl.setPrefix('');

    this.tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      referrerPolicy: 'strict-origin-when-cross-origin',
    });
    this.tiles.on('loading', () => { this.loading.set(true); this.tileError.set(false); });
    this.tiles.on('load', () => this.loading.set(false));
    this.tiles.on('tileerror', () => this.tileError.set(true));
    this.tiles.addTo(this.map);

    this.routeOutline = L.polyline([coordinates], { color: '#ffffff', weight: 8, interactive: false }).addTo(this.map);
    this.route = L.polyline([coordinates], { color: '#ba3d1e', weight: 4, interactive: false, className: 'route-line' }).addTo(this.map);
    L.circleMarker(coordinates, {
      radius: 7, color: '#121413', weight: 3, fillColor: '#ffffff', fillOpacity: 1,
      interactive: false, className: 'route-start-marker',
    }).addTo(this.map);
    this.locationMarker = L.circleMarker(coordinates, {
      radius: 8, color: '#121413', weight: 3, fillColor: '#ff8057', fillOpacity: 1,
      interactive: false, className: 'route-location-marker',
    }).addTo(this.map);
    this.lastTimestamp = start.timestamp;
    this.map.on('dragstart', () => this.following.set(false));

    this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize({ pan: false }));
    this.resizeObserver.observe(this.mapContainer.nativeElement);
  }

  private clearMap(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
    this.map = undefined;
    this.tiles = undefined;
    this.route = undefined;
    this.routeOutline = undefined;
    this.locationMarker = undefined;
    this.lastTimestamp = 0;
    this.drawnPointCount = 0;
    this.following.set(true);
    this.loading.set(false);
    this.tileError.set(false);
    this.unavailable.set(false);
  }
}
