# Ali Mirza Time Management Android 1.7.0

Locally bundled Android package `ir.zaman.app`, separate from the existing Raval app. Minimum API 26, target/compile API 35; pure Java, no third-party Android libraries or Gradle dependencies.

The APK embeds the current `zaman/index.html`, `app.js`, `style.css`, the user-provided Vazirmatn variable font, and an Android-only adapter. WebView serves a fixed local HTTPS origin, blocks external navigation, disables file access and mixed content, and exposes the bridge only to bundled content. The app requests Internet access for the explicit update feature; activity data remain local. Browser storage remains separate; JSON backup/restore transfers data.

## Build

Requires JDK 17 or later with javac, Android platform 35 and Android build-tools 35.0.0. Run from repository root:

```sh
JAVA_HOME=/path/to/jdk ANDROID_SDK_ROOT=/path/to/sdk ANDROID_BUILD_TOOLS=/path/to/sdk/build-tools/35.0.0 ZAMAN_SIGNING_DIR=/private/persistent/signing zaman/android/build.sh
```

The local defaults match the SDK prepared for this task (`/workspace/android-sdk`, build-tools extracted under `android-15`). The official Google SDK repository metadata was downloaded over verified TLS; platform-35_r02.zip and build-tools_r35_linux.zip SHA-1 values matched that metadata. The downloaded JDK was verified against its official SHA-256. No verification was disabled.

Output: `build/zaman-1.7.0.apk`. The script compiles resources/Java/DEX, aligns the APK and signs it, then verifies signature and alignment and prints package metadata. The development keystore lives outside the repository in `ZAMAN_SIGNING_DIR` (default `/workspace/zaman-signing`). Preserve it privately for installable future updates; do not commit the key. This is development signing, not a production signing setup.

## Native alarms

`AlarmStore` persists enabled reminders and countdown deadlines in SharedPreferences, uses stable pending-intent identities, cancels replaced schedules, remembers fired deadlines, and advances daily/weekly repeats using local calendar dates. Exact-alarm permission enables `setAlarmClock`; without it, alarms fall back to inexact scheduling. Schedules are restored after reboot, package replacement, and exact-alarm permission changes. The foreground UI checks due native alarms before the web timer advances, avoiding cancellation of a due alarm before it rings.

`AlarmService` plays the system alarm tone and vibration, posts a notification with a Stop action, and stops after five minutes. The UI also has a Stop action. Notification permission and exact-alarm permission are exposed through a status panel. No full-screen takeover is used. System force-stop, restrictive device battery settings and denied permissions remain platform limitations.

## Validation

- Built and verified v2/v3 APK signatures, ZIP alignment, application ID, launch activity, permissions and SDK versions.
- Browser workflows and Android adapter smoke test: `node zaman/tests/android-bridge.cjs` (mock bridge; does not validate Android OS scheduling).
- Existing browser suites cover project/task/idea reminders, Persian dates/leap Esfand, sequential activity recording and minute wheel.
- The actual native recurrence method is exercised on the JVM by `tests/AlarmStoreTest.java`, including missed repeats and daylight-saving changes. Compile against `build/classes` and Android 35's android.jar and run `ir.zaman.app.AlarmStoreTest` with the same classpath.
- No Android emulator or physical phone was available for runtime installation, document picker, background audio, reboot recovery or lock-screen testing. These checks remain for a real device; package compilation alone does not prove them.

Distribution: `downloads/zaman-android-1.7.0.apk`, with SHA-256 companion; user-facing instructions are in `zaman/android.html`.

Version 1.1.0 uses versionCode 2 and the same development signing key as 1.0.0, so it can update the installed app without clearing its local data. Its compact home screen shows colored navigation, Persian/Gregorian dates, a live clock, a minute-only countdown and a daily activity table. Backup controls and native alarm settings are in the settings dialog.

## Version 1.2.0 (versionCode 3)

The same signing key supports updates from 1.0 and 1.1. Named activities, frequent buttons, fuzzy local suggestions, the daily pie chart and five-second end-day hold are shared with the browser build. Active countdowns show total minutes and seconds and turn red; duration selection remains minutes only. Header/branding and reminder-page date/explanatory cards are removed. Settings and alarm permissions are accessed from Activities.

Activity recording is transactional: an optional pendingSegment preserves the tap-time boundary while the next interval runs. History is written only after a nonempty title is confirmed. Cancel/Escape/back restores the previous interval, and reload reopens the pending form. Native back invokes dismissModal(), so it also rolls back correctly. Old history, including legacy unnamed records, is retained and can be renamed. No state key or existing data is cleared.

Browser checks include 24 repeated single/double-tap submission/cancellation cycles, reload recovery, 20 first-tap reminder opens with mobile Chromium touch emulation and no popup/navigation, five-second mouse/keyboard hold and early release, grouped pie percentages with live/previous-day data, and Android-bridge integration with a mock. These are not physical Android alarm or Chrome-device tests.

## Version 1.2.1 (versionCode 4)

