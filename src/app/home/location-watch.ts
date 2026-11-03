import { Capacitor, registerPlugin } from '@capacitor/core';
import { Geolocation, type PositionOptions, type WatchPositionCallback } from '@capacitor/geolocation';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { BackgroundGeolocationPlugin } from '@capacitor-community/background-geolocation';

const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation');
const backgroundPrefix = 'background:';

export function supportsBackgroundTracking(): boolean {
  const platform = Capacitor.getPlatform();
  return platform === 'android' || platform === 'ios';
}

export async function prepareBackgroundTracking(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return;

  let permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') permission = await LocalNotifications.requestPermissions();
  if (permission.display !== 'granted') {
    throw new Error('Allow notifications in Android settings to start screen-off tracking.');
  }
}

export async function startLocationWatch(options: PositionOptions, callback: WatchPositionCallback): Promise<string> {
  if (!supportsBackgroundTracking()) return Geolocation.watchPosition(options, callback);

  const id = await BackgroundGeolocation.addWatcher({
    backgroundTitle: 'Field Tracker is recording',
    backgroundMessage: 'Recording GPS with the screen off. Tap to open the trip.',
    requestPermissions: Capacitor.getPlatform() === 'ios',
    stale: false,
    distanceFilter: 0,
  }, (location, error) => {
    if (error) {
      callback(null, error.code === 'NOT_AUTHORIZED' ? { code: 1, message: error.message } : error);
      return;
    }
    if (!location) return;

    // Normalize native fixes so the same distance and speed logic handles both platforms.
    callback({
      timestamp: location.time ?? Date.now(),
      coords: {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        speed: location.speed,
        altitude: location.altitude,
        altitudeAccuracy: location.altitudeAccuracy,
        heading: location.bearing,
        magneticHeading: null,
        trueHeading: null,
        headingAccuracy: null,
        course: location.bearing,
      },
    });
  });
  return backgroundPrefix + id;
}

export async function stopLocationWatch(id: string): Promise<void> {
  if (id.startsWith(backgroundPrefix)) {
    await BackgroundGeolocation.removeWatcher({ id: id.slice(backgroundPrefix.length) });
  } else {
    await Geolocation.clearWatch({ id });
  }
}
