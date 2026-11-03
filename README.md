# Field Tracker

A small Ionic Angular standalone app for one trip at a time. The sporty interface uses a large stopwatch, charcoal surfaces, orange recording controls, and the three running photos you supplied.

## Try it in a browser

Use a compatible Node.js version: 22.22.3+, 24.15.0+, or 26+. This project was checked with Node 24.19.0.

```powershell
npm install
npm start
```

Open the local URL printed in the terminal. Allow location when asked. Start outdoors for a better GPS signal, move, then tap **Finish trip**.

If the Ionic CLI is installed, you can also run `ionic serve`. The Angular project is named `app` to match the Ionic CLI's default target, so no extra project flag is needed.

Browser location needs HTTPS or localhost. Opening an HTTP address from another device on your Wi-Fi will usually prevent location access. Use a native Android or iOS build for a walk with your phone.

## What it records

- Current speed in km/h or mph, when a reading is available.
- Distance from successive GPS readings, in kilometers or miles.
- Elapsed time, including time spent stopped.
- Starting coordinates and time.
- Latest coordinates during tracking, or the last accepted coordinates when finished.
- Finish time and average speed for the whole trip.
- A map with a starting marker, moving location marker, and recorded route line.

**Finish is manual.** There is no destination search or automatic arrival detection. Coordinates are latitude and longitude. Leaflet displays the street map using OpenStreetMap tiles; there is no address lookup.

On **Android**, start the trip while the app is visible and allow precise location and notification permissions. A persistent **Field Tracker is recording** notification accompanies the location service. You can lock the screen or switch apps during the trip. Tap the notification to return, then tap **Finish trip** to stop the service.

In a **browser**, keep the app visible and the screen awake. Browser tracking still ends when the page becomes hidden.

On **iOS**, the native app uses the same background-location plugin, with iOS location permission descriptions and background capability configured. Allow precise/background location, start while visible, then lock the screen. Tap **Finish trip** to remove the watcher. See [iOS setup and TestFlight](IOS_SETUP.md) for signing, installation, and the required real-device check.

A fully powered-off phone cannot record GPS. Force-stopping the app or Android terminating its process also ends this in-memory session. Some phones' battery restrictions can interrupt services; if that happens, allow unrestricted battery use for Field Tracker in Android settings.

Trip data stays in memory. Starting another trip clears it; reloading or closing the app loses it. There is no account, database, or trip history.

## Read the code in this order

| File | What to look for |
| --- | --- |
| `src/app/home/home.page.html` | The screen: readings, controls, and location log. |
| `src/app/home/home.page.ts` | `startTrip()`, `recordPosition()`, and `finishTrip()`. |
| `src/app/home/tracking.ts` | Distance, unit conversions, and time formatting. |
| `src/app/home/location-watch.ts` | Chooses the native Android/iOS background watcher or the browser watcher, and stops the correct one. |
| `src/app/tracking-map/tracking-map.component.ts` | Creates the map, draws accepted GPS points, and cleans up its map instance. |
| `src/app/tracking-map/tracking-map.component.html` | Map states, legend, and Center on me control. |
| `src/app/home/home.page.scss` | Mobile-first layout, with medium and wide states. |
| `src/global.scss` | Shared colors, type, and keyboard focus. |
| `src/assets/sports/` | Your three running photographs, bundled for offline native use. |
| `src/main.ts` | Starts Angular and configures Ionic. |

Angular **signals** are values that update the screen when they change. `unit()` reads a value; `unit.set('mi')` changes it; `distanceMeters.update(...)` changes it using the previous value. The `@if` and `@switch` blocks in the HTML choose what the screen displays.

The big stopwatch shows hours, minutes, and seconds. Its orange ring sweeps once per minute using the elapsed seconds. The HTML passes an angle to the CSS through `--elapsed-angle`; no separate animation timer is needed. On Finish, both the digits and the ring freeze.

`Geolocation.getCurrentPosition()` finds the start. The `location-watch.ts` helper selects the watcher: browsers use `Geolocation.watchPosition()`; Android and iOS use `BackgroundGeolocation.addWatcher()`. Android also requires a persistent notification. iOS requests background location authorization through the plugin. Finish removes that same watcher. A session number lets the page ignore late responses after Cancel or Finish.

The Android helper converts native fixes into the same position format used by the existing calculations. Capacitor's `android.useLegacyBridge` is enabled because the [background-location plugin](https://github.com/capacitor-community/background-geolocation) requires it for continued background delivery.

### How the map works

The parent page passes the start, latest location, accepted route points, and trip state to a small standalone map component through `@Input()` properties. The map does not request location or start a second GPS watcher.

`routePoints` keeps the accepted fixes in memory, including updates received while the screen is locked. When Angular next redraws the map, it adds every pending point. The white marker identifies the start; the orange marker identifies the current location or finish. The route is frozen on Finish and cleared when a new trip begins.

Dragging the map pauses automatic centering. **Center on me** resumes following. Use the zoom buttons or pinch to inspect the route. Map tiles need internet, but a tile-loading failure does not stop GPS calculations or route recording; **Reload map** retries the street background.

