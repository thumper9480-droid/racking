#!/usr/bin/env python3
"""Package a built release from the repository or an extracted source ZIP. No private key is archived."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib, json, os, re, subprocess

root = Path(__file__).resolve().parents[2]
os.chdir(root)
version_file = Path('zaman/enhancements.js').read_text()
version = re.search(r"APP_VERSION='([^']+)'", version_file).group(1)
code = int(re.search(r'APP_VERSION_CODE=(\d+)', version_file).group(1))
apk = Path(f'zaman/android/build/zaman-{version}.apk')
bazaar_apk = Path(f'zaman/android/build/zaman-{version}-bazaar.apk')
downloads = Path('downloads')
downloads.mkdir(exist_ok=True)
tools = Path(os.environ.get('ANDROID_BUILD_TOOLS', str(Path(os.environ.get('ANDROID_SDK_ROOT', '/workspace/android-sdk')) / 'build-tools/android-15')))
def verify_apk(path, bazaar=False):
    cert = subprocess.check_output([str(tools/'apksigner'), 'verify', '--print-certs', str(path)], text=True)
    assert '6e1bb159b61451f7b4d10f7e97f5f7f6239fda52c28c55a2625071d88106c8ac' in cert, 'Restore the existing signing key before releasing'
    badging = subprocess.check_output([str(tools/'aapt'), 'dump', 'badging', str(path)], text=True)
    assert f"package: name='ir.zaman.app' versionCode='{code}' versionName='{version}'" in badging
    assert 'android.permission.RECORD_AUDIO' in badging
    assert ('android.permission.REQUEST_INSTALL_PACKAGES' in badging) != bazaar
    assert ('android.permission.WRITE_EXTERNAL_STORAGE' in badging) != bazaar
    if bazaar:
        with ZipFile(path) as built:
            dex = b''.join(built.read(name) for name in built.namelist() if re.fullmatch(r'classes\d*\.dex', name))
            for forbidden in [b'Lir/zaman/app/UpdateStore;', b'Lir/zaman/app/UpdateReceiver;', b'canRequestPackageInstalls', b'android.settings.MANAGE_UNKNOWN_APP_SOURCES', b'application/vnd.android.package-archive']:
                assert forbidden not in dex, f'Bazaar APK must exclude direct updater: {forbidden}'
            assert b'bazaar://details?id=ir.zaman.app' in dex
            manifest = subprocess.check_output([str(tools/'aapt'), 'dump', 'xmltree', str(path), 'AndroidManifest.xml'], text=True)
            assert 'UpdateReceiver' not in manifest
            assert b'Lir/zaman/app/NativeVoiceRecorder;' in dex
    verify_assets(path)

def verify_assets(path):
 with ZipFile(path) as built:
    html = Path('zaman/index.html').read_text()
    assert built.read('assets/index.html').decode() == html.replace(f'<script defer src="app.js?v={version}"></script>', f'<script defer src="app.js?v={version}"></script><script defer src="native.js"></script>')
    assets = re.findall(r'(?:src|href)="([^"?#]+)(?:\?[^"#]*)?"', html)
    for asset in set(assets + ['user-guide.pdf', 'android/native.js']):
        source = Path('zaman')/asset
        if source.is_file():
            target = 'native.js' if asset == 'android/native.js' else asset
            assert built.read('assets/'+target) == source.read_bytes(), asset
    for source in Path('zaman/guide-assets').glob('*'):
        assert built.read('assets/guide-assets/'+source.name) == source.read_bytes()
verify_apk(apk)
verify_apk(bazaar_apk, bazaar=True)
apk_public = downloads/f'zaman-android-{version}.apk'
apk_public.write_bytes(apk.read_bytes())
bazaar_public = downloads/f'zaman-android-{version}-bazaar.apk'
bazaar_public.write_bytes(bazaar_apk.read_bytes())
digest = hashlib.sha256(apk.read_bytes()).hexdigest()
release = {'versionCode': code, 'versionName': version, 'apkUrl': f'https://raw.githubusercontent.com/thumper9480-droid/racking/gh-pages/downloads/{apk_public.name}', 'sha256': digest}
Path('zaman/release.json').write_text(json.dumps(release, ensure_ascii=False, indent=2)+'\n')
source_zip = downloads/f'ali-mirza-time-source-{version}.zip'
prefix = f'ali-mirza-time-{version}/'
sources = []
for path in Path('zaman').rglob('*'):
    if not path.is_file() or any(part in {'build', '__pycache__', 'node_modules', '.git', 'owner-private', 'keys'} for part in path.parts):
        continue
    assert path.suffix.lower() not in {'.jks', '.keystore', '.p12', '.pem', '.key'}, f'Private file must stay outside source: {path}'
    if path.suffix not in {'.pyc', '.apk', '.zip'}:
        sources.append(path)
with ZipFile(source_zip, 'w', ZIP_DEFLATED) as archive:
    for path in sources:
        archive.write(path, prefix+str(path))
    archive.write('zaman/SOURCE-GUIDE.fa.md', prefix+'README.fa.md')
with ZipFile(source_zip) as archive:
    assert archive.testzip() is None
    for path in sources:
        assert archive.read(prefix+str(path)) == path.read_bytes()
pdf = downloads/f'ali-mirza-user-guide-{version}.pdf'
pdf.write_bytes(Path('zaman/user-guide.pdf').read_bytes())
parts = {apk_public.name: apk_public, bazaar_public.name: bazaar_public, source_zip.name: source_zip, pdf.name: pdf, 'BAZAAR-PUBLISH.fa.txt':Path('zaman/BAZAAR-PUBLISH.fa.txt'), 'today-top.png': Path('zaman/guide-assets/today.png'), 'today-compact.png': Path('zaman/guide-assets/today-compact.png')}
preview = downloads/f'ali-mirza-today-{version}.png'
if preview.exists():
    parts['today-full.png'] = preview
readme = f'''مدیریت زمان علی میرزا — {version}

APK را روی نسخهٔ قبلی نصب کنید؛ برنامهٔ قبلی را حذف نکنید.
بسته شامل اندروید، سورس کامل، جزوهٔ PDF و تصاویر واقعی است.
فایل دارای پسوند -bazaar.apk مخصوص بارگذاری در کافه‌بازار است؛ مجوز نصب بسته‌ها و کد نصب مستقیم ندارد و به‌روزرسانی آن از بازار انجام می‌شود. فایل بدون این پسوند برای نصب مستقیم است. نام بسته و امضای هر دو یکسان است.
این نسخه طرح تأییدشده با دکمهٔ مستطیلی و سه تم مشخص، ضبط و پخش ویس در کار پروژه و بررسی خودکار آپدیت در امروز دارد.
برای ویس، «ضبط ویس»، سپس «پایان ضبط» و بعد «ذخیره» را بزنید. میکروفن فقط هنگام ضبط فعال می‌شود. هر ویس حداکثر پنج دقیقه است.
پشتیبان JSON متن‌ها و صداها را با هم نگه می‌دارد؛ سقف فایل پشتیبان ۱۰۰ مگابایت است. فایل‌های ناقص پذیرفته نمی‌شوند.
آپدیت در شروع، برگشت به برنامه و هر پنج دقیقه هنگام بازبودن بررسی می‌شود. دریافت و نصب از هشدار صفحهٔ امروز انجام می‌شود؛ تأیید نهایی نصب با اندروید است.
راهنمای نگهداری و انتشار در zaman/MAINTENANCE.fa.md است. کلید امضا در بستهٔ عمومی نیست؛ بستهٔ خصوصی صاحب برنامه را جدا نگه دارید.
وب: https://thumper9480-droid.github.io/racking/zaman/?v={version}

آزمون‌های مرورگر و ساخت، امضا و هم‌ترازی APK بررسی شده‌اند؛ اجرای واقعی میکروفن، زنگ و نصب روی گوشی فیزیکی هنوز بررسی نشده است.
'''
bundle = downloads/f'ali-mirza-final-{version}.zip'
with ZipFile(bundle, 'w', ZIP_DEFLATED) as archive:
    for name, path in parts.items():
        archive.write(path, f'ali-mirza-final-{version}/'+name)
    archive.writestr(f'ali-mirza-final-{version}/README.fa.txt', readme)
    archive.writestr(f'ali-mirza-final-{version}/SHA256SUMS.txt', ''.join(hashlib.sha256(path.read_bytes()).hexdigest()+'  '+name+'\n' for name, path in parts.items()))
with ZipFile(bundle) as archive:
    assert archive.testzip() is None
market_bundle = downloads/f'ali-mirza-bazaar-{version}.zip'
with ZipFile(market_bundle, 'w', ZIP_DEFLATED) as archive:
    archive.write(bazaar_public, bazaar_public.name)
    archive.write('zaman/BAZAAR-PUBLISH.fa.txt', 'BAZAAR-PUBLISH.fa.txt')
    archive.write('zaman/logo.png', 'images/icon.png')
    for screenshot in sorted((downloads/'bazaar-assets-1.12.3').glob('0*.png')):
        archive.write(screenshot, 'images/'+screenshot.name)
    archive.writestr('SHA256SUMS.txt', hashlib.sha256(bazaar_public.read_bytes()).hexdigest()+'  '+bazaar_public.name+'\n')
with ZipFile(market_bundle) as archive:
    assert archive.testzip() is None
    # Image bundle may not be available when building from an extracted source ZIP.
    assert archive.read(bazaar_public.name) == bazaar_public.read_bytes()
for path in [apk_public, bazaar_public, source_zip, pdf, bundle, market_bundle, preview]:
    if path.exists():
        path.chmod(0o644)
(downloads/f'zaman-android-{version}.sha256').write_text(digest+'  '+apk_public.name+'\n')
(downloads/f'zaman-android-{version}-bazaar.sha256').write_text(hashlib.sha256(bazaar_public.read_bytes()).hexdigest()+'  '+bazaar_public.name+'\n')
(downloads/f'ali-mirza-time-{version}.sha256').write_text(''.join(hashlib.sha256(path.read_bytes()).hexdigest()+'  '+path.name+'\n' for path in [apk_public, bazaar_public, source_zip, pdf, bundle, market_bundle]))
print(f'PASS {version} ({code}): both APK channels/assets/certificates, Bazaar permission and DEX exclusions, {len(sources)} source files, PDF, manifest and bundles verified; direct SHA-256 {digest}; Bazaar SHA-256 {hashlib.sha256(bazaar_public.read_bytes()).hexdigest()}')
