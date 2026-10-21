# سورس کامل مدیریت زمان علی میرزا — ۱.۵.۰

این بسته سورس کامل همین برنامهٔ وب و اندروید را دارد: HTML، CSS، JavaScript، Java، منابع XML، لوگو، فونت وزیرمتن، آزمون‌های مرورگر و آزمون محاسبهٔ یادآور اندروید. دادهٔ شخصی یا کلید امضای خصوصی داخل بسته نیست.

## اجرای وب

از پوشهٔ اصلی بسته، که پوشهٔ `zaman` در آن قرار دارد، اجرا کنید:

```sh
python3 -m http.server 4173
```

سپس در مرورگر همان دستگاه نشانی `http://localhost:4173/zaman/` را باز کنید. برنامهٔ وب به نصب کتابخانه نیاز ندارد. داده‌ها در مرورگر ذخیره می‌شوند؛ برای انتقال از تنظیمات بخش فعالیت‌ها پشتیبان JSON بگیرید و در نسخهٔ مقصد بازیابی کنید. لوگو در `zaman/logo.png` است.

## ساخت APK

نیازمندی‌ها: Bash، Python 3، ابزار zip، JDK 21، Android SDK Platform 35 و Android Build Tools 35.0.0. مقدار مسیر ابزارها را مطابق محل نصب خود تعیین کنید:

```sh
export JAVA_HOME=/path/to/jdk-21
export PATH="$JAVA_HOME/bin:$PATH"
export ANDROID_SDK_ROOT=/path/to/android-sdk
export ANDROID_BUILD_TOOLS="$ANDROID_SDK_ROOT/build-tools/35.0.0"
export ZAMAN_SIGNING_DIR=/private/path/to/signing
bash zaman/android/build.sh
```

خروجی `zaman/android/build/zaman-1.5.0.apk` است. اسکریپت امضا و هم‌ترازی فایل را هم بررسی می‌کند. اگر در پوشهٔ امضا کلیدی نباشد، کلید توسعهٔ تازه ایجاد می‌شود. آن را خصوصی نگه دارید؛ کلید تازه نمی‌تواند روی نسخهٔ منتشرشدهٔ قبلی نصب شود. APK همراه لینک انتشار با همان کلید نسخه‌های قبلی ساخته شده و به‌عنوان به‌روزرسانی قابل نصب است. شناسهٔ بسته `ir.zaman.app` و حداقل اندروید ۸ است.

## آزمون‌ها

با Node.js و Chromium نصب‌شده، از پوشهٔ اصلی بسته:

```sh
npm install --no-save --package-lock=false playwright
node zaman/tests/final-dashboard.cjs
node zaman/tests/project-independent.cjs
node zaman/tests/project-workflow.cjs
node zaman/tests/android-bridge.cjs
```

آزمون‌ها وب‌سرور پورت ۴۱۷۳ و Chromium در `/usr/bin/chromium` را انتظار دارند؛ اگر مرورگر جای دیگری است، `executablePath` را در فایل‌های آزمون مطابق محیط خود تنظیم کنید. آزمون‌های دیگر هم در پوشهٔ `zaman/tests` هستند. راهنمای بیشتر اندروید و آزمون JVM یادآورها در `zaman/android/README.md` قرار دارد.

در مرورگر برای زنگ صفحه باید باز و دستگاه فعال باشد. APK زنگ بومی اندروید دارد و به مجوز اعلان/زنگ دقیق وابسته است. ساخت و امضای APK و آزمون رابط بررسی شده‌اند؛ اجرای زنگ در پس‌زمینه، هنگام قفل و پس از راه‌اندازی مجدد هنوز روی گوشی واقعی بررسی نشده است.
