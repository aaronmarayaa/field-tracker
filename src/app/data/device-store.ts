let database: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  return database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('field-tracker', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('device');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Device storage could not open. Allow website storage and try again.'));
  }).catch((error) => { database = null; throw error; });
}

export async function readDeviceValue<T>(key: string): Promise<T | undefined> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction('device').objectStore('device').get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(new Error('Saved data could not be read from this device.'));
  });
}

export async function writeDeviceValue(key: string, value: unknown): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('device', 'readwrite');
    transaction.objectStore('device').put(value, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error('This device could not save the trip. Free some storage and retry before closing.'));
    transaction.onabort = transaction.onerror;
  });
}
