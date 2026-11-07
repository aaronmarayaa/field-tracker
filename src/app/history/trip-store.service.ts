import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from '../data/auth.service';
import { ApiError, requestJson } from '../data/supabase';
import { readDeviceValue, writeDeviceValue } from '../data/device-store';
import type { Trip } from './trip';

type TripRow = Omit<Trip, 'syncState'>;

@Injectable({ providedIn: 'root' })
export class TripStore {
  private readonly auth = inject(AuthService);
  readonly trips = signal<Trip[]>([]);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly hasMore = signal(false);
  private owner = '';
  private offset = 0;
  private operation: Promise<void> | null = null;
  private repeat = false;

  async load(): Promise<void> {
    const owner = this.auth.user()?.id;
    if (!owner) return;
    this.owner = owner;
    this.trips.set([]);
    this.hasMore.set(false);
    this.offset = 0;
    try {
      const cached = await readDeviceValue<Trip[]>(`trips:${owner}`);
      if (this.isCurrent(owner)) this.merge([...(cached ?? []), ...this.trips()]);
    } catch (error) { this.error.set((error as Error).message); }
    await this.refresh();
  }

  async save(trip: Trip): Promise<void> {
    if (!this.isCurrent(trip.user_id)) throw new Error('Sign in with the account that recorded this trip.');
    this.merge([trip]);
    await this.persist();
    void this.refresh();
  }

  async setBackground(trip: Trip, background: number): Promise<void> {
    await this.save({ ...trip, background, syncState: 'pending' });
  }

  refresh(): Promise<void> {
    if (this.operation) { this.repeat = true; return this.operation; }
    return this.runSync(0);
  }

  async loadMore(): Promise<void> {
    if (this.busy() || !this.hasMore()) return;
    await this.runSync(this.offset);
  }

  private runSync(offset: number): Promise<void> {
    this.operation = this.syncAndRead(offset).finally(() => {
      this.operation = null;
      if (this.repeat) { this.repeat = false; void this.refresh(); }
    });
    return this.operation;
  }

  private async syncAndRead(offset: number): Promise<void> {
    const owner = this.owner;
    if (!this.isCurrent(owner)) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const token = await this.auth.accessToken();
      const headers = { Authorization: `Bearer ${token}` };
      for (const trip of this.trips().filter((trip) => trip.syncState === 'pending')) {
        if (!this.isCurrent(owner)) return;
        const { syncState, ...row } = trip;
        await requestJson('/rest/v1/trips?on_conflict=id', {
          method: 'POST', headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(row),
        });
        if (!this.isCurrent(owner)) return;
        this.trips.update((trips) => trips.map((current) => current === trip ? { ...current, syncState: 'saved' } : current));
        await this.persist();
      }
      const rows = await requestJson<TripRow[]>(`/rest/v1/trips?select=*&user_id=eq.${owner}&order=started_at.desc,id.desc&limit=25&offset=${offset}`, { headers });
      if (!this.isCurrent(owner)) return;
      const pending = this.trips().filter((trip) => trip.syncState === 'pending');
      this.merge(rows.map((trip) => ({ ...trip, syncState: 'saved' })));
      this.merge(pending);
      this.offset = offset + rows.length;
      this.hasMore.set(rows.length === 25);
      await this.persist();
    } catch (error) {
      if (this.isCurrent(owner)) {
        this.error.set(error instanceof ApiError && error.status === 404
          ? 'Cloud history is waiting for setup. Refresh after the project owner finishes it.'
          : (error as Error).message);
      }
    } finally {
      if (this.isCurrent(owner)) this.busy.set(false);
    }
  }

  private merge(incoming: Trip[]): void {
    const trips = new Map(this.trips().map((trip) => [trip.id, trip]));
    for (const trip of incoming) trips.set(trip.id, trip);
    this.trips.set([...trips.values()].sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at) || b.id.localeCompare(a.id)));
  }

  private isCurrent(owner: string): boolean { return !!owner && owner === this.auth.user()?.id && owner === this.owner; }
  private persist(): Promise<void> { return writeDeviceValue(`trips:${this.owner}`, this.trips()); }
}
