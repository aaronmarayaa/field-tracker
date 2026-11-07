# Verification

Checked on November 3 and 7, 2026 (Asia/Manila). This report covers the web implementation, simulated Android/iOS bridge behavior, and native project/workflow preparation. Native compilation, Apple signing/upload, physical camera use, and physical screen-lock/GPS accuracy are not verified here.

## Trip history and login, November 7

- PASS: the production Angular build completed (738.50 kB initial raw bundle). Capacitor synced Android and iOS with all six plugins, including Camera, Filesystem, and Share. The two build workflows, tracking calculations, location watcher, and Leaflet logic are unchanged.
- PASS: the 19-test Playwright run and a separate storage/image retry test passed. The 6 calculation tests and 4 signing-helper tests also passed.
- PASS: UI fixtures verified registration, incorrect passwords, account separation, session refresh, history pagination, the route above Ground covered, one save on Finish, fixed per-trip units, preset persistence, offline reload and retry, and recovery from device storage and image failures.
- PASS: the native bridge test requested gallery saving, kept the photo on the device across reload, wrote the trip image to Documents, and shared from the cache. It observed no cloud write when taking the photo. The browser download was a 1080 × 1440 PNG.
- PASS: the exact migration ran in a local PostgreSQL engine with mock auth users. It permitted own-trip insert and idempotent update, denied access without authentication, blocked cross-account reads and writes, and prevented moving a trip to another account.
- PASS: the live project's public Auth settings confirmed email sign-in enabled and confirmation disabled. The live trips endpoint still returned `PGRST205` at the last check; the user will run the migration in SQL Editor. Authenticated live writes were simulated locally and were not verified against the hosted table.
- PASS: SHA-256 hashes matched all three supplied backdrop files. Test screenshots and a poster with a simulated route are in the local `build/preview/` folder.

### Delivery gate for history and login

