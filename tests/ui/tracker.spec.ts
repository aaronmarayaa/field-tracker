import { expect, test, type Page } from '@playwright/test';

async function fakeGps(page: Page): Promise<void> {
  await page.addInitScript(() => {
    let callback: PositionCallback | null = null;
    let watchError: PositionErrorCallback | null = null;
    let pending: PositionCallback | null = null;
    let denyPermission = false;
    let delayPosition = false;
    const position = (latitude = 14.5995, longitude = 120.9842, speed: number | null = null, accuracy = 5, timestamp = Date.now()) => ({
      coords: { latitude, longitude, speed, accuracy, altitude: null, altitudeAccuracy: null, heading: null },
      timestamp,
    }) as GeolocationPosition;
    const gps = {
      getCurrentPosition(success: PositionCallback, error?: PositionErrorCallback) {
        if (denyPermission) { error?.({ code: 1, message: 'Permission denied' } as GeolocationPositionError); return; }
        if (delayPosition) { pending = success; return; }
        success(position());
      },
      watchPosition(success: PositionCallback, error?: PositionErrorCallback) {
        callback = success;
        watchError = error ?? null;
        return 1;
      },
      clearWatch() { callback = null; watchError = null; },
    };
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: gps });
    Object.assign(window, {
      testGps: {
        emit(latitude: number, longitude: number, speed: number | null, accuracy: number, timestamp: number) {
          callback?.(position(latitude, longitude, speed, accuracy, timestamp));
        },
        deny() { denyPermission = true; },
        delay() { delayPosition = true; },
        resolve() { pending?.(position()); pending = null; },
        fail() { watchError?.({ code: 2, message: 'GPS signal lost' } as GeolocationPositionError); },
        watching() { return callback !== null; },
      },
    });
  });
}

async function gpsAction(page: Page, action: string, args: unknown[] = []): Promise<unknown> {
  return page.evaluate(({ action, args }) => {
    const gps = (window as unknown as { testGps: Record<string, (...values: unknown[]) => unknown> }).testGps;
    return gps[action](...args);
  }, { action, args });
}

test('start, movement, units, weak signal, finish, and a fresh trip', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await fakeGps(page);
  await page.goto('/');
  await expect(page.getByText('Ready when you are')).toBeVisible();
  await page.getByRole('button', { name: 'Start trip', exact: true }).click();
  await expect(page.getByText('Recording your trip')).toBeVisible();
  await expect(page.getByTestId('start-location')).toHaveText('14.59950, 120.98420');
  await expect.poll(() => gpsAction(page, 'watching')).toBe(true);

  await page.clock.install();
  await page.clock.fastForward(10000);
  await expect.poll(() => page.locator('.stopwatch-dial').evaluate((dial) => parseFloat((dial as HTMLElement).style.getPropertyValue('--elapsed-angle')))).toBeGreaterThan(0);
  await gpsAction(page, 'emit', [14.6005, 120.9842, 3, 5, Date.now() + 10000]);
  await expect(page.getByTestId('speed')).toHaveText('10.8');
  await expect(page.getByTestId('distance')).toHaveText('0.11');
  await page.getByRole('button', { name: 'mi', exact: true }).click();
  await expect(page.getByTestId('speed')).toHaveText('6.7');
  await expect(page.getByTestId('distance')).toHaveText('0.07');
  await page.getByRole('button', { name: 'km', exact: true }).click();

  await gpsAction(page, 'emit', [14.7, 120.9842, 12, 100, Date.now() + 12000]);
  await expect(page.getByText('Weak GPS signal.', { exact: false })).toBeVisible();
  await expect(page.getByTestId('distance')).toHaveText('0.11');
  await gpsAction(page, 'fail');
  await expect(page.getByText('GPS signal lost')).toBeVisible();

  await page.getByRole('button', { name: 'Finish trip', exact: true }).click();
  await expect(page.getByText('Trip finished', { exact: true })).toBeVisible();
  await expect(page.getByText('Average speed', { exact: true })).toBeVisible();
  await expect(page.getByTestId('end-location')).toHaveText('14.60050, 120.98420');
  expect(await gpsAction(page, 'watching')).toBe(false);
  const distance = await page.getByTestId('distance').innerText();
  const duration = await page.getByTestId('duration').innerText();
  const finishedAngle = await page.locator('.stopwatch-dial').getAttribute('style');
  await page.clock.fastForward(30000);
  await expect(page.getByTestId('duration')).toHaveText(duration);
  await expect(page.locator('.stopwatch-dial')).toHaveAttribute('style', finishedAngle!);
  await expect(page.getByTestId('distance')).toHaveText(distance);

  await page.getByRole('button', { name: 'Start another trip', exact: true }).click();
  await expect(page.getByTestId('distance')).toHaveText('0.00');
  await expect(page.getByText('Recording your trip')).toBeVisible();
  await page.getByRole('button', { name: 'Finish trip', exact: true }).click();
  expect(errors).toEqual([]);
});

