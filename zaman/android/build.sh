#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
SDK_ROOT="${ANDROID_SDK_ROOT:-/workspace/android-sdk}"
TOOLS="${ANDROID_BUILD_TOOLS:-$SDK_ROOT/build-tools/android-15}"
PLATFORM="$SDK_ROOT/platforms/android-35/android.jar"
SIGNING_DIR="${ZAMAN_SIGNING_DIR:-/workspace/zaman-signing}"
export ZAMAN_STORE_PASSWORD="${ZAMAN_STORE_PASSWORD:-android}"
export ZAMAN_KEY_PASSWORD="${ZAMAN_KEY_PASSWORD:-$ZAMAN_STORE_PASSWORD}"
ZAMAN_KEY_ALIAS="${ZAMAN_KEY_ALIAS:-zaman}"
if [ ! -f "$SIGNING_DIR/zaman-development.jks" ]; then
 printf '%s\n' 'Restore the existing zaman-development.jks from the private owner recovery package before building.' >&2
 exit 1
fi
# Drop stale generated assets/classes so removed UI modules never ship in an update.
rm -rf build/assets build/classes build/dex
mkdir -p build/assets/fonts build/classes build/dex "$SIGNING_DIR"
cp ../index.html ../app.js ../style.css ../logo.png ../wordmark.png ../approved.css ../wall-clock.js ../wall-clock.css ../reset-time.js ../reset-time.css ../time-picker.js ../time-picker.css ../task-voice.js ../task-voice.css ../task-audio.js ../task-audio.css ../journal.js ../journal.css ../reports.js ../reports.css ../enhancements.js ../enhancements.css ../help.html ../guide.css ../guide.js ../user-guide.pdf build/assets/
cp -R ../guide-assets build/assets/
cp native.js build/assets/
cp ../fonts/Vazirmatn-Variable.ttf build/assets/fonts/
python3 - <<'PY'
from pathlib import Path
p=Path('build/assets/index.html')
s=p.read_text().replace('<script defer src="app.js?v=1.12.2"></script>','<script defer src="app.js?v=1.12.2"></script><script defer src="native.js"></script>')
p.write_text(s)
PY
"$TOOLS/aapt2" compile --dir res -o build/resources.zip
"$TOOLS/aapt2" link -o build/base.apk -I "$PLATFORM" --manifest AndroidManifest.xml --min-sdk-version 26 --target-sdk-version 35 --version-code 16 --version-name 1.12.2 -A build/assets build/resources.zip
find src -name '*.java' > build/sources.txt
"${JAVA_HOME:+$JAVA_HOME/bin/}javac" --release 17 -classpath "$PLATFORM" -d build/classes @build/sources.txt
find build/classes -name '*.class' > build/classes.txt
"$TOOLS/d8" --lib "$PLATFORM" --min-api 26 --output build/dex @build/classes.txt
python3 - <<'PY'
from zipfile import ZipFile,ZIP_DEFLATED
from pathlib import Path
with ZipFile('build/base.apk','a',ZIP_DEFLATED) as apk:
    for dex in Path('build/dex').glob('*.dex'):
        apk.write(dex,dex.name)
PY
"$TOOLS/zipalign" -f -p 4 build/base.apk build/aligned.apk
"$TOOLS/apksigner" sign --ks "$SIGNING_DIR/zaman-development.jks" --ks-pass env:ZAMAN_STORE_PASSWORD --key-pass env:ZAMAN_KEY_PASSWORD --ks-key-alias "$ZAMAN_KEY_ALIAS" --out build/zaman-1.12.2.apk build/aligned.apk
"$TOOLS/apksigner" verify --verbose build/zaman-1.12.2.apk
"$TOOLS/zipalign" -c -p 4 build/zaman-1.12.2.apk
"$TOOLS/aapt" dump badging build/zaman-1.12.2.apk
sha256sum build/zaman-1.12.2.apk
