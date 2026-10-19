package ir.racking.app;

import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.webkit.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import org.json.*;

/** Local-only web UI with native alarms and document access. No remote bridge content. */
public class MobileActivity extends Activity {
  WebView web;
  ValueCallback<Uri[]> chooser;
  byte[] exportBytes;
  String pendingCommand;
  boolean ready;

  @Override
  public void onCreate(Bundle state) {
    super.onCreate(state);
    getWindow().setStatusBarColor(0xfff5f8f9);
    getWindow().setNavigationBarColor(0xfff5f8f9);
    web = new WebView(this);
    web.setBackgroundColor(0xfff5f8f9);
    web.setPadding(0, 0, 0, 0);
    // Resize the WebView's viewport itself. WebView padding does not move CSS fixed menus.
    android.widget.FrameLayout content = new android.widget.FrameLayout(this);
    content.setBackgroundColor(0xfff5f8f9);
    content.addView(web, new android.widget.FrameLayout.LayoutParams(-1, -1));
    content.setOnApplyWindowInsetsListener(
        (v, insets) -> {
          if (Build.VERSION.SDK_INT >= 30) {
            android.graphics.Insets safe =
                insets.getInsets(
                    android.view.WindowInsets.Type.systemBars()
                        | android.view.WindowInsets.Type.displayCutout()
                        | android.view.WindowInsets.Type.ime());
            v.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            return android.view.WindowInsets.CONSUMED;
          }
          v.setPadding(
              insets.getSystemWindowInsetLeft(),
              insets.getSystemWindowInsetTop(),
              insets.getSystemWindowInsetRight(),
              insets.getSystemWindowInsetBottom());
          return insets.consumeSystemWindowInsets();
        });
    setContentView(content);
    content.requestApplyInsets();
    WebSettings settings = web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(true);
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(true);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    web.addJavascriptInterface(new Bridge(), "AndroidNative");
    web.setWebViewClient(
        new WebViewClient() {
          @Override
          public WebResourceResponse shouldInterceptRequest(
              WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (!"appassets.androidplatform.net".equals(u.getHost()))
              return new WebResourceResponse(
                  "text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
            String path = u.getPath();
            if (path == null || path.contains("..")) return null;
            try {
              String file = path.equals("/") ? "index.html" : path.substring(1);
              String mime =
                  file.endsWith(".js")
                      ? "text/javascript"
                      : file.endsWith(".css")
                          ? "text/css"
                          : file.endsWith(".svg") ? "image/svg+xml" : "text/html";
              return new WebResourceResponse(mime, "UTF-8", getAssets().open(file));
            } catch (IOException e) {
              return new WebResourceResponse(
                  "text/plain",
                  "UTF-8",
                  404,
                  "Not Found",
                  java.util.Collections.emptyMap(),
                  new ByteArrayInputStream(new byte[0]));
            }
          }

          @Override
          public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest r) {
            return !"appassets.androidplatform.net".equals(r.getUrl().getHost());
          }

          @Override
          public void onPageFinished(WebView v, String url) {
            ready = true;
            deliver();
          }
        });
    web.setWebChromeClient(
        new WebChromeClient() {
          @Override
          public boolean onShowFileChooser(
              WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (chooser != null) chooser.onReceiveValue(null);
            chooser = callback;
            Intent pick =
                new Intent(Intent.ACTION_OPEN_DOCUMENT)
                    .setType("*/*")
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .putExtra(
                        Intent.EXTRA_MIME_TYPES,
                        new String[] {
                          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                          "application/json"
                        });
            startActivityForResult(pick, 10);
            return true;
          }
        });
    pendingCommand = getIntent().getStringExtra("mobileAction");
    web.loadUrl("https://appassets.androidplatform.net/");
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    pendingCommand = intent.getStringExtra("mobileAction");
    deliver();
  }

  void deliver() {
    if (ready && pendingCommand != null) {
      String action = pendingCommand;
      pendingCommand = null;
      web.evaluateJavascript("mobileCommand(" + JSONObject.quote(action) + ")", null);
    }
  }

