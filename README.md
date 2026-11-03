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

Browser location needs HTTPS or localhost. Opening an HTTP address from another device on your Wi-Fi will usually prevent location access. Use the Android app for a walk with your phone.

## What it records

- Current speed in km/h or mph, when a reading is available.
- Distance from successive GPS readings, in kilometers or miles.
- Elapsed time, including time spent stopped.
- Starting coordinates and time.
- Latest coordinates during tracking, or the last accepted coordinates when finished.
- Finish time and average speed for the whole trip.

**Finish is manual.** There is no destination search or automatic arrival detection. Coordinates are latitude and longitude; no address lookup or map service is used.

Keep the app visible and the screen awake. Hiding it or locking the screen ends this foreground-only trip when the visibility event is received. This app does not prevent sleep or guarantee tracking in the background.

Trip data stays in memory. Starting another trip clears it; reloading or closing the app loses it. There is no account, database, or trip history.

## Read the code in this order

| File | What to look for |
| --- | --- |
| `src/app/home/home.page.html` | The screen: readings, controls, and location log. |
| `src/app/home/home.page.ts` | `startTrip()`, `recordPosition()`, and `finishTrip()`. |
| `src/app/home/tracking.ts` | Distance, unit conversions, and time formatting. |
| `src/app/home/home.page.scss` | Mobile-first layout, with medium and wide states. |
| `src/global.scss` | Shared colors, type, and keyboard focus. |
| `src/assets/sports/` | Your three running photographs, bundled for offline native use. |
| `src/main.ts` | Starts Angular and configures Ionic. |

Angular **signals** are values that update the screen when they change. `unit()` reads a value; `unit.set('mi')` changes it; `distanceMeters.update(...)` changes it using the previous value. The `@if` and `@switch` blocks in the HTML choose what the screen displays.

The big stopwatch shows hours, minutes, and seconds. Its orange ring sweeps once per minute using the elapsed seconds. The HTML passes an angle to the CSS through `--elapsed-angle`; no separate animation timer is needed. On Finish, both the digits and the ring freeze.

`Geolocation.getCurrentPosition()` finds the start. `Geolocation.watchPosition()` sends later readings. `Geolocation.clearWatch()` releases that watcher on Finish. The watcher ID is retained so it can be stopped. A session number lets the page ignore late location responses after Cancel or Finish.

All distance is kept in **meters**, all speed in **meters per second**. Unit buttons change only the display. `distanceBetween()` uses the Haversine formula to calculate the distance along the earth between two coordinates. The page adds traveled segments rather than measuring a straight line from start to finish.

GPS measurements are estimates. This version ignores readings with accuracy worse than 50 m, movements below a small noise threshold, old timestamps, and jumps faster than 100 m/s. These simple filters reduce obvious errors but can miss short or slow movements and cannot match a mature fitness tracker. Speed falls back to distance divided by time if the phone does not supply it. A speed reading older than 15 seconds is hidden.

## Run on Android

The native `android/` project is already included, with foreground coarse/fine location permissions. Its package ID is the development placeholder `com.example.fieldtracker`, and it retains the default Capacitor launcher icon as a placeholder.

1. Install Android Studio with Android SDK 36 and a Java 21 JDK. Android Studio can provide the JDK.
2. Build and copy the web app into the Android project:

   ```powershell
   npm run android:sync
   npm run android:open
   ```

3. In Android Studio, choose your connected phone or emulator and run the app. Enable phone location and allow **precise** location when prompted.
4. Test outside on a real phone. An emulator needs simulated location movement.

After changing the Angular app, run `npm run android:sync` again before running Android. No live-reload server URL is embedded in the native app.

The production web build and Capacitor Android sync were verified here. No Android SDK was available on this machine, so an APK build and real-phone GPS tracking have not been verified.

iOS is not configured in this Windows project. Adding it later requires `@capacitor/ios`, a Mac with Xcode, and the location descriptions required by the [Geolocation plugin](https://capacitorjs.com/docs/apis/geolocation).

## Build an APK with GitHub Actions

The workflow is in `.github/workflows/android.yml`. Push this project to a GitHub repository, including `android/`, the Gradle wrapper files, and `package-lock.json`.

It runs on pushes and pull requests. You can also open **Actions > Android APK > Run workflow** on GitHub to start it manually once the workflow is on the repository's default branch.

The job installs Node.js 24, Java 21, and the Android SDK, runs the calculation tests, builds the web app, syncs Capacitor, and builds a debug APK. It uploads `app-debug.apk` as the `field-tracker-debug-apk` artifact, retained for 14 days.

After a successful run, open the run's **Artifacts** section, download `field-tracker-debug-apk`, extract it, and transfer the APK to your phone. This debug build uses Android's debug signing and needs no signing secrets. A Play Store release build is a separate setup.

The workflow has been checked locally, but its first full APK build still needs to run on GitHub Actions.

## Checks

```powershell
npm run build
npm test
npx playwright install chromium
npm run test:ui
```

Calculation tests use Node's built-in test runner. Browser tests use controlled GPS fixtures to check movement, denied permission, weak signal, cancellation, foreground stopping, unit conversion, keyboard controls, and responsive widths. Test coordinates are fixtures, never preloaded into the app.

Read `VERIFICATION.md` for the recorded checks and the antislop delivery gate.