- R-02 PASS: new app copy and setup instructions use no em dash.
- R-03 PASS: tracker reflow checks passed from 320 to 1280 px; the trip dialog had no overflow at 320, 390, 768, and 1280 px.
- R-17 PASS: distance, pace, and time are derived from saved trip data, including the stored unit.
- R-18 PASS: no invented athlete, customer, or testimonial appears in the app.
- R-23 PASS: the three supplied photos are used as requested; the first reference only guides the composition.
- R-24 PASS: the clock, Back to trips, Back to tracker, and Close open or return to real views.
- R-25 PASS: muted text on the dark surface is 8.50:1; primary buttons are 7.07:1. The orange route and its dark outline are 7.14:1. The poster fade keeps white type readable on the supplied and simulated camera backgrounds.
- R-26 PASS: registration, sign-in, sign-out, history refresh, loading older trips, background selection, camera, save, share, and both retry actions have exercised handlers.
- R-27 PASS: tests exercised loading, first-trip, offline, wrong-password, and image/storage retry states with actionable copy.
- R-28 PASS: no FAQ or filler content was added.
- R-32 PASS: tracker keyboard navigation and dialog Escape were exercised; detail focus moves to Back to trips and focus outlines are visible.
- R-33 PASS: layout and features are in the app source. Test fixtures are confined to the test suite.
- R-34 PASS: the existing dark theme covers login, history, and detail; no theme control was added.
- R-35 PASS: the production build, click-through tests, local database policy checks, and visual inspection of the exported poster and phone/desktop detail views are recorded above.
- R-36 PASS: the app distinguishes device copies from Supabase saves, and the setup report distinguishes local tests from the pending hosted table.
- R-37 PASS: the existing sporty direction and ENERGY 3 / RHYTHM 2 / MOTION 1 are recorded in `DESIGN.md`, applied to the supplied poster reference.
- R-38 PASS: the empty history has no sample rows. Simulated trips are confined to tests and labeled preview evidence.
- R-01 PASS: the poster fade has the single purpose of keeping the statistics readable over photos.
- R-04 PASS: the clock icon opens history; photo thumbnails select the named background.
- R-06 PASS: condensed headings retain the sports signage character; labels and numeric values are separated by weight and size.
- R-07 PASS: no decorative grid or dot pattern was added.
- R-08 PASS: buttons use their action names without decorative arrows.
- R-09 PASS: no badge repeats the headline.
- R-10 PASS: the dialog uses a solid surface and a dim backdrop, without glass.
- R-12 PASS: no large card shadows were added.
- R-13 PASS: no glow was added.
- R-14 PASS: the chronological rows differ in purpose from the portrait poster and thumbnail controls.
- R-19 PASS: motion remains limited to interaction feedback, loading, and actual tracking.
- R-22 PASS: all imagery is user supplied or captured on the device.
- Liveliness PASS: the dial/route remain the live tracker instruments; the portrait poster is the detail focal point, with the orange GPS line and condensed Field Tracker title carrying the identity across views.
- C-1 PASS: design choices and their purposes are recorded in `DESIGN.md`.
- C-2 PASS: controls have named behavior, pending states, and recovery actions exercised by tests.
- C-3 PASS: login protects saved trips, the history organizes them, and the detail shows and exports a specific trip.
- C-4 PASS: phone/desktop layout, keyboard access, empty history, and failed saves were exercised.
- C-5 PASS: tests and the setup report distinguish simulated data, actual API settings, and pending live setup.
- R-05 PASS: login photo/form, trip rows, and portrait detail follow the content and the declared rhythm.
- R-11 PASS: small corners mark controls; circles still represent the stopwatch and GPS endpoints.
- R-15 PASS: Start trip, Finish trip, Refresh trips, Take a photo, and Save trip image name their actions.
- R-16 PASS: status text describes recording, saving, and recovery in plain terms.
- R-20 PASS: the track photography, condensed wordmark, stopwatch, and orange route remain visible identifiers.
- R-21 PASS: the existing dark sports palette carries over to login and history.
- R-29 PASS: charcoal, off-white, gray, and track orange are the only interface colors; the three photographs retain their original colors.
- R-30 PASS: the image reference informs hierarchy; the result uses Field Tracker's existing wordmark, typography, and orange.
- R-31 PASS: layout, accent, fade, photography, and content spacing have written purposes in `DESIGN.md`. Comments document device-only photos, offline sign-out, and the canvas rendering timing.

## iOS addition

- PASS: `@capacitor/ios` is pinned to 8.6.0, matching the existing core, CLI, and Android runtime. The generated iOS project uses Swift Package Manager and is included in the working tree.
- PASS: `npm run ios:sync` completed a strict production Angular build (639.69 kB initial raw bundle), copied assets, and registered the three existing location/notification plugins for iOS.
- PASS: `npx cap sync android` also completed with the same three plugins after the iOS addition.
- PASS: all 6 calculation tests and all 14 Playwright tests passed. The additional iOS native-bridge case covers the permission-dialog visibility transition, native permission-request option, no Android notification request, a simulated six-minute hidden interval, batched route rendering, and Finish cleanup. Browser and Android regression checks remain passing.
- PASS: all 4 Python signing-helper tests passed, including profile/team/app matching, rejecting development/Ad Hoc/expired profiles, limiting signing changes to the App configurations, repeatable updates without duplicate settings, and failing on an unexpected project structure.
- PASS: both workflows passed `actionlint` 1.7.12 with ShellCheck disabled on Windows. Git Bash parsed all 12 iOS shell steps without syntax errors.
- PASS: the iOS workflow's exact QR script produced a PNG decoded by ZXing to the exact test TestFlight invitation URL. It also rejected an unrelated download URL. This is a test fixture, not an available invitation, and no example QR is shipped in the app.
- PASS: the iOS plist parses and contains both required location explanations and the location background mode. The Xcode target also declares Background Modes capability.
- PASS: build jobs have read-only repository permission. Only the invitation-publishing job has write permission; its condition excludes pull requests. Apple secrets are used only by the manually selected signed-upload steps and are removed from the ephemeral runner afterward.
- PASS: Git diff shows no changes to the Android workflow, calculation helper, map component, or sports styles. The app changes select iOS background tracking and use the correct native platform name in existing text; no new visual sections or image assets were added.
- PASS: the existing antislop gate below remains applicable to the retained interface. The new platform wording was exercised at the phone viewport, and the existing responsive/keyboard checks passed. Authored comments add only the reason signing is scoped to the App target; generated native comments are preserved. No comment-hygiene-only executable changes were made.
- PASS: `IOS_SETUP.md` documents simulator versus physical-device distribution, every GitHub variable/secret, TestFlight review/invitation setup, placeholder identity/icon, and real-device verification steps.

