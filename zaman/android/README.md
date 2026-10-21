# Zaman Android 1.2.1

Offline Android package `ir.zaman.app`, separate from the existing Raval app. Minimum API 26, target/compile API 35; pure Java, no third-party Android libraries or Gradle dependencies.

The APK embeds the current `zaman/index.html`, `app.js`, `style.css`, the user-provided Vazirmatn variable font, and an Android-only adapter. WebView serves a fixed local HTTPS origin, blocks external navigation, disables file access and mixed content, and exposes the bridge only to bundled content. The app requests no network permission. Browser storage remains separate; JSON backup/restore transfers data.

## Build

Requires JDK 17 or later with javac, Android platform 35 and Android build-tools 35.0.0. Run from repository root:

```sh
JAVA_HOME=/path/to/jdk ANDROID_SDK_ROOT=/path/to/sdk ANDROID_BUILD_TOOLS=/path/to/sdk/build-tools/35.0.0 ZAMAN_SIGNING_DIR=/private/persistent/signing zaman/android/build.sh
```

The local defaults match the SDK prepared for this task (`/workspace/android-sdk`, build-tools extracted under `android-15`). The official Google SDK repository metadata was downloaded over verified TLS; platform-35_r02.zip and build-tools_r35_linux.zip SHA-1 values matched that metadata. The downloaded JDK was verified against its official SHA-256. No verification was disabled.

Output: `build/zaman-1.2.1.apk`. The script compiles resources/Java/DEX, aligns the APK and signs it, then verifies signature and alignment and prints package metadata. The development keystore lives outside the repository in `ZAMAN_SIGNING_DIR` (default `/workspace/zaman-signing`). Preserve it privately for installable future updates; do not commit the key. This is development signing, not a production signing setup.

## Native alarms

`AlarmStore` persists enabled reminders and countdown deadlines in SharedPreferences, uses stable pending-intent identities, cancels replaced schedules, remembers fired deadlines, and advances daily/weekly repeats using local calendar dates. Exact-alarm permission enables `setAlarmClock`; without it, alarms fall back to inexact scheduling. Schedules are restored after reboot, package replacement, and exact-alarm permission changes. The foreground UI checks due native alarms before the web timer advances, avoiding cancellation of a due alarm before it rings.

`AlarmService` plays the system alarm tone and vibration, posts a notification with a Stop action, and stops after five minutes. The UI also has a Stop action. Notification permission and exact-alarm permission are exposed through a status panel. No full-screen takeover is used. System force-stop, restrictive device battery settings and denied permissions remain platform limitations.

## Validation

- Built and verified v2/v3 APK signatures, ZIP alignment, application ID, launch activity, permissions and SDK versions.
- Browser workflows and Android adapter smoke test: `node zaman/tests/android-bridge.cjs` (mock bridge; does not validate Android OS scheduling).
- Existing browser suites cover project/task/idea reminders, Persian dates/leap Esfand, sequential activity recording and minute wheel.
- The actual native recurrence method is exercised on the JVM by `tests/AlarmStoreTest.java`, including missed repeats and daylight-saving changes. Compile against `build/classes` and Android 35's android.jar and run `ir.zaman.app.AlarmStoreTest` with the same classpath.
- No Android emulator or physical phone was available for runtime installation, document picker, background audio, reboot recovery or lock-screen testing. These checks remain for a real device; package compilation alone does not prove them.

Distribution: `downloads/zaman-android-1.2.1.apk`, with SHA-256 companion; user-facing instructions are in `zaman/android.html`.

Version 1.1.0 uses versionCode 2 and the same development signing key as 1.0.0, so it can update the installed app without clearing its local data. Its compact home screen shows colored navigation, Persian/Gregorian dates, a live clock, a minute-only countdown and a daily activity table. Backup controls and native alarm settings are in the settings dialog.

## Version 1.2.0 (versionCode 3)

The same signing key supports updates from 1.0 and 1.1. Named activities, frequent buttons, fuzzy local suggestions, the daily pie chart and five-second end-day hold are shared with the browser build. Active countdowns show total minutes and seconds and turn red; duration selection remains minutes only. Header/branding and reminder-page date/explanatory cards are removed. Settings and alarm permissions are accessed from Activities.

Activity recording is transactional: an optional pendingSegment preserves the tap-time boundary while the next interval runs. History is written only after a nonempty title is confirmed. Cancel/Escape/back restores the previous interval, and reload reopens the pending form. Native back invokes dismissModal(), so it also rolls back correctly. Old history, including legacy unnamed records, is retained and can be renamed. No state key or existing data is cleared.

Browser checks include 24 repeated single/double-tap submission/cancellation cycles, reload recovery, 20 first-tap reminder opens with mobile Chromium touch emulation and no popup/navigation, five-second mouse/keyboard hold and early release, grouped pie percentages with live/previous-day data, and Android-bridge integration with a mock. These are not physical Android alarm or Chrome-device tests.

## Version 1.2.1 (versionCode 4)

The end-day button is always visible at full width under the countdown; it is disabled until a day starts and still requires a five-second hold. A reset action at the bottom of Today clears only today's recorded intervals and restarts the live day at a user-selected local time, rejecting future/nonexistent times. A required checkbox confirms the deletion. Previously recorded intervals crossing midnight are clipped so their previous/future-day portions survive. An unrecorded prior-day interval requires a title before reset, preserving that time as named history. Projects, reminder schedules, the independent countdown and known activity names are retained. Reset always targets the actual current calendar day, even when viewing an earlier history day. `node zaman/tests/day-reset.cjs` covers these behaviors and reload persistence.