  @Override
  public void onResume() {
    super.onResume();
    if (web != null) {
      web.onResume();
      if (ready) web.evaluateJavascript("mobileLastSync='';mobileSync();tick();", null);
    }
  }

  @Override
  public void onPause() {
    if (web != null) {
      web.evaluateJavascript("save();", null);
      web.onPause();
    }
    super.onPause();
  }

  @Override
  public void onBackPressed() {
    if (web != null)
      web.evaluateJavascript(
          "if(document.querySelector('#dialog').open)closeModal();else navigate('today');", null);
  }

  @Override
  protected void onActivityResult(int request, int result, Intent data) {
    super.onActivityResult(request, result, data);
    if (request == 10 && chooser != null) {
      chooser.onReceiveValue(
          result == RESULT_OK && data != null ? new Uri[] {data.getData()} : null);
      chooser = null;
    }
    if (request == 11 && result == RESULT_OK && data != null && exportBytes != null) {
      try (OutputStream out = getContentResolver().openOutputStream(data.getData())) {
        out.write(exportBytes);
      } catch (IOException e) {
        android.widget.Toast.makeText(
                this, "ذخیرهٔ فایل انجام نشد", android.widget.Toast.LENGTH_LONG)
            .show();
      } finally {
        exportBytes = null;
      }
    }
  }

  void export(String name, String mime, byte[] bytes) {
    runOnUiThread(
        () -> {
          exportBytes = bytes;
          startActivityForResult(
              new Intent(Intent.ACTION_CREATE_DOCUMENT)
                  .setType(mime)
                  .addCategory(Intent.CATEGORY_OPENABLE)
                  .putExtra(Intent.EXTRA_TITLE, name),
              11);
        });
  }

  final class Bridge {
    @JavascriptInterface
    public void sync(String json) {
      try {
        MobileAlarms.sync(MobileActivity.this, new JSONObject(json));
      } catch (Exception e) {
        runOnUiThread(
            () ->
                android.widget.Toast.makeText(
                        MobileActivity.this,
                        "تنظیم یادآوری ناموفق بود؛ مجوز زنگ دقیق را بررسی کن",
                        android.widget.Toast.LENGTH_LONG)
                    .show());
      }
    }

    @JavascriptInterface
    public void permissions() {
      runOnUiThread(
          () -> {
            if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
              requestPermissions(new String[] {android.Manifest.permission.POST_NOTIFICATIONS}, 20);
              return;
            }
            if (!Alarms.exact(MobileActivity.this)) {
              Alarms.requestExact(MobileActivity.this);
              return;
            }
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (Build.VERSION.SDK_INT >= 34 && !nm.canUseFullScreenIntent())
              startActivity(
                  new Intent(
                      Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
                      Uri.parse("package:" + getPackageName())));
            else
              startActivity(
                  new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                      .putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName()));
          });
    }

    @JavascriptInterface
    public String status() {
      return "{\"exact\":"
          + Alarms.exact(MobileActivity.this)
          + ",\"notifications\":"
          + getSystemService(NotificationManager.class).areNotificationsEnabled()
          + "}";
    }

    @JavascriptInterface
    public void ringStage(String label) {
      runOnUiThread(
          () ->
              startForegroundService(
                  new Intent(MobileActivity.this, AlarmService.class)
                      .putExtra("wake", false)
                      .putExtra("label", label)));
    }

    @JavascriptInterface
    public void stopAlarm() {
      stopService(new Intent(MobileActivity.this, AlarmService.class));
    }

    @JavascriptInterface
    public void saveFile(String name, String mime, String contents) {
      export(name, mime, contents.getBytes(StandardCharsets.UTF_8));
    }

    @JavascriptInterface
    public void template() {
      try (InputStream in = getAssets().open("raval-template.xlsx")) {
        export(
            "raval-template.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            Store.read(in, 8 * 1024 * 1024));
      } catch (IOException ignored) {
      }
    }
  }
}