Pending external verification: run the workflow on GitHub's macOS runner, compile/archive in Xcode, provide Apple signing credentials, upload/process the build, obtain beta approval, configure the real public invitation, and test a locked-screen trip on a physical iPhone. No IPA, live iOS download, or working TestFlight invitation has been produced from this Windows workspace.

## Recorded checks

- PASS: `.github/workflows/android.yml` passed `actionlint` 1.7.12 with no workflow syntax or configuration errors. ShellCheck was disabled because the validator was run on Windows.
- PASS: the workflow's exact QR-generation Python produced a 490 x 490 PNG in a temporary validation directory. ZXing decoded it to the exact test APK URL. The test URL does not host an app and no sample QR was added to the product.
- PASS: Git Bash parsed all 10 workflow shell steps without syntax errors, including the Python and Markdown heredocs. Build permissions remain read-only; release write access is limited to the publish job.
- Android workflow execution is pending: builds produce the debug APK artifact; default-branch pushes and manual runs additionally publish the APK, direct download link, and install QR code in a GitHub prerelease and Actions run summary. Pull requests do not publish. This updated workflow has not been run on GitHub from this workspace.
- PASS: Ionic CLI compatibility fix: renamed the Angular project from `field-tracker` to `app` and updated both serve build targets to match Ionic's default `app:serve` and `app:build` commands.
- PASS: `ionic serve --no-open --no-interactive` built and started at `http://localhost:8100`; Chromium rendered the Start trip button with no uncaught page errors. The verification server was stopped afterward.
- PASS: `ionic build --no-interactive` completed successfully after the target correction.
- PASS: `npm run build` completed after the sports redesign with strict Angular template and TypeScript checking.
- PASS: `npm test` completed with 6 passing calculation tests: Haversine distance, coordinate validity, drift/jump filtering, traveled segments, unit conversions, and durations.
- PASS: the original 6 browser tests passed before adding the map. Before iOS, the suite passed all 13 tests: the original 6, four map checks, and three simulated Android background checks. It now passes 14 including the iOS case recorded above. GPS/native-bridge fixtures exist only in test code.
- PASS: `npx cap sync android` copied the production bundle and registered Geolocation 8.2.4, Background Geolocation 1.3.1, and Local Notifications 8.3.1. The native configuration contains `useLegacyBridge: true`.
- PASS: Android manifest contains coarse/fine location, location foreground-service, and notification permissions. The location-service declaration is supplied by the background plugin; GPS hardware remains optional in the app manifest.
- PASS: browser console inspection captured no console errors or uncaught page errors while opening the page, changing units, and scrolling.

The sports redesign was checked at `http://127.0.0.1:8102` using `TRACKER_TEST_PORT=8102`; ordinary `npm run test:ui` uses 8100. The Ionic CLI compatibility checks above were completed before the visual redesign; the Angular `app` target is retained.

