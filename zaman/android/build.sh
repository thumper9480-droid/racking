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
CHANNEL="${ZAMAN_CHANNEL:-direct}"
case "$CHANNEL" in direct|bazaar) ;; *) printf '%s\n' 'ZAMAN_CHANNEL must be direct or bazaar' >&2; exit 1 ;; esac
read -r VERSION VERSION_CODE < <(python3 -c "import pathlib,re; s=pathlib.Path('../enhancements.js').read_text(); print(re.search(r\"APP_VERSION='([^']+)'\",s)[1],re.search(r'APP_VERSION_CODE=(\d+)',s)[1])")
APK_NAME="zaman-$VERSION"
if [ "$CHANNEL" = bazaar ]; then APK_NAME="$APK_NAME-bazaar"; fi
if [ ! -f "$SIGNING_DIR/zaman-development.jks" ]; then
 printf '%s\n' 'Restore the existing zaman-development.jks from the private owner recovery package before building.' >&2
 exit 1
fi
# Drop stale generated assets/classes so removed UI modules never ship in an update.
rm -rf build/assets build/classes build/dex
mkdir -p build/assets/fonts build/classes build/dex "$SIGNING_DIR"
cp ../ios-support.js ../manifest.webmanifest ../project-tools.js ../project-tools.css ../index.html ../app.js ../style.css ../logo.png ../wordmark.png ../approved.css ../wall-clock.js ../wall-clock.css ../reset-time.js ../reset-time.css ../time-picker.js ../time-picker.css ../task-voice.js ../task-voice.css ../task-audio.js ../task-audio.css ../journal.js ../journal.css ../reports.js ../reports.css ../enhancements.js ../enhancements.css ../help.html ../guide.css ../guide.js ../user-guide.pdf build/assets/
cp -R ../guide-assets build/assets/
cp native.js build/assets/
cp ../fonts/Vazirmatn-Variable.ttf build/assets/fonts/
python3 - "$CHANNEL" "$VERSION" <<'PY'
from pathlib import Path
import sys,xml.etree.ElementTree as ET
channel,version=sys.argv[1:]
p=Path('build/assets/index.html')
s=p.read_text().replace(f'<script defer src="app.js?v={version}"></script>',f'<script defer src="app.js?v={version}"></script><script defer src="native.js"></script>')
assert '<script defer src="native.js"></script>' in s
p.write_text(s)
ET.register_namespace('android','http://schemas.android.com/apk/res/android')
manifest=ET.parse('AndroidManifest.xml');root=manifest.getroot();name='{http://schemas.android.com/apk/res/android}name'
if channel=='bazaar':
    for permission in list(root.findall('uses-permission')):
        if permission.get(name) in {'android.permission.REQUEST_INSTALL_PACKAGES','android.permission.WRITE_EXTERNAL_STORAGE'}:root.remove(permission)
    app=root.find('application')
    for receiver in list(app.findall('receiver')):
        if receiver.get(name)=='.UpdateReceiver':app.remove(receiver)
manifest.write('build/AndroidManifest.xml',encoding='utf-8',xml_declaration=True)
PY
"$TOOLS/aapt2" compile --dir res -o build/resources.zip
"$TOOLS/aapt2" link -o build/base.apk -I "$PLATFORM" --manifest build/AndroidManifest.xml --min-sdk-version 26 --target-sdk-version 35 --version-code "$VERSION_CODE" --version-name "$VERSION" -A build/assets build/resources.zip
find src -name '*.java' > build/sources.txt
if [ "$CHANNEL" = bazaar ]; then
 python3 -c "from pathlib import Path; p=Path('build/sources.txt'); p.write_text(''.join(s+'\n' for s in p.read_text().splitlines() if Path(s).name not in {'UpdateStore.java','UpdateReceiver.java'}))"
fi
find "channels/$CHANNEL" -name '*.java' >> build/sources.txt
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
"$TOOLS/apksigner" sign --ks "$SIGNING_DIR/zaman-development.jks" --ks-pass env:ZAMAN_STORE_PASSWORD --key-pass env:ZAMAN_KEY_PASSWORD --ks-key-alias "$ZAMAN_KEY_ALIAS" --out "build/$APK_NAME.apk" build/aligned.apk
"$TOOLS/apksigner" verify --verbose "build/$APK_NAME.apk"
"$TOOLS/zipalign" -c -p 4 "build/$APK_NAME.apk"
"$TOOLS/aapt" dump badging "build/$APK_NAME.apk"
sha256sum "build/$APK_NAME.apk"
