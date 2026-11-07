import { expect, test, type Page } from '@playwright/test';
import { mockSupabase } from './supabase-fixture';

async function routeFixture(page: Page): Promise<void> {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#ececdf"/></svg>',
  }));
  await page.addInitScript(() => {
    let watcher: PositionCallback | null = null;
    const fix = (latitude: number, longitude: number, timestamp: number) => ({ coords: { latitude, longitude, accuracy: 4, speed: 4 }, timestamp }) as GeolocationPosition;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition(success: PositionCallback) { success(fix(14.5995, 120.9842, Date.now())); },
      watchPosition(success: PositionCallback) { watcher = success; return 1; },
      clearWatch() { watcher = null; },
    } });
    Object.assign(window, { emitTripRoute() {
      const start = Date.now() - 600000;
      [[14.6000, 120.9833], [14.6019, 120.9824], [14.6034, 120.9827], [14.6042, 120.9841], [14.6036, 120.9856], [14.6021, 120.9858], [14.6018, 120.9871], [14.6035, 120.9875], [14.6045, 120.9880], [14.6057, 120.9874], [14.6062, 120.9858], [14.6054, 120.9848], [14.6044, 120.9854], [14.6039, 120.9861]].forEach(([lat, lng], index) => watcher?.(fix(lat, lng, start + (index + 1) * 40000)));
    } });
  });
}

async function finishTrip(page: Page, unit: 'km' | 'mi' = 'mi'): Promise<void> {
  await page.getByRole('button', { name: unit, exact: true }).click();
  await page.getByRole('button', { name: 'Start trip', exact: true }).click();
  await expect(page.getByText('Recording your trip', { exact: true })).toBeVisible();
  await expect(page.locator('.route-location-marker')).toBeAttached();
  await page.clock.install();
  await page.clock.fastForward(600000);
  await page.evaluate(() => (window as unknown as { emitTripRoute(): void }).emitTripRoute());
  await page.getByRole('button', { name: 'Finish trip', exact: true }).click();
  await expect(page.getByText('Trip kept in your history.', { exact: false })).toBeVisible();
}