The map and screen-off additions were checked at `http://127.0.0.1:8103` using `TRACKER_TEST_PORT=8103`. Git confirms that `src/app/home/tracking.ts`, the existing home stylesheet, and the Android APK/QR workflow have no changes in this work. Home-page additions connect the map, retain accepted route points, select the native watcher, and apply the requested Android visibility behavior. The distance, speed, duration, and unit calculations remain the same.

## Interactive controls, checked individually

- PASS: Start trip obtains the initial GPS fixture, records the start location, starts the timer and watcher, and displays the recording state.
- PASS: Finish trip freezes time and distance, displays average speed and the last accepted GPS fix, and removes the watcher.
- PASS: Start another trip clears the previous readings and starts a new watcher.
- PASS: Cancel returns to the ready state and ignores a delayed location response.
- PASS: km changes speed and distance to metric values without altering the underlying readings.
- PASS: mi changes speed and distance to imperial values without altering the underlying readings; `aria-pressed` reflects selection.
- PASS: keyboard Tab reaches km, mi, and Start in visual order; Enter activates units and Start.
- PASS: location permission denial displays an actionable alert and leaves Start available.
- PASS: weak GPS readings do not add distance; signal errors show feedback.
- PASS: missing device speed falls back to successive positions; an implausible jump does not replace the endpoint; speed older than 15 seconds is hidden.
- PASS: hiding the browser page ends foreground tracking and releases its watcher. Android bridge simulations retain their native watcher while hidden and remove it on Finish.
- PASS: the final footer is reachable by scrolling on a 390 x 844 viewport.
- PASS: the stopwatch seconds ring advances during recording and freezes on Finish, checked with the browser clock.
- PASS: all three supplied running photos load successfully and remain visible on narrow screens.
- PASS: the Start button fits within the initial 390 x 844 viewport, from y=781.5 to y=837.5.
- PASS: map startup waits for a real accepted GPS fix; there is no invented location in the empty state.
- PASS: accepted positions move the marker and extend the route; low-accuracy readings and implausible jumps do not change the displayed route.
- PASS: Finish keeps the route visible and frozen; another trip clears the route and reuses one map instance.
- PASS: map zoom-in and zoom-out controls were clicked; dragging pauses following and Center on me resumes it, including keyboard activation.
- PASS: tile failure feedback is actionable; Reload map recovers after the simulated connection returns, while speed and distance keep updating.
- PASS: a simulated map initialization failure leaves Start, speed, distance, units, and Finish functional with no uncaught page errors.
- PASS: the map's OpenStreetMap attribution link was clicked and opened `https://www.openstreetmap.org/copyright` with the title `Copyright and License | OpenStreetMap`.
- PASS: actual OpenStreetMap tiles returned HTTP 200 in a separate visual check; no page errors occurred. The pictured coordinates were a browser GPS fixture, not the user's actual location.
- PASS: simulated Android permission-dialog visibility changes do not cancel Start; notification denial leaves Start available without starting a background watcher.
- PASS: a simulated six-minute hidden Android session keeps recording. Three fixes delivered in one batch all appear in the route after resume, and Finish removes the native watcher.
- PASS: two consecutive simulated Android trips create one watcher each and remove each watcher on Finish.

## Antislop core delivery gate

### Hard gate

