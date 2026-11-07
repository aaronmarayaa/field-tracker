import { Component, ElementRef, OnDestroy, ViewChild, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthService } from '../data/auth.service';
import { TripStore } from './trip-store.service';
import { tripBackgrounds, tripDistance, tripPace, tripTime, type Trip } from './trip';
import { drawTripPoster } from './trip-poster';
import { localTripPhoto, takeTripPhoto, exportTripImage } from './trip-photo';
import { readDeviceValue, writeDeviceValue } from '../data/device-store';

@Component({
  selector: 'app-trip-history', standalone: true, imports: [DatePipe],
  templateUrl: './trip-history.component.html', styleUrl: './trip-history.component.scss',
})
export class TripHistoryComponent implements OnDestroy {
  @ViewChild('dialog', { static: true }) private dialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('poster') private poster?: ElementRef<HTMLCanvasElement>;
  readonly store = inject(TripStore);
  readonly auth = inject(AuthService);
  readonly selected = signal<Trip | null>(null);
  readonly working = signal(false);
  readonly drawing = signal(false);
  readonly message = signal('');
  readonly photoUrl = signal<string | null>(null);
  readonly usePhoto = signal(false);
  readonly drawError = signal('');
  readonly backgrounds = tripBackgrounds;
  readonly distance = tripDistance;
  readonly pace = tripPace;
  readonly time = tripTime;
  private renderVersion = 0;

  open(): void {
    this.back();
    this.dialog.nativeElement.showModal();
    void this.store.refresh();
  }

  close(): void { if (!this.working()) { this.dialog.nativeElement.close(); this.back(); } }

  cancel(event: Event): void { if (this.working()) event.preventDefault(); else this.back(); }

  ngOnDestroy(): void { this.back(); }

  back(): void {
    ++this.renderVersion;
    this.selected.set(null);
    this.message.set('');
    this.drawError.set('');
    this.drawing.set(false);
    if (this.photoUrl()) URL.revokeObjectURL(this.photoUrl()!);
    this.photoUrl.set(null);
    this.usePhoto.set(false);
  }

  async showTrip(trip: Trip): Promise<void> {
    this.back();
    this.selected.set({ ...trip });
    this.drawing.set(true);
    const version = this.renderVersion;
    try {
      const url = await localTripPhoto(trip.user_id, trip.id);
      const usePhoto = !!url && !!await readDeviceValue<boolean>(`use-photo:${trip.user_id}:${trip.id}`);
      if (version !== this.renderVersion) { if (url) URL.revokeObjectURL(url); return; }
      this.photoUrl.set(url);
      this.usePhoto.set(usePhoto);
      await this.render(true);
    } catch (error) {
      if (version === this.renderVersion) { this.drawing.set(false); this.drawError.set((error as Error).message); }
    }
  }

  async chooseBackground(index: number): Promise<void> {
    if (this.working()) return;
    this.usePhoto.set(false);
    this.selected.update((trip) => trip ? { ...trip, background: index } : null);
    await this.saveAppearance(true);
  }

  async choosePhoto(): Promise<void> {
    this.usePhoto.set(true);
    await this.saveAppearance(false);
  }

  async camera(): Promise<void> {
    const trip = this.selected();
    if (!trip || this.working()) return;
    this.working.set(true);
    this.message.set('');
    try {
      const photo = await takeTripPhoto(trip.user_id, trip.id);
      if (this.photoUrl()) URL.revokeObjectURL(this.photoUrl()!);
      this.photoUrl.set(photo.url);
      this.usePhoto.set(true);
      await writeDeviceValue(`use-photo:${trip.user_id}:${trip.id}`, true);
      await this.render();
      this.message.set(photo.gallerySaved ? 'Photo saved to this phone’s gallery. It is not uploaded.' : 'Photo kept on this device only. Gallery saving was unavailable.');
    } catch (error) {
      const message = (error as Error).message ?? '';
      if (!/cancel/i.test(message) && (error as { code?: string }).code !== 'OS-PLUG-CAMR-0006') {
        this.message.set('The camera could not save a photo. Check camera and photo permissions, then try again.');
      }
    } finally { this.working.set(false); }
  }

  async exportImage(share: boolean): Promise<void> {
    const trip = this.selected();
    const canvas = this.poster?.nativeElement;
    if (!trip || !canvas || this.working() || this.drawing() || this.drawError()) return;
    this.working.set(true);
    this.message.set('');
    try {
      const result = await exportTripImage(canvas, trip.id, share);
      this.message.set(result === 'shared' ? 'Sharing opened for this image.' : result === 'saved' ? 'Trip image saved in Documents on this phone.' : 'Trip image downloaded.');
    } catch (error) {
      if (!/cancel|abort/i.test((error as Error).message ?? '')) this.message.set('The image could not be saved or shared. Check device permissions and try again.');
    } finally { this.working.set(false); }
  }

  async signOut(): Promise<void> { this.close(); await this.auth.signOut(); }

  async render(focusBack = false): Promise<void> {
    const trip = this.selected();
    if (!trip) return;
    const version = ++this.renderVersion;
    this.drawing.set(true);
    this.drawError.set('');
    try {
      // Wait for Angular to insert the detail canvas before drawing it.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      if (focusBack && version === this.renderVersion) this.dialog.nativeElement.querySelector<HTMLElement>('.back-button')?.focus();
      const background = this.usePhoto() ? this.photoUrl()! : tripBackgrounds[trip.background]?.src ?? tripBackgrounds[0].src;
      const buffer = document.createElement('canvas');
      await drawTripPoster(buffer, trip, background);
      if (version !== this.renderVersion || !this.poster) return;
      const canvas = this.poster.nativeElement;
      canvas.width = buffer.width; canvas.height = buffer.height;
      canvas.getContext('2d')!.drawImage(buffer, 0, 0);
    } catch { if (version === this.renderVersion) this.drawError.set('The trip image could not load. Choose another background or retry.'); }
    finally { if (version === this.renderVersion) this.drawing.set(false); }
  }

  private async saveAppearance(persistPreset: boolean): Promise<void> {
    const trip = this.selected();
    if (!trip) return;
    this.working.set(true);
    this.message.set('');
    try {
      await writeDeviceValue(`use-photo:${trip.user_id}:${trip.id}`, this.usePhoto());
      if (persistPreset) await this.store.setBackground(trip, trip.background);
      await this.render();
    } catch (error) { this.message.set((error as Error).message); }
    finally { this.working.set(false); }
  }
}