async function openHistory(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Trip history', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

async function showFirstTrip(page: Page): Promise<void> {
  await page.locator('.history-trip').first().click();
  await expect(page.getByRole('button', { name: 'Save trip image' })).toBeEnabled();
}

test('registration and sign-in keep trips separated between accounts', async ({ page }) => {
  const backend = await mockSupabase(page, false);
  await routeFixture(page);
  await page.goto('/');
  await page.getByLabel('Email address').fill('runner@example.com');
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Invalid login credentials');
  await page.getByLabel('Password', { exact: true }).fill('test-password-1');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await finishTrip(page);
  await expect.poll(() => backend.rows.size).toBe(1);
  await openHistory(page);
  await expect(page.locator('.history-trip')).toHaveCount(1);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('button', { name: 'New here? Create an account' }).click();
  await page.getByLabel('Email address').fill('another-runner@example.com');
  await page.getByLabel('Password', { exact: true }).fill('test-password-2');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await openHistory(page);
  await expect(page.getByText('Your first finish is ahead.')).toBeVisible();
  await expect(page.locator('.history-trip')).toHaveCount(0);
  await page.getByRole('button', { name: 'Back to tracker' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await openHistory(page);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByLabel('Email address').fill('runner@example.com');
  await page.getByLabel('Password', { exact: true }).fill('test-password-1');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await openHistory(page);
  await expect(page.locator('.history-trip')).toHaveCount(1);
});

test('Finish saves selected units and route, backgrounds persist, and the image downloads', async ({ page }, testInfo) => {
  const backend = await mockSupabase(page);
  await routeFixture(page);
  await page.goto('/');
  const order = await page.locator('app-tracking-map, .ground-section').evaluateAll((elements) => elements.map((element) => element.tagName));
  expect(order).toEqual(['APP-TRACKING-MAP', 'SECTION']);
  await finishTrip(page);
  await expect.poll(() => backend.writes.length).toBe(1);
  const trip = backend.writes[0];
  expect(trip.unit).toBe('mi');
  expect(trip.distance_meters).toBeGreaterThan(1000);
  expect(trip.route.length).toBeGreaterThan(8);
  expect(trip.background).toBe(0);
  await page.getByRole('button', { name: 'km', exact: true }).click();
  await openHistory(page);
  await showFirstTrip(page);
  const poster = page.getByRole('img', { name: /Field Tracker trip:/ });
  await expect(poster).toHaveAccessibleName(/mi, pace \d+:\d{2} per mi, time 00:10:/);
  await expect(page.getByRole('button', { name: 'Starting line background' })).toHaveAttribute('aria-pressed', 'true');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save trip image' }).click();
  const image = await download;
  expect(image.suggestedFilename()).toMatch(/^field-tracker-.*\.png$/);
  await image.saveAs(testInfo.outputPath('trip-image.png'));
  for (const background of ['Grass runner background', 'Road runner background']) {
    await page.getByRole('button', { name: background }).click();
    await expect(page.getByRole('button', { name: background })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Save trip image' })).toBeEnabled();
  }
  await expect.poll(() => backend.rows.get(trip.id)?.background).toBe(2);
  await page.screenshot({ path: testInfo.outputPath('history-detail-mobile.png') });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.reload();
  await openHistory(page);
  await showFirstTrip(page);
  await expect(page.getByRole('button', { name: 'Road runner background' })).toHaveAttribute('aria-pressed', 'true');
});

test('an offline finish survives reload and retries without duplicate trips', async ({ page }) => {
  const backend = await mockSupabase(page);
  await routeFixture(page);
  await page.goto('/');
  backend.setOnline(false);
  await finishTrip(page, 'km');
  await page.reload();
  await openHistory(page);
  await expect(page.getByText('On device · waiting to sync')).toBeVisible();
  expect(backend.rows.size).toBe(0);
  backend.setOnline(true);
  await page.getByRole('button', { name: 'Refresh trips', exact: true }).click();
  await expect(page.getByText('Saved to your account')).toBeVisible();
  expect(backend.rows.size).toBe(1);
  await page.getByRole('button', { name: 'Refresh trips', exact: true }).click();
  await expect(page.locator('.history-trip')).toHaveCount(1);
  expect(backend.rows.size).toBe(1);
});

test('camera photo stays local, while native export writes a file and can share it', async ({ page }, testInfo) => {
  const backend = await mockSupabase(page);
  const id = '33333333-3333-4333-8333-333333333333';
  backend.rows.set(id, {
    id, user_id: '11111111-1111-4111-8111-111111111111', started_at: '2026-11-07T01:00:00Z', finished_at: '2026-11-07T01:10:00Z',
    unit: 'mi', distance_meters: 1609.344, duration_seconds: 600, background: 0,
    route: [{ latitude: 14.5995, longitude: 120.9842 }, { latitude: 14.6, longitude: 120.987 }, { latitude: 14.6035, longitude: 120.988 }],
  });
  await page.addInitScript(() => {
    const calls: { plugin: string; method: string; directory?: string; saveToGallery?: boolean }[] = [];
    Object.assign(window, {
      webkit: { messageHandlers: { bridge: {} } },
      cameraCalls: calls,
      Capacitor: {
        PluginHeaders: [
          { name: 'Camera', methods: [{ name: 'takePhoto', rtype: 'promise' }] },
          { name: 'Filesystem', methods: [{ name: 'writeFile', rtype: 'promise' }] },
          { name: 'Share', methods: [{ name: 'share', rtype: 'promise' }] },
        ],
        async nativePromise(plugin: string, method: string, options: { directory?: string; saveToGallery?: boolean; path?: string }) {
          calls.push({ plugin, method, directory: options.directory, saveToGallery: options.saveToGallery });
          if (plugin === 'Camera') return { type: 'photo', webPath: 'assets/sports/track-runner.png', saved: true };
          if (plugin === 'Filesystem') return { uri: `file:///Documents/${options.path}` };
          return {};
        },
      },
    });
  });
  await page.goto('/');
  await openHistory(page);
  await showFirstTrip(page);
  await expect(page.getByRole('img', { name: /Field Tracker trip:/ })).toHaveAccessibleName(/1\.00 mi, pace 10:00 per mi, time 00:10:00/);
  await page.getByRole('button', { name: 'Take a photo', exact: true }).click();
  await expect(page.getByText('Photo saved to this phone’s gallery. It is not uploaded.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use my photo', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(backend.writes).toHaveLength(0);
  await page.getByRole('button', { name: 'Save trip image' }).click();
  await expect(page.getByText('Trip image saved in Documents on this phone.')).toBeVisible();
  await page.getByRole('button', { name: 'Share image' }).click();
  await expect(page.getByText('Sharing opened for this image.')).toBeVisible();
  const calls = await page.evaluate(() => (window as unknown as { cameraCalls: unknown[] }).cameraCalls);
  expect(calls).toEqual(expect.arrayContaining([
    expect.objectContaining({ plugin: 'Camera', method: 'takePhoto', saveToGallery: true }),
    expect.objectContaining({ plugin: 'Filesystem', method: 'writeFile', directory: 'DOCUMENTS' }),
    expect.objectContaining({ plugin: 'Filesystem', method: 'writeFile', directory: 'CACHE' }),
    expect.objectContaining({ plugin: 'Share', method: 'share' }),
  ]));
  await page.reload();
  await openHistory(page);
  await showFirstTrip(page);
  await expect(page.getByRole('button', { name: 'Use my photo', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Starting line background' }).click();
  await expect(page.getByRole('button', { name: 'Starting line background' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Use my photo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Use my photo', exact: true })).toHaveAttribute('aria-pressed', 'true');
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.getByRole('dialog').evaluate((dialog) => dialog.scrollWidth > dialog.clientWidth)).toBe(false);
  }
  await page.screenshot({ path: testInfo.outputPath('history-detail-desktop.png') });
  await page.getByRole('button', { name: 'Back to trips' }).click();
  await expect(page.locator('.history-trip')).toHaveCount(1);
  await page.getByRole('button', { name: 'Close trip history' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('an expired session refreshes before history loads and older trips can be opened', async ({ page }) => {
  const backend = await mockSupabase(page, true, true);
  for (let day = 1; day <= 26; day++) {
    const id = `33333333-3333-4333-8333-${String(day).padStart(12, '0')}`;
    const date = `2026-10-${String(day).padStart(2, '0')}`;
    backend.rows.set(id, {
      id, user_id: '11111111-1111-4111-8111-111111111111', started_at: `${date}T01:00:00Z`, finished_at: `${date}T01:10:00Z`,
      unit: 'km', distance_meters: 1000, duration_seconds: 600, background: 0, route: [],
    });
  }
  await page.goto('/');
  await openHistory(page);
  await expect(page.locator('.history-trip')).toHaveCount(25);
  expect(backend.refreshCount()).toBe(1);
  await page.getByRole('button', { name: 'Load older trips' }).click();
  await expect(page.locator('.history-trip')).toHaveCount(26);
  await expect(page.getByRole('button', { name: 'Load older trips' })).toHaveCount(0);
  await page.locator('.history-trip').last().click();
  await expect(page.getByRole('img', { name: /1\.00 km, pace 10:00 per km, time 00:10:00/ })).toBeVisible();
});

test('a device write failure keeps the finished trip available to retry', async ({ page }) => {
  const backend = await mockSupabase(page);
  await routeFixture(page);
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    let failOnce = true;
    IDBObjectStore.prototype.put = function (value, key) {
      if (failOnce && typeof key === 'string' && key.startsWith('trips:') && Array.isArray(value) && value.some((trip) => trip.syncState === 'pending')) {
        failOnce = false;
        throw new DOMException('Device storage is full.', 'QuotaExceededError');
      }
      return put.call(this, value, key);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start trip', exact: true }).click();
  await page.getByRole('button', { name: 'Finish trip', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start another trip' })).toBeDisabled();
  await page.getByRole('button', { name: 'Retry saving trip' }).click();
  await expect(page.getByText('Trip kept in your history.', { exact: false })).toBeVisible();
  await expect.poll(() => backend.rows.size).toBe(1);

  const photo = '**/trip-backgrounds/starting-line.png';
  await page.route(photo, (route) => route.abort('failed'));
  await openHistory(page);
  await page.locator('.history-trip').first().click();
  await expect(page.getByRole('button', { name: 'Retry image' })).toBeVisible();
  await page.unroute(photo);
  await page.getByRole('button', { name: 'Retry image' }).click();
  await expect(page.getByRole('button', { name: 'Save trip image' })).toBeEnabled();
});