The end-day button is always visible at full width under the countdown; it is disabled until a day starts and still requires a five-second hold. A reset action at the bottom of Today clears only today's recorded intervals and restarts the live day at a user-selected local time, rejecting future/nonexistent times. A required checkbox confirms the deletion. Previously recorded intervals crossing midnight are clipped so their previous/future-day portions survive. An unrecorded prior-day interval requires a title before reset, preserving that time as named history. Projects, reminder schedules, the independent countdown and known activity names are retained. Reset always targets the actual current calendar day, even when viewing an earlier history day. `node zaman/tests/day-reset.cjs` covers these behaviors and reload persistence.

## Version 1.3.0 (versionCode 5)

Projects use numbered lists and open/completed views. Task keys open an action dialog for editing, reminders, completion/reopening and deletion. Completing the last open task marks its project complete; explicit whole-project completion/reopening affects all its tasks. Partially completed projects appear in both views, each showing only matching tasks. New tasks reopen a completed project. Completion and reopening events store actual device timestamps, exposed as Persian dates and history; unknown legacy completion dates are never invented.

Task dueAt/dueRepeat metadata is retained separately from the alarm's next occurrence so firing a reminder does not remove the task from Today. Matching open tasks appear above the daily activity table; completed-today tasks move into a separate expandable group. Completion cancels pending task alarms; reopening restores future reminders (advancing paused repeats to a future occurrence, without replaying expired one-time alarms). Reminder edits update task deadlines; deleting a reminder clears the deadline, and deleting a task/project removes linked alarms. Existing linked reminders hydrate missing deadline metadata on load/import.

The existing native sync bridge receives the same linked alarm records and enabled flags. `node zaman/tests/project-workflow.cjs` validates numbered project selection, task CRUD, Persian deadlines, Today placement, ringing and retention after firing, completion timestamps/history and persistence, project moves, reopen behavior, repeat dates and responsive layout. The Android bridge smoke test also checks that scheduled task alarms reach native sync and are disabled on completion. Actual device background alarm delivery remains unverified.

## Version 1.4.0 (versionCode 6)

Independent project/task status, collapsible project list, project row actions, five-second hold plus confirmation for recoverable deletion, deleted-project folder and restore with alarm suspension, multiline task text, hidden ideas UI (legacy data retained), compact Today tasks and darker/larger daily table. Same signing key and local storage schema. Native device runtime remains unverified.

## Version 1.6.0 (versionCode 7)

Approved Ali Mirza logo embedded as adaptive launcher artwork and browser/settings identity; Persian application name updated. Existing Android package and signing certificate retained. Collapsible persisted dashboard sections, a six-row daily history viewport with sticky column headers and total, compact HH:MM chart durations beside percentages, and larger reminder text. Native local asset handler now serves PNG with image/png MIME. Same offline architecture and alarm engine. Source archive contains the web application, Java/XML sources, font, logo, build scripts and tests; private signing keys are intentionally excluded.


## Version1.6.0 (versionCode8)

Adds native device ringtone picker and per-category countdown/reminder sound preferences, preview and default fallback. The Java asset allowlist now permits only bundled index/help pages for navigation; no remote page can receive the bridge. Guide PDF can be saved via the Android document picker. MainActivity handles native back without dismissing the due memorial confirmation.

UpdateStore fetches a fixed HTTPS GitHub release manifest with timeouts, redirects disabled and a64KiB limit. APK paths are restricted to the same fixed repository downloads directory. DownloadManager saves in public Downloads; the persisted download ID and SHA-256 must match before status becomes verified. UpdateReceiver handles system completion; no silent installer or REQUEST_INSTALL_PACKAGES permission is used. Android8/9 requests WRITE_EXTERNAL_STORAGE only when the user initiates a download. Internet is used for this update check/download; no accounts, device identifier or billing service exists.

The free30day memorial is a local self-attestation gate, implemented in enhancements.js and persisted in LocalStorage. It is not a secure license mechanism and resets after data deletion; it must not be described as tamper-proof. It does not verify prayer/recitation. Alarm silencing remains usable.

Additional native source policy test:

```sh
javac -cp build/classes:$ANDROID_SDK_ROOT/platforms/android-35/android.jar -d build/test-classes tests/UpdatePolicyTest.java
java -cp build/test-classes:build/classes:$ANDROID_SDK_ROOT/platforms/android-35/android.jar ir.zaman.app.UpdatePolicyTest
```

See SOURCE-GUIDE.fa.md for reproducible source-package build instructions. Browser/mock tests exercise controls but do not prove physical Android ringtone, background alarm, DownloadManager or installer behavior.


## Version 1.7.0 (versionCode 9)

Applies the approved calligraphic Ali Mirza/time-management launcher identity and Today design. The activity-recording control is circular and green; task list, daily journey and daily share cards use coordinated purple, amber and blue identities, with Projects sharing the purple treatment. The updated About text identifies designer Amin Naghdi Pour (امین نقدی پور), phone09131693134, and memorial Ali Mirza Naghdi Pour. Existing package, signing certificate, local storage, alarm controls, update policy and monthly self-attestation behavior are retained. The illustrated HTML/PDF guide was refreshed for these visuals.

The designer contact link opens Android ACTION_DIAL only after a user gesture and only for the configured number; no phone-call permission or automatic call is used. The launcher foreground is inset for adaptive icon masks while keeping the approved artwork intact.