- R-02 PASS: authored app text, README, and design notes contain no em dash characters.
- R-03 PASS: Chromium checked zero horizontal overflow at 320, 360, 390, 520, 640, 768, 960, and 1280 px; all available controls measured at least 44 x 44 px.
- R-17 PASS: initial zero distance/time express the actual empty trip state; later readings come from GPS and time calculations. No invented trip is preloaded.
- R-18 PASS: no testimonials, invented identities, or profile images exist.
- R-23 PASS: the single-screen scope follows the agreed first version; the user requested the sporty direction and supplied the three photographs; the title is text. The native app keeps the generated Capacitor icon, documented as a placeholder.
- R-24 PASS: no navigation links or dead destinations exist.
- R-25 PASS: measured contrast is 16.90:1 for main text on charcoal, 9.25:1 for muted text on charcoal, 8.50:1 for muted text on the dial, 7.40:1 for muted text on the unit-control wash, and 7.07:1 for text on the orange action button. Selected-unit colors were also inspected in the rendered browser.
- R-26 PASS: every interactive element has its recorded behavior in the individual control list above.
- R-27 PASS: ready, locating, and denied/weak/unavailable GPS states were exercised. Map empty, tile loading, tile error/retry, and initialization-failure states were also exercised.
- R-28 PASS: no generic FAQ exists.
- R-32 PASS: keyboard control order and activation were exercised; authored CSS includes visible focus outlines for buttons and Ionic native button parts. There are no dialogs.
- R-33 PASS: interface features were authored directly in source with patches; preview scripts only captured screenshots and measured the rendered UI.
- R-34 PASS: one intentional dark theme follows the user's supplied sports photography; no incomplete theme toggle exists.
- R-35 PASS: production build, thirteen browser tests, individual control results, console inspection, and map phone/desktop screenshots are recorded here. Native checks are explicitly simulations.
- R-36 PASS: no invented security, customer, compliance, or performance claims exist.
- R-37 PASS: `DESIGN.md` records the user's selected direction; the design read was declared before generating the interface.
- R-38 PASS: product readings are real runtime values; unavailable speed and locations are explicitly empty. Browser fixtures are isolated to test code, and simulated-map screenshots are labeled as such in this report.

### Purpose gate

- R-01 PASS: charcoal and off-white follow the monochrome running photograph; orange connects to the track. The conic gradient represents actual elapsed seconds, with its purpose recorded in `DESIGN.md`. No ornamental glow is used.
- R-04 PASS: play/stop marks represent recording actions, map markers represent endpoints, and the Android notification icon identifies location recording, with reasons in `DESIGN.md`; there is no decorative icon set.
- R-06 PASS: familiar sans-serif labels and tabular digits serve readability; condensed Impact headings follow sports signage. Reasons are documented.
- R-07 PASS: the background is solid charcoal; no ornamental grid or dot pattern is used.
- R-08 PASS: no decorative button arrows are used.
- R-09 PASS: trip state is plain text with an actual state marker; no promotional capsule badges are used.
- R-10 PASS: no glassmorphism is used.
- R-12 PASS: open sections sit on the page without floating card shadows; the Ionic button shadow is disabled.
- R-13 PASS: no glow is used.
- R-14 PASS: readings and locations follow their content hierarchy without repeated feature cards.
- R-19 PASS: motion follows control feedback, the locating spinner, real time, and accepted GPS position updates. Map updates avoid decorative zoom/fade animations.
- R-22 PASS: the three images are the user's supplied running photos, copied into the app and inspected in the browser; no invented or external stock illustration is used.

### Liveliness

- PASS: ENERGY 3 / RHYTHM 2 / MOTION 1 is declared in the design record.
- PASS: bold headings, the large stopwatch, varied photo/instrument/log composition, and restrained interaction match the declared dials in inspected screenshots.
- PASS: the stopwatch is the visual focal point; the primary action is easy to locate below it.
- PASS: spacing and rules group readings, controls, and location entries rather than filling a template.
- PASS: orange marks the primary recording action and the elapsed seconds sweep; location marks carry journey meaning.
- PASS: condensed sports headings, running photography, and the circular timing instrument establish the repeated identity.
- PASS: the sports tracker design read was declared before generating the redesigned interface.

### Craftsmanship and consistency

