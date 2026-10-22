# راهنمای مستقل نگهداری، ساخت و انتشار مدیریت زمان علی میرزا

این فایل همراه سورس است و برای ادامهٔ توسعه به تاریخچهٔ گفتگو وابسته نیست. فایل خصوصی امضای اندروید در بستهٔ رمزدار صاحب برنامه قرار دارد؛ آن بسته را جدا از فایل‌هایی که به کاربران می‌دهید نگه دارید.

## مشخصات ثابت

- مخزن: `https://github.com/thumper9480-droid/racking`
- شاخهٔ سایت و انتشار: `gh-pages`
- مسیر برنامه: `zaman/`؛ فایل‌های برنامهٔ دیگر در ریشهٔ مخزن را تغییر ندهید.
- شناسهٔ اندروید: `ir.zaman.app`؛ حداقل اندروید ۸، API 26؛ API هدف 35.
- آدرس وب: `https://thumper9480-droid.github.io/racking/zaman/`
- نشانی بررسی نسخه در اندروید: `https://raw.githubusercontent.com/thumper9480-droid/racking/gh-pages/zaman/release.json`
- فایل‌ها: `downloads/zaman-android-VERSION.apk` و بسته‌های سورس، PDF و نهایی در همان پوشه.
- اثر انگشت SHA-256 گواهی امضا: `6e1bb159b61451f7b4d10f7e97f5f7f6239fda52c28c55a2625071d88106c8ac`
- کلید داده‌های متن: `zaman-browser-v1`؛ فایل‌های صوتی در IndexedDB به نام `ali-mirza-voice-notes-v1` هستند. با تغییر نام یا مبدأ وب این داده‌ها خودکار منتقل نمی‌شوند.

## بازسازی در محیط جدید

۱. مخزن را بگیرید یا سورس ZIP را استخراج کنید. بستهٔ خصوصی را با رمز همراه آن باز کنید. فایل `keys/zaman-development.jks` همان کلیدی است که نسخه‌های نصب‌شده را امضا کرده است؛ برای به‌روزرسانی همان فایل لازم است.

۲. JDK 21، Android SDK Platform 35، Android Build Tools، Python 3، Node.js، Playwright و Chromium را نصب کنید. در Android SDK Manager می‌توانید Build Tools 35.0.0 را بگیرید. نمونهٔ مسیرها را با مسیرهای دستگاه خودتان عوض کنید:

```bash
export JAVA_HOME=/path/to/jdk-21
export ANDROID_SDK_ROOT=/path/to/android-sdk
export ANDROID_BUILD_TOOLS="$ANDROID_SDK_ROOT/build-tools/35.0.0"
export ZAMAN_SIGNING_DIR=/private/path/keys
export ZAMAN_STORE_PASSWORD='رمز داخل بستهٔ خصوصی'
export ZAMAN_KEY_PASSWORD='رمز کلید داخل بستهٔ خصوصی'
export ZAMAN_KEY_ALIAS=zaman
```

اسکریپت به فایل `$ZAMAN_SIGNING_DIR/zaman-development.jks` نیاز دارد. اگر کلید نباشد، ساخت متوقف می‌شود؛ کلید جدید خودکار ساخته نمی‌شود. رمز واقعی و کلید در سورس عمومی قرار نمی‌گیرند. رمز فعلی و مشخصات کامل در `CREDENTIALS.json` بستهٔ خصوصی هستند.

۳. از ریشهٔ سورس وب را اجرا کنید:

```bash
python3 -m http.server 4173
```

سپس `http://127.0.0.1:4173/zaman/` را باز کنید. `require('playwright')` باید برای Node قابل دسترسی باشد. آزمون‌ها به Chromium در `/usr/bin/chromium` نیاز دارند. برای تولید راهنما می‌توان مسیر دیگری را با `CHROMIUM_PATH` تعیین کرد.

۴. بعد از تغییرات، راهنما را تولید و APK را بسازید:

```bash
node zaman/scripts/generate-guide.cjs
bash zaman/android/build.sh
python3 zaman/scripts/prepare-release.py
```

خروجی ساخت در `zaman/android/build/` و بسته‌های نهایی در `downloads/` هستند. اسکریپت انتشار، امضای صحیح، تطبیق فایل‌های وب داخل APK، ZIP سورس، اثر انگشت فایل نصب و `release.json` را بررسی می‌کند. بدون کلید صحیح، انتشار بسته متوقف می‌شود.

## تغییر شمارهٔ نسخه

در نسخهٔ بعدی، `APP_VERSION` و `APP_VERSION_CODE` را در `zaman/enhancements.js` افزایش دهید. عدد `versionCode` باید از همهٔ نسخه‌های منتشرشده بیشتر باشد؛ پاک‌کردن یا کم‌کردن آن امکان نصب به‌روزرسانی را از بین می‌برد.

همان نام نسخه را در این محل‌ها هم هماهنگ کنید:

- `zaman/index.html`: پارامترهای کش فایل‌ها و نوشتهٔ نسخه در تنظیمات و درباره.
- `zaman/android/build.sh`: `--version-code`، `--version-name`، نام APK خروجی و خط تزریق `native.js`.
- `zaman/tests/android-bridge.cjs`: خط تزریق اسکریپت باید با `index.html` یکی باشد.
- `zaman/scripts/generate-guide.cjs`: نسخهٔ آزمایشی جاری؛ نمونهٔ آپدیت باید بزرگ‌تر از نسخهٔ جاری باشد.
- `zaman/android.html`، `help.html` و راهنماهای سورس: شمارهٔ نسخه و لینک‌ها.