test('denied location permission has an actionable error', async ({ page }) => {
  await fakeGps(page);
  await page.goto('/');
  await gpsAction(page, 'deny');
  await page.getByRole('button', { name: 'Start trip', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Location permission was denied');
  await expect(page.getByRole('button', { name: 'Start trip', exact: true })).toBeEnabled();
  expect(await gpsAction(page, 'watching')).toBe(false);
});

test('cancel ignores a late GPS response', async ({ page }) => {
  await fakeGps(page);
  await page.goto('/');
  await gpsAction(page, 'delay');
  await page.getByRole('button', { name: 'Start trip', exact: true }).click();
  await expect(page.getByText('Finding your location')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await gpsAction(page, 'resolve');
  await expect(page.getByText('Ready when you are')).toBeVisible();
  await expect(page.getByTestId('start-location')).toHaveCount(0);
  expect(await gpsAction(page, 'watching')).toBe(false);
});

test('hiding the page ends foreground tracking', async ({ page }) => {
  await fakeGps(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start trip', exact: true }).click();
  await expect(page.getByText('Recording your trip')).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByText('Trip finished', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('app was hidden');
  expect(await gpsAction(page, 'watching')).toBe(false);
});

test('missing speed is estimated; jumps are rejected; old speed is hidden', async ({ page }) => {
  await fakeGps(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Start trip', exact: true }).click();
  await expect(page.getByText('Recording your trip')).toBeVisible();
  await expect.poll(() => gpsAction(page, 'watching')).toBe(true);
  await page.clock.install();
  await page.clock.fastForward(10000);
  const timestamp = await page.evaluate(() => Date.now());
  await gpsAction(page, 'emit', [14.5996, 120.9842, null, 5, timestamp]);
  await expect(page.getByTestId('distance')).toHaveText('0.01');
  const estimatedSpeed = Number(await page.getByTestId('speed').innerText());
  expect(estimatedSpeed).toBeGreaterThan(0);
  expect(estimatedSpeed).toBeLessThan(5);

  await gpsAction(page, 'emit', [15.5996, 120.9842, 200, 5, timestamp + 1000]);
  await expect(page.getByText('GPS jumped unexpectedly.', { exact: false })).toBeVisible();
  await expect(page.getByTestId('end-location')).toHaveText('14.59960, 120.98420');
  await expect(page.getByTestId('distance')).toHaveText('0.01');
  await gpsAction(page, 'emit', [14.5997, 120.9842, 2, 5, timestamp + 2000]);
  await expect(page.getByTestId('speed')).toHaveText('7.2');
  await page.clock.fastForward(18000);
  await expect(page.getByText('Waiting for a fresh GPS reading.')).toBeVisible();
  await expect(page.getByLabel('No speed reading yet')).toBeVisible();
  await page.getByRole('button', { name: 'Finish trip', exact: true }).click();
});

test('phone, tablet, and desktop reflow without overflow; all controls support keyboard', async ({ page }) => {
  await fakeGps(page);
  await page.goto('/');
  for (const photo of await page.locator('.sport-visual img').all()) {
    await expect(photo).toBeVisible();
    expect(await photo.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  }
  for (const width of [320, 360, 390, 520, 640, 768, 960, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const overflow = await page.evaluate(() => {
      const root = document.querySelector('ion-content')!.shadowRoot!.querySelector('.inner-scroll')!;
      return root.scrollWidth > root.clientWidth;
    });
    expect(overflow, `horizontal overflow at ${width}px`).toBe(false);
    for (const label of ['km', 'mi', 'Start trip']) {
      const box = await page.getByRole('button', { name: label, exact: true }).boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('.page-footer').scrollIntoViewIfNeeded();
  await expect(page.getByText('Foreground GPS · No account needed')).toBeInViewport();
  await page.locator('.wordmark').scrollIntoViewIfNeeded();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'km', exact: true })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'mi', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Recording your trip')).toBeVisible();
  await page.getByRole('button', { name: 'Finish trip', exact: true }).click();
});