- C-1 PASS: major visual choices have a purpose recorded in `DESIGN.md`.
- C-2 PASS: each control was exercised as recorded above.
- C-3 PASS: all sections serve readings, trip control, location information, or the foreground limitation.
- C-4 PASS: empty/loading/error states, keyboard control, and eight viewport widths were checked; the single shipped theme was visually inspected.
- C-5 PASS: no fictional testimonial, statistic, or product claim exists.
- R-05 PASS: the trip instrument and location log follow the requested tracker flow; no landing-page template, bento grid, pricing, or fabricated social proof exists.
- R-11 PASS: circles represent the stopwatch and endpoints; other controls use small corners. Information is placed in open sections rather than uniform rounded cards.
- R-15 PASS: Start trip, Finish trip, Start another trip, and Cancel name their real actions.
- R-16 PASS: UI text contains no AI marketing claims or buzzwords.
- R-20 PASS: charcoal, track orange, condensed sports titles, supplied running photos, and the large stopwatch provide the selected identity, as seen in screenshots.
- R-21 PASS: the single dark theme follows the supplied sports photography, with its purpose recorded in `DESIGN.md`.
- R-29 PASS: neutral charcoal, white, and gray with one orange interface accent implement the limited palette. The user's photos retain their natural colors.
- R-30 PASS: the interface follows the user's sports references rather than copying Strava or another product's layout.
- R-31 PASS: the design record explains color, type, layout, spacing, marks, theme, and motion in short statements.

## Mobile layout supplement

- PASS: base styles stack a compact photo strip, stopwatch, and trip log; medium widths place the stopwatch and log side by side below the photos; wide widths create three deliberate photo/instrument/log columns.
- PASS: distinct states are defined around where readings and location entries fit, including intermediate widths.
- PASS: type uses responsive sizes and mobile spacing; larger spacing is introduced progressively.
- PASS: supporting metrics use two compact, wrapping columns; the main photo/instrument/location layout stacks on mobile.
- PASS: eight viewport widths were checked for overflow; full phone content was inspected without clipping.
- PASS: interactive targets are at least 44 x 44 px; controls have spacing.
- PASS: no hover-only interaction exists; controls support tap/click and active feedback.
- PASS: this single-screen app needs no hidden navigation or hamburger menu.
- PASS: no fixed bar covers content; the page applies safe-area insets.
- PASS: phone, intermediate, and wide breakpoints were exercised; screenshots were inspected at 390, 768, and 1440 px.

## Code comment supplement

- PASS: original comments explain the formula, GPS filtering, web permission behavior, and watcher-ID race. Three new single-line comments explain map reset identity, native position normalization, and the required Android bridge setting.
- PASS: there are no authored decorative separators, shouty banners, redundant descriptions, workflow narration, vague TODOs, emoji, or end markers.
- PASS: comments are sparse, single-line notes in natural sentence case.
- PASS: the hygiene review introduced no executable-code changes; the application's implementation was performed under the separate user request to build it. Generated native build notices and licensing comments were preserved.

## Visual evidence

- `screenshots/sports-mobile.png`: 390 x 844 phone viewport, including the Start button.
- `screenshots/sports-mobile-full.png`: full scrolling phone content at 390 px width.
- `screenshots/sports-tablet.png`: 768 px intermediate layout.
- `screenshots/sports-desktop.png`: 1440 px wide layout.
- `screenshots/map-ready-mobile.png`: the initial phone screen, with the existing primary controls in place.
- `screenshots/map-simulated-mobile.png`: phone map, real OpenStreetMap tiles and simulated GPS coordinates.
- `screenshots/map-simulated-desktop.png`: wide map, real tiles and simulated GPS coordinates.

## Practical limits

Android SDK 36, Xcode, and connected Android/iOS phones were not available here. Native compilation, actual permission prompts, physical camera use, battery behavior, GPS accuracy, and real screen-lock behavior remain unverified. Android uses a location foreground service with a persistent notification; iOS uses the native background-location watcher and configured location background mode. A browser still needs to stay visible. Device verification should include a moving trip with the screen locked for at least six minutes, followed by Finish and confirmation that location recording stops and the trip appears in history. A fully powered-off or force-stopped phone/app cannot keep an in-progress session recording. Completed trips persist; Finish is manual and there is no automatic arrival or address lookup.
