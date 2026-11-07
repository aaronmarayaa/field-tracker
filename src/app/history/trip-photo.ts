import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { readDeviceValue, writeDeviceValue } from '../data/device-store';

function photoKey(userId: string, tripId: string): string { return `photo:${userId}:${tripId}`; }

export async function localTripPhoto(userId: string, tripId: string): Promise<string | null> {
  const blob = await readDeviceValue<Blob>(photoKey(userId, tripId));
  return blob ? URL.createObjectURL(blob) : null;
}

export async function takeTripPhoto(userId: string, tripId: string): Promise<{ url: string; gallerySaved: boolean }> {
  const photo = await Camera.takePhoto({ quality: 80, targetWidth: 1600, targetHeight: 2000, saveToGallery: true });
  const source = photo.webPath ?? (photo.uri ? Capacitor.convertFileSrc(photo.uri) : null);
  if (!source) throw new Error('The camera did not return a photo. Please try again.');
  const response = await fetch(source);
  if (!response.ok) throw new Error('The captured photo could not be opened.');
  const blob = await response.blob();
  // The photo is stored on this device only; REST trip records never contain it.
  await writeDeviceValue(photoKey(userId, tripId), blob);
  return { url: URL.createObjectURL(blob), gallerySaved: photo.saved };
}

export async function exportTripImage(canvas: HTMLCanvasElement, tripId: string, share: boolean): Promise<'shared' | 'saved' | 'downloaded'> {
  const fileName = `field-tracker-${tripId}.png`;
  const data = canvas.toDataURL('image/png');
  if (Capacitor.isNativePlatform()) {
    const file = await Filesystem.writeFile({ path: fileName, data: data.split(',')[1], directory: share ? Directory.Cache : Directory.Documents });
    if (share) {
      await Share.share({ title: 'Field Tracker', files: [file.uri], dialogTitle: 'Share your trip' });
      return 'shared';
    }
    return 'saved';
  }
  if (share && navigator.canShare) {
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('The trip image could not be created.'))));
    const file = new File([blob], fileName, { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Field Tracker' });
      return 'shared';
    }
  }
  download(data, fileName);
  return 'downloaded';
}

function download(url: string, name: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
}
