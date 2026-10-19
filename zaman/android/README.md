# Zaman Android 1.0.0

Offline Android package `ir.zaman.app`, separate from the existing Raval app. Minimum API 26, target/compile API 35; pure Java, no third-party Android libraries or Gradle dependencies.

The APK embeds the current `zaman/index.html`, `app.js`, `style.css`, and an Android-only adapter. WebView serves a fixed local HTTPS origin, blocks external navigation, disables file access and mixed content, and exposes the bridge only to bundled content. The app requests no network permission. Browser storage remains separate; JSON backup/restore transfers data.

## Build

Requires JDK 17 or later with javac, Android platform 35 and Android build-tools 35.0.0. Run from repository root:

```sh
JAVA_HOME=/path/to/jdk ANDROID_SDK_ROOT=/path/to/sdk ANDROID_BUILD_TOOLS=/path/to/sdk/build-tools/35.0.0 ZAMAN_SIGNING_DIR=/private/persistent/signing zaman/android/build.sh
```

The local defaults match the SDK prepared for this task (`/workspace/android-sdk`, build-tools extracted under `android-15`). The official Google SDK repository metadata was downloaded over verified TLS; platform-35_r02.zip and build-tools_r35_linux.zip SHA-1 values matched that metadata. The downloaded JDK was verified against its official SHA-256. No verification was disabled.

Output: `build/zaman-1.0.0.apk`. The script compiles resources/Java/DEX, aligns the APK and signs it, then verifies signature and alignment and prints package metadata. The development keystore lives outside the repository in `ZAMAN_SIGNING_DIR` (default `/workspace/zaman-signing`). Preserve it privately for installable future updates; do not commit the key. This is development signing, not a production signing setup.

## Native alarms

`AlarmStore` persists enabled reminders and countdown deadlines in SharedPreferences, uses stable pending-intent identities, cancels replaced schedules, remembers fired deadlines, and advances daily/weekly repeats using local calendar dates. Exact-alarm permission enables `setAlarmClock`; without it, alarms fall back to inexact scheduling. Schedules are restored after reboot, package replacement, and exact-alarm permission changes. The foreground UI checks due native alarms before the web timer advances, avoiding cancellation of a due alarm before it rings.

`AlarmService` plays the system alarm tone and vibration, posts a notification with a Stop action, and stops after five minutes. The UI also has a Stop action. Notification permission and exact-alarm permission are exposed through a status panel. No full-screen takeover is used. System force-stop, restrictive device battery settings and denied permissions remain platform limitations.

## Validation

- Built and verified v2/v3 APK signatures, ZIP alignment, application ID, launch activity, permissions and SDK versions.
- Browser workflows and Android adapter smoke test: `node zaman/tests/android-bridge.cjs` (mock bridge; does not validate Android OS scheduling).
- Existing browser suites cover project/task/idea reminders, Persian dates/leap Esfand, sequential activity recording and minute wheel.
- The actual native recurrence method is exercised on the JVM by `tests/AlarmStoreTest.java`, including missed repeats and daylight-saving changes. Compile against `build/classes` and Android 35's android.jar and run `ir.zaman.app.AlarmStoreTest` with the same classpath.
- No Android emulator or physical phone was available for runtime installation, document picker, background audio, reboot recovery or lock-screen testing. These checks remain for a real device; package compilation alone does not prove them.

Distribution: `downloads/zaman-android-1.0.0.apk`, with SHA-256 companion; user-facing instructions are in `zaman/android.html`.