Leaflet is bundled with the app; the street tiles are loaded from OpenStreetMap with visible attribution. This uses the standard [OpenStreetMap tile service](https://operations.osmfoundation.org/policies/tiles/), with normal browser caching and no bulk or offline downloads. The Android WebView identifies itself as Field Tracker through its appended user agent.

All distance is kept in **meters**, all speed in **meters per second**. Unit buttons change only the display. `distanceBetween()` uses the Haversine formula to calculate the distance along the earth between two coordinates. The page adds traveled segments rather than measuring a straight line from start to finish.

GPS measurements are estimates. This version ignores readings with accuracy worse than 50 m, movements below a small noise threshold, old timestamps, and jumps faster than 100 m/s. These simple filters reduce obvious errors but can miss short or slow movements and cannot match a mature fitness tracker. Speed falls back to distance divided by time if the phone does not supply it. A speed reading older than 15 seconds is hidden.

## Run on Android

The native `android/` project is already included, with precise/coarse location, location foreground-service, and notification permissions. Its package ID is the development placeholder `com.example.fieldtracker`, and it retains the default Capacitor launcher icon as a placeholder. The recording notification uses a separate location status icon.

1. Install Android Studio with Android SDK 36 and a Java 21 JDK. Android Studio can provide the JDK.
2. Build and copy the web app into the Android project:

   ```powershell
   npm run android:sync
   npm run android:open
   ```

3. In Android Studio, choose your connected phone or emulator and run the app. Enable phone location and allow **precise** location and **notifications** when prompted.
4. Test outside on a real phone. An emulator needs simulated location movement.

After changing the Angular app, run `npm run android:sync` again before running Android. No live-reload server URL is embedded in the native app.

The production web build, browser/native-bridge simulations, and Capacitor Android sync are checked locally. No Android SDK or connected phone was available here, so native APK compilation and real screen-lock behavior still need device verification. Build and reinstall the APK after these plugin/configuration changes; restarting the browser preview alone cannot add Android background tracking.

For a phone check, start a trip outdoors, confirm the persistent recording notification, lock the screen for at least six minutes while moving, and reopen the app. Check that the stopwatch, distance, and route include that period. Finish the trip and confirm that the recording notification disappears.

## Build for iPhone

The native `ios/` project and `.github/workflows/ios.yml` are included. Pushes and pull requests build an unsigned simulator app on a GitHub macOS runner. A manual run can sign and upload a physical-iPhone build to App Store Connect after you configure the Apple credentials. A configured TestFlight public invitation link produces a downloadable QR and an Actions summary link/image.

Follow [IOS_SETUP.md](IOS_SETUP.md) for the GitHub variables/secrets, Apple setup, and tester instructions. Testers install through Apple TestFlight; the simulator ZIP and signed IPA artifact are not ordinary public iPhone installers. No Apple account credentials are included in this project.

## Build an APK with GitHub Actions

The workflow is in `.github/workflows/android.yml`. Push this project to a GitHub repository, including `android/`, the Gradle wrapper files, and `package-lock.json`.

It runs on pushes and pull requests. You can also open **Actions > Android APK > Run workflow** on GitHub to start it manually once the workflow is on the repository's default branch.

The job installs Node.js 24, Java 21, and the Android SDK, runs the calculation tests, builds the web app, syncs Capacitor, and builds a debug APK. It uploads `app-debug.apk` as the `field-tracker-debug-apk` artifact, retained for 14 days.

After a successful run, open the run's **Artifacts** section, download `field-tracker-debug-apk`, extract it, and transfer the APK to your phone. This debug build uses Android's debug signing and needs no signing secrets. A Play Store release build is a separate setup.

### Download with a QR code

After a successful push to the repository's default branch, or a manual **Run workflow**, a second job publishes a GitHub prerelease with:

- `field-tracker.apk`: the installable Android app.
- `install-qr.png`: a QR code pointing directly to that build's APK download.
- `download-url.txt`: the same link as plain text.

Open **Actions > Android APK > the successful run > Summary** to see the QR code, or open the repository's **Releases** page. Scan the code with your Android phone, download the APK, and open it to install. Android may ask you to allow installation from your browser.

The workflow also uploads a `field-tracker-install` artifact containing the APK, QR image, and link. Each published build gets its own release tag so an existing QR keeps pointing to the same APK. Release downloads last until that release is deleted; Actions artifacts are retained for 14 days.

Public repositories allow the QR download without a GitHub login. Private repositories require an authorized GitHub sign-in on the phone. Pull requests and pushes to other branches produce the original APK artifact without publishing a release or QR code.

If an older debug installation rejects an update because the build's signing key differs, uninstall that debug app before installing the new APK.

The workflow and QR generation have been checked locally. A working app download QR is produced after the first successful GitHub build and release publication; a local example URL does not host an APK.

## Checks

```powershell
npm run build
npm test
npx playwright install chromium
npm run test:ui
```

Calculation tests use Node's built-in test runner. Browser tests cover the original controls plus map movement, route reset, unavailable tiles, recentering, zoom, and map failure isolation. Native-bridge fixtures verify Android and iOS hidden-state recording, batched route fixes, native permission behavior, and watcher cleanup. These simulations do not replace real-device screen-lock tests. Test coordinates and map tiles are fixtures, never preloaded into the app. The iOS workflow also runs `python -m unittest discover -s tests -p 'ios_signing_test.py'` to check its signing configuration helper.

Read `VERIFICATION.md` for the recorded checks and the antislop delivery gate.
