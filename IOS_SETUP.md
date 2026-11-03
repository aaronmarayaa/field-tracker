# iPhone builds and TestFlight

The native iOS project is included in `ios/`. The Angular screen, calculations, and map are shared with Android. iOS uses the native background-location plugin during a started trip; its location permission explanations and background location capability are configured.

The workflow is `.github/workflows/ios.yml`, named **iOS and TestFlight**. It has two choices:

| Choice | Result | Apple credentials |
| --- | --- | --- |
| Push, pull request, or manual run with `upload_testflight` unchecked | An unsigned app for an Xcode iOS simulator | None |
| Manual run with `upload_testflight` checked | A signed IPA uploaded to App Store Connect for TestFlight | Required |

The simulator ZIP cannot be installed on a physical iPhone. An App Store-signed IPA is also not a direct public download installer. Testers install this app through **Apple TestFlight** and your invitation link. See [Apple's TestFlight overview](https://developer.apple.com/testflight/).

## 1. Try the simulator build

Push the project, including `ios/` and `package-lock.json`, to GitHub. Open **Actions > iOS and TestFlight > Run workflow**, leave `upload_testflight` unchecked, and run it. The macOS runner builds the web app, syncs Capacitor, and compiles the simulator app with Xcode.

Download and extract the `field-tracker-ios-simulator` artifact. On a Mac, start an iPhone simulator in Xcode, then drag `App.app` into it, or use:

```sh
xcrun simctl install booted /path/to/App.app
```

A simulator requires simulated location movement. It cannot prove real GPS accuracy or screen-lock behavior.

## 2. Prepare the Apple account

You need an [Apple Developer Program membership](https://developer.apple.com/programs/) with access to certificates, identifiers, profiles, and App Store Connect. You can trigger the workflow from Windows; GitHub supplies its macOS build runner. Creating/exporting a signing certificate generally requires Keychain Access on a Mac, or assistance from the person who manages your Apple signing credentials.

1. Register a unique explicit iOS bundle ID, such as your own `com.yourname.fieldtracker`. The project's `com.example.fieldtracker` is a placeholder. Create an App Store Connect app record with the registered ID and iOS as its platform.
2. Create an **Apple Distribution** certificate. Export the certificate **together with its private key** from Keychain Access as a password-protected `.p12` file. A `.cer` file alone cannot sign the app.
3. Create and download an **App Store Connect distribution provisioning profile** for that exact app ID and distribution certificate. Development, Ad Hoc, and enterprise profiles are not accepted by this workflow.
4. In App Store Connect, create a **team API key** with permission to upload builds, and download its `.p8` private key. Save its **Key ID** and **Issuer ID**. Use a role allowed to upload builds, such as App Manager; Apple account administrators control API access.
5. Keep these files private. Add them to GitHub's encrypted repository secrets; do not paste them into a chat or commit them. GitHub's [Apple certificate setup guide](https://docs.github.com/en/actions/how-tos/deploy/deploy-to-third-party-platforms/sign-xcode-applications) explains certificate and profile handling.

## 3. Add GitHub variables and secrets

In the repository, open **Settings > Secrets and variables > Actions**.

Add these under **Variables**:

| Name | Value |
| --- | --- |
| `IOS_TEAM_ID` | Your ten-character Apple Developer team ID |
| `IOS_BUNDLE_ID` | The exact registered bundle ID for the App Store Connect app |
| `TESTFLIGHT_PUBLIC_URL` | Add later: the group's `https://testflight.apple.com/join/...` invitation |

Add these under **Secrets**:

| Name | Value |
| --- | --- |
| `IOS_DISTRIBUTION_CERTIFICATE_BASE64` | Base64 contents of the exported `.p12`, including its private key |
| `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD` | The password chosen when exporting that `.p12` |
| `IOS_PROVISION_PROFILE_BASE64` | Base64 contents of the App Store Connect `.mobileprovision` file |
| `APP_STORE_CONNECT_KEY_ID` | The API key's ten-character Key ID |
| `APP_STORE_CONNECT_ISSUER_ID` | The team API key's Issuer ID |
| `APP_STORE_CONNECT_PRIVATE_KEY` | The complete `.p8` text, including BEGIN/END lines and real newlines |

On Windows, copy a file's base64 representation to your clipboard without printing it in the terminal:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\path\distribution.p12')) | Set-Clipboard
[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\path\app.mobileprovision')) | Set-Clipboard
```

Run one command at a time and paste into the matching GitHub secret before copying the next. Copy the `.p8` as plain text, not base64.

The signing step installs a temporary keychain, checks the provisioning profile's app/team/type/expiration, and sets signing only on the App target. It overrides the iOS bundle ID in the runner's checkout; Android keeps its current ID. Build numbers use the GitHub run number and retry number, such as `12.1`. Marketing version starts at `1.0`; increase it in the Xcode project when needed for an existing App Store version or build-number sequence.

## 4. Upload a signed build

Open **Actions > iOS and TestFlight > Run workflow**, check **upload_testflight**, and run it. Missing variables or secrets produce an error naming the missing setting. The workflow signs and exports the app, retains the IPA as `field-tracker-ios-signed` for 14 days, and uploads it using Apple's `altool`.

No App Store release is submitted automatically. Apple must process the upload before the build appears in App Store Connect. Complete any export-compliance questions accurately, then add the build to a TestFlight testing group. Uploading is separate from making the build available to testers. See [Apple's upload guide](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/).

For external testers, complete the beta information, review contact details, and any required privacy information, then submit the build for **TestFlight App Review**. Explain that GPS is recorded only during an explicitly started trip and that Finish stops the watcher. The generated Capacitor launcher icon is still a placeholder; replace it before submitting a polished app. Apple decides whether a build is approved.

## 5. Publish the iPhone invitation QR

After external testing is approved, enable a **public link** for the external TestFlight group and copy the `https://testflight.apple.com/join/...` URL. Apple's [external tester guide](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers) covers approval and public links.

1. Save that link in the GitHub repository variable `TESTFLIGHT_PUBLIC_URL`.
2. Run **iOS and TestFlight** again. Leave `upload_testflight` unchecked if the build is already uploaded.
3. After the build succeeds, open its **Summary** for the invitation QR and link, or download the `field-tracker-ios-testflight-qr` artifact.

The workflow also publishes `testflight-qr.png` and `testflight-url.txt` in a GitHub prerelease. Only this invitation job has repository write permission; pull requests never publish it. For a private repository, testers need access to GitHub to see the hosted QR image. You can download and share the PNG yourself. The TestFlight invitation itself is controlled by Apple, including approval, available builds, group limits, and link settings. A QR does not bypass those checks and does not guarantee that the latest uploaded build is ready.

On an iPhone, install **TestFlight** from the App Store, scan the QR, accept the invitation, and install Field Tracker. TestFlight builds expire after 90 days; upload and approve a new build as needed. Keep the group link enabled while sharing its QR.

## Run locally on a Mac

Capacitor 8 requires [iOS 15 or newer and Xcode 26 or newer](https://capacitorjs.com/docs/ios). This project uses Swift Package Manager; it does not need a CocoaPods workspace.

```sh
npm ci
npm run ios:sync
npm run ios:open
```

In Xcode, select the **App** target, choose your team and registered bundle ID under **Signing & Capabilities**, connect your iPhone, and run. The project file is `ios/App/App.xcodeproj`, scheme **App**. After web changes, run `npm run ios:sync` again.

## Check location on a real iPhone

Allow precise location when asked and allow background access when iOS requests it. If needed, use **Settings > Privacy & Security > Location Services > Field Tracker** to allow **Always** and **Precise Location**. Start the trip while the app is visible, wait for the initial fix and recording state, then lock the screen for at least six minutes while moving outdoors. Reopen the app and confirm the elapsed time, traveled distance, and route. Finish and verify that location recording stops. Repeat with denied permissions to check the recovery instructions.

iOS controls background delivery and may suspend or terminate an app. Force-quitting, turning the phone completely off, or losing the app process ends this in-memory session. No trip recovery or persistent history is implemented. A web browser still requires the screen to stay awake.

The iOS source and workflow are prepared from Windows. Actual Xcode compilation, Apple signing/upload, beta approval, and physical iPhone background behavior must be verified on the macOS runner and a device; they cannot be confirmed by browser fixtures.
