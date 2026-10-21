#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
SDK_ROOT="${ANDROID_SDK_ROOT:-/workspace/android-sdk}"
TOOLS="${ANDROID_BUILD_TOOLS:-$SDK_ROOT/build-tools/android-15}"
PLATFORM="$SDK_ROOT/platforms/android-35/android.jar"
SIGNING_DIR="${ZAMAN_SIGNING_DIR:-/workspace/zaman-signing}"
mkdir -p build/assets/fonts build/classes build/dex "$SIGNING_DIR"
cp ../index.html ../app.js ../style.css ../logo.png ../wordmark.png ../approved.css ../analog-clock.js ../analog-clock.css ../reset-time.js ../reset-time.css ../reports.js ../reports.css ../enhancements.js ../enhancements.css ../help.html ../guide.css ../guide.js ../user-guide.pdf build/assets/
cp -R ../guide-assets build/assets/
cp native.js build/assets/
cp ../fonts/Vazirmatn-Variable.ttf build/assets/fonts/
python3 - <<'PY'
from pathlib import Path
p=Path('build/assets/index.html')
s=p.read_text().replace('<script defer src="app.js?v=1.9.0"></script>','<script defer src="app.js?v=1.9.0"></script><script defer src="native.js"></script>')
p.write_text(s)
PY
"$TOOLS/aapt2" compile --dir res -o build/resources.zip
"$TOOLS/aapt2" link -o build/base.apk -I "$PLATFORM" --manifest AndroidManifest.xml --min-sdk-version 26 --target-sdk-version 35 --version-code 11 --version-name 1.9.0 -A build/assets build/resources.zip
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
if [ ! -f "$SIGNING_DIR/zaman-development.jks" ]; then
 keytool -genkeypair -noprompt -keystore "$SIGNING_DIR/zaman-development.jks" -storepass android -keypass android -alias zaman -dname 'CN=Zaman Development' -keyalg RSA -keysize 2048 -validity 10000 >/dev/null
fi
"$TOOLS/apksigner" sign --ks "$SIGNING_DIR/zaman-development.jks" --ks-pass pass:android --key-pass pass:android --ks-key-alias zaman --out build/zaman-1.9.0.apk build/aligned.apk
"$TOOLS/apksigner" verify --verbose build/zaman-1.9.0.apk
"$TOOLS/zipalign" -c -p 4 build/zaman-1.9.0.apk
"$TOOLS/aapt" dump badging build/zaman-1.9.0.apk
sha256sum build/zaman-1.9.0.apk
