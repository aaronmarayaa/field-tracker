import { expect, test, type Page } from '@playwright/test';

async function mockNative(page: Page, platform: 'android' | 'ios' = 'android'): Promise<void> {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({
    contentType: 'image/svg+xml',
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e8ebdf"/></svg>',
  }));
  await page.addInitScript((platform) => {
    let watcher: ((location: unknown, error?: unknown) => void) | null = null;
    let notificationsDenied = false;
    let notificationPermission = 'prompt';
    let watcherCount = 0;
    let removalCount = 0;
    let watcherOptions: Record<string, unknown> = {};
    const hidden = (value: boolean) => {
      Object.defineProperty(document, 'hidden', { configurable: true, value });
      document.dispatchEvent(new Event('visibilitychange'));
    };

    const location = (latitude: number, longitude: number, time: number) => ({
      latitude, longitude, time, accuracy: 5, speed: 3,
      altitude: null, altitudeAccuracy: null, bearing: null, simulated: true,
    });
    const nativePromise = async (plugin: string, method: string) => {
      if (plugin === 'Geolocation') {
        if (method === 'checkPermissions' || method === 'requestPermissions') {
          return { location: 'granted', coarseLocation: 'granted' };
        }
        if (method === 'getCurrentPosition') {
          return { timestamp: Date.now(), coords: { latitude: 14.5995, longitude: 120.9842, accuracy: 5, speed: null } };
        }
      }
      if (plugin === 'LocalNotifications') {
        if (platform === 'ios') throw new Error('iOS must not request the Android notification permission.');
        if (method === 'requestPermissions') {
          hidden(true);
          await Promise.resolve();
          notificationPermission = notificationsDenied ? 'denied' : 'granted';
          hidden(false);
        }
        return { display: notificationPermission };
      }
      if (plugin === 'BackgroundGeolocation' && method === 'removeWatcher') {
        watcher = null;
        removalCount++;
        return {};
      }
      throw new Error(`Unexpected native promise: ${plugin}.${method}`);
    };
    const nativeCallback = (plugin: string, method: string, options: Record<string, unknown>, callback: (position: unknown) => void) => {
      if (plugin !== 'BackgroundGeolocation' || method !== 'addWatcher') {
        throw new Error(`Unexpected native callback: ${plugin}.${method}`);
      }
      watcher = callback;
      watcherOptions = options;
      watcherCount++;
      if (platform === 'ios') {
        hidden(true);
        hidden(false);
      }
      return `native-watcher-${watcherCount}`;
    };
    Object.assign(window, {
      ...(platform === 'android' ? { androidBridge: {} } : { webkit: { messageHandlers: { bridge: {} } } }),
      Capacitor: {
        nativePromise,
        nativeCallback,
        PluginHeaders: [
          { name: 'Geolocation', methods: ['checkPermissions', 'requestPermissions', 'getCurrentPosition'].map((name) => ({ name, rtype: 'promise' })) },
          { name: 'LocalNotifications', methods: ['checkPermissions', 'requestPermissions'].map((name) => ({ name, rtype: 'promise' })) },
          { name: 'BackgroundGeolocation', methods: [{ name: 'addWatcher', rtype: 'callback' }, { name: 'removeWatcher', rtype: 'promise' }] },
        ],
      },
      nativeFixture: {
        state() { return { watching: watcher !== null, watcherCount, removalCount, watcherOptions }; },
        denyNotifications() { notificationsDenied = true; },
        hidden,
        emitBatch() {
          const now = Date.now();
          watcher?.(location(14.6000, 120.9847, now + 10000));
          watcher?.(location(14.5995, 120.9852, now + 20000));
          watcher?.(location(14.6002, 120.9857, now + 30000));
        },
      },
    });
  }, platform);
}

async function nativeAction(page: Page, action: string, args: unknown[] = []): Promise<unknown> {
  return page.evaluate(({ action, args }) => {
    const fixture = (window as unknown as { nativeFixture: Record<string, (...values: unknown[]) => unknown> }).nativeFixture;
    return fixture[action](...args);
  }, { action, args });
}

for (const platform of ['android', 'ios'] as const) {
  test(`${platform} keeps its native watcher when hidden and retains every batched route point`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await mockNative(page, platform);
    await page.goto('/');
    await page.getByRole('button', { name: 'Start trip', exact: true }).click();
    await expect(page.getByText('Recording your trip', { exact: true })).toBeVisible();
    await expect(page.locator('.route-location-marker')).toBeAttached();
    await expect.poll(() => nativeAction(page, 'state')).toMatchObject({ watching: true, watcherCount: 1 });
    const state = await nativeAction(page, 'state') as { watcherOptions: Record<string, unknown> };
    expect(state.watcherOptions['backgroundMessage']).toBeTruthy();
    expect(state.watcherOptions['backgroundTitle']).toBe('Field Tracker is recording');
    expect(state.watcherOptions['stale']).toBe(false);
    expect(state.watcherOptions['requestPermissions']).toBe(platform === 'ios');
    await expect(page.locator('.control-note')).toContainText(`${platform === 'ios' ? 'iOS' : 'Android'} keeps recording`);

    await page.clock.install();
    await nativeAction(page, 'hidden', [true]);
    await page.clock.fastForward(360000);
    await nativeAction(page, 'emitBatch');
    await nativeAction(page, 'hidden', [false]);
    await expect(page.getByText('Recording your trip', { exact: true })).toBeVisible();
    await expect(page.getByTestId('duration')).toContainText('00:06:');
    await expect(page.getByTestId('speed')).toHaveText('10.8');
    await expect(page.locator('.map-coordinate')).toHaveText('14.60020, 120.98570');
    await expect.poll(async () => {
      const path = await page.locator('.route-line').getAttribute('d');
      return (path?.match(/L/g) ?? []).length;
    }).toBeGreaterThanOrEqual(3);
    expect(Number(await page.getByTestId('distance').innerText())).toBeGreaterThan(0.1);

    await page.getByRole('button', { name: 'Finish trip', exact: true }).click();
    await expect(page.getByText('Trip finished', { exact: true })).toBeVisible();
    await expect.poll(() => nativeAction(page, 'state')).toMatchObject({ watching: false, removalCount: 1 });
    expect(errors).toEqual([]);
  });
}

test('denied Android notifications leave Start available without starting a service', async ({ page }) => {
  await mockNative(page);
  await page.goto('/');
  await nativeAction(page, 'denyNotifications');
  await page.getByRole('button', { name: 'Start trip', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Allow notifications in Android settings');
  await expect(page.getByRole('button', { name: 'Start trip', exact: true })).toBeEnabled();
  expect(await nativeAction(page, 'state')).toMatchObject({ watching: false, watcherCount: 0 });
});

test('Android starts one background watcher per trip and removes it on each Finish', async ({ page }) => {
  await mockNative(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start trip', exact: true }).click();
  await expect.poll(() => nativeAction(page, 'state')).toMatchObject({ watcherCount: 1, watching: true });
  await page.getByRole('button', { name: 'Finish trip', exact: true }).click();
  await expect.poll(() => nativeAction(page, 'state')).toMatchObject({ removalCount: 1, watching: false });
  await page.getByRole('button', { name: 'Start another trip', exact: true }).click();
  await expect.poll(() => nativeAction(page, 'state')).toMatchObject({ watcherCount: 2, watching: true });
  await expect(page.getByTestId('distance')).toHaveText('0.00');
  await page.getByRole('button', { name: 'Finish trip', exact: true }).click();
  await expect.poll(() => nativeAction(page, 'state')).toMatchObject({ removalCount: 2, watching: false });
});