سپس تولید راهنما، ساخت و `prepare-release.py` را دوباره اجرا کنید. `release.json` را دستی حدس نزنید؛ SHA-256 آن باید از APK نهایی و امضاشده محاسبه شود.

## انتشار و نمایش خودکار آپدیت

برای انتشار به حساب GitHub دارای دسترسی نوشتن نیاز دارید. رمز، توکن یا بازیابی حساب GitHub در این بسته نیست؛ در محیط جدید با حساب خودتان وارد شوید، مثلاً `gh auth login` و سپس `gh auth setup-git`. برنامه درگاه، سرور پولی یا کلید API تشخیص گفتار ندارد.

APK، سورس و راهنما و `zaman/release.json` را در یک commit روی شاخهٔ `gh-pages` منتشر کنید؛ از push اجباری استفاده نکنید. نمونه، وقتی تغییرات را بررسی کرده‌اید:

```bash
git add zaman downloads/FILES-FOR-THIS-VERSION
git commit -m "Release VERSION"
git push origin HEAD:gh-pages
```

`FILES-FOR-THIS-VERSION` جای‌نگهدار است؛ آن را با نام فایل‌های همان نسخه جایگزین کنید. فایل خصوصی کلید، رمزنامهٔ صاحب برنامه و پوشهٔ keys را به این دستور اضافه نکنید.

اندروید در شروع، هنگام بازگشت به برنامه و هر پنج دقیقه وقتی باز است، نسخه را بررسی می‌کند. نسخهٔ وب فایل `release.json` کنار خودش را می‌خواند. اگر `versionCode` بزرگ‌تر باشد، هشدار قرمز و کلید دریافت در امروز دیده می‌شوند. پس از دریافت و تطبیق SHA-256، کلید نصب نمایش داده می‌شود. نصب نهایی را سیستم اندروید تأیید می‌کند؛ برنامهٔ معمولی امکان نصب پنهانی ندارد. وقتی برنامه بسته و اینترنت قطع است، دریافت فوری خبر انتشار تضمین نمی‌شود؛ با بازشدن و اتصال دوباره بررسی می‌شود.

بعد از انتشار، لینک خام APK و manifest را باز کنید و SHA-256 فایل دانلودشده را با manifest تطبیق دهید. اطلاعات کاربران همراه به‌روزرسانی با همان شناسه و همان گواهی حفظ می‌شوند؛ نسخهٔ قبلی را برای نصب جدید حذف نکنید.

## داده‌ها، صدا و آزمون‌ها

«ضبط ویس» در اندروید با MediaRecorder بومی و AAC/MPEG-4، پس از تأیید مجوز میکروفن اجرا می‌شود؛ به getUserMedia در WebView وابسته نیست. نسخهٔ وب از MediaRecorder مرورگر استفاده می‌کند. فایل بومی با پیام‌های کوچک و مرتب به WebView منتقل و در همان IndexedDB ذخیره می‌شود. صداهای خام در localStorage نیستند؛ metadata روی کار و Blobها در IndexedDB هستند. پشتیبان JSON، صداها و متن را با هم صادر و بازیابی می‌کند. هر ویس حداکثر پنج دقیقه و ۸ مگابایت است؛ فایل پشتیبان سقف ۱۰۰ مگابایت دارد. لغو فرم، ویس تازهٔ ذخیره‌نشده را پاک می‌کند. حذف موقت پروژه صداها را نگه می‌دارد؛ پاک‌کردن کامل با سه تأیید، صداها را هم پاک می‌کند.

آزمون‌های مهم:

```bash
node zaman/tests/task-audio.cjs
node zaman/tests/automatic-updates.cjs
node zaman/tests/update-download.cjs
node zaman/tests/approved-design.cjs
node zaman/tests/release-112.cjs
node zaman/tests/manual-journal.cjs
node zaman/tests/android-bridge.cjs
```

بقیهٔ آزمون‌ها در `zaman/tests/` هستند؛ `open-panels.cjs` کمک‌آزمون است. آزمون صوتی از میکروفن ساختگی Chromium استفاده می‌کند. میکروفن واقعی گوشی، زنگ در پس‌زمینه، دانلود و نصب را بعد از ساخت روی گوشی واقعی هم بررسی کنید.

## تغییر رمز کلید و ادامهٔ کار پس از حذف گفتگو

ابتدا از فایل امضا کپی جداگانه بگیرید. برای تغییر رمز مخزن کلید می‌توانید از دستور تعاملی زیر استفاده کنید؛ رمز قبلی و جدید را خود keytool می‌پرسد:

```bash
"$JAVA_HOME/bin/keytool" -storepasswd -keystore "$ZAMAN_SIGNING_DIR/zaman-development.jks"
```

نوع فایل در `keytool -list` مشخص می‌شود. در مخزن PKCS12 معمولاً رمز کلید و مخزن یکسان است؛ هر دو متغیر محیطی را مطابق رمز جدید تنظیم کنید. نام alias و گواهی را تغییر ندهید. پس از تغییر، گواهی را دوباره بررسی و بستهٔ خصوصی تازه تهیه کنید؛ تغییر رمز با ساخت کلید جدید متفاوت است.

برای شروع گفتگوی تازه این متن کافی است: «سورس مدیریت زمان علی میرزا و بستهٔ خصوصی کلید را دارم. `zaman/MAINTENANCE.fa.md` را بخوان؛ برنامه در `zaman/` و شاخهٔ انتشار `gh-pages` است. آخرین نسخه و کد آن را از `enhancements.js` و manifest بخوان. داده‌ها، شناسهٔ بسته و گواهی فعلی را حفظ کن و کلید خصوصی را منتشر نکن.»
