package ir.zaman.app;

import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.media.RingtoneManager;
import android.os.*;
import android.provider.Settings;
import android.webkit.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import org.json.*;

public class MainActivity extends Activity {
  WebView web; ValueCallback<Uri[]> chooser; String exportText,ringtoneKind,pendingDownloadUrl,pendingDownloadHash;
  @Override public void onCreate(Bundle saved) {
    super.onCreate(saved);
    web=new WebView(this);web.setBackgroundColor(0xfff5f4ef);
    android.widget.FrameLayout frame=new android.widget.FrameLayout(this);frame.setBackgroundColor(0xfff5f4ef);frame.addView(web,new android.widget.FrameLayout.LayoutParams(-1,-1));
    frame.setOnApplyWindowInsetsListener((v,insets)->{if(Build.VERSION.SDK_INT>=30){android.graphics.Insets safe=insets.getInsets(android.view.WindowInsets.Type.systemBars()|android.view.WindowInsets.Type.displayCutout()|android.view.WindowInsets.Type.ime());v.setPadding(safe.left,safe.top,safe.right,safe.bottom);return android.view.WindowInsets.CONSUMED;}v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets.consumeSystemWindowInsets();});
    setContentView(frame);frame.requestApplyInsets();
    WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setJavaScriptCanOpenWindowsAutomatically(false);settings.setSupportMultipleWindows(false);settings.setDomStorageEnabled(true);settings.setAllowFileAccess(false);settings.setAllowContentAccess(true);settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    web.addJavascriptInterface(new Bridge(),"AndroidZaman");
    web.setWebViewClient(new WebViewClient(){
      @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest request){
        Uri u=request.getUrl();String path=u.getPath();
        if(!"https".equals(u.getScheme())||!"appassets.androidplatform.net".equals(u.getHost())||path==null||path.contains(".."))return missing();
        try {String file=path.equals("/")?"index.html":path.substring(1);String mime=file.endsWith(".js")?"text/javascript":file.endsWith(".css")?"text/css":file.endsWith(".ttf")?"font/ttf":file.endsWith(".png")?"image/png":file.endsWith(".svg")?"image/svg+xml":file.endsWith(".pdf")?"application/pdf":file.endsWith(".json")?"application/json":"text/html";return new WebResourceResponse(mime,"UTF-8",getAssets().open(file));}catch(IOException e){return missing();}
      }
      @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){Uri u=r.getUrl();String path=u.getPath();return !("https".equals(u.getScheme())&&"appassets.androidplatform.net".equals(u.getHost())&&(u.getPort()==-1||u.getPort()==443)&&(u.getQuery()==null)&&(path.equals("/")||path.equals("/index.html")||path.equals("/help.html")));}
    });
    web.setWebChromeClient(new WebChromeClient(){
      @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> callback,FileChooserParams params){if(chooser!=null)chooser.onReceiveValue(null);chooser=callback;startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE),10);return true;}
    });
    web.loadUrl("https://appassets.androidplatform.net/");
  }
  static WebResourceResponse missing(){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",java.util.Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
  @Override protected void onResume(){super.onResume();if(web!=null){web.onResume();web.evaluateJavascript("if(typeof tick==='function')tick();if(typeof updateNativeStatus==='function')updateNativeStatus();",null);}AlarmStore.restore(this);}
  @Override protected void onPause(){if(web!=null){web.evaluateJavascript("if(typeof save==='function')save();",null);web.onPause();}super.onPause();}
  @Override public void onBackPressed(){if(web.getUrl()!=null&&web.getUrl().startsWith("https://appassets.androidplatform.net/help.html")){if(web.canGoBack())web.goBack();else web.loadUrl("https://appassets.androidplatform.net/");return;}web.evaluateJavascript("if(document.querySelector('#memorial-dialog')?.open){}else if(document.querySelector('#about-dialog')&&document.querySelector('#about-dialog').open)document.querySelector('#about-dialog').close();else if(document.querySelector('#settings-dialog').open)document.querySelector('#settings-dialog').close();else if(document.querySelector('#dialog').open)dismissModal();else{tab='today';render();}",null);}
  @Override protected void onActivityResult(int request,int result,Intent data){
    super.onActivityResult(request,result,data);
    if(request==10&&chooser!=null){chooser.onReceiveValue(result==RESULT_OK&&data!=null?new Uri[]{data.getData()}:null);chooser=null;}
    if(request==11){if(result==RESULT_OK&&data!=null&&exportText!=null)try(OutputStream out=getContentResolver().openOutputStream(data.getData())){if(out==null)throw new IOException();out.write(exportText.getBytes(StandardCharsets.UTF_8));}catch(Exception e){toast("ذخیرهٔ فایل انجام نشد");}exportText=null;}
    if(request==12&&result==RESULT_OK&&data!=null&&data.getData()!=null){Uri destination=data.getData();boolean stored=false;try(InputStream in=getAssets().open("user-guide.pdf");OutputStream out=getContentResolver().openOutputStream(destination)){if(out==null)throw new IOException();byte[] block=new byte[32768];int n;while((n=in.read(block))!=-1)out.write(block,0,n);stored=true;}catch(Exception e){toast("ذخیرهٔ جزوه انجام نشد");}if(stored){toast("جزوهٔ PDF ذخیره شد");try{startActivity(new Intent(Intent.ACTION_VIEW).setDataAndType(destination,"application/pdf").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));}catch(ActivityNotFoundException ignored){toast("فایل ذخیره شد؛ برای خواندن، نمایشگر PDF نصب کنید.");}}}
    if(request==30&&ringtoneKind!=null){if(result==RESULT_OK&&data!=null){Uri uri=data.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI);SoundSettings.save(this,ringtoneKind,uri);if(uri!=null)try{getContentResolver().takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION);}catch(Exception ignored){}}ringtoneKind=null;web.evaluateJavascript("if(typeof updateNativeSounds==='function')updateNativeSounds();",null);}
  }
  void toast(String message){runOnUiThread(()->android.widget.Toast.makeText(this,message,1).show());}
  void callback(String name,String json){runOnUiThread(()->web.evaluateJavascript("if(typeof window."+name+"==='function')window."+name+"("+json+");",null));}
  void chooseSound(String kind){if(!SoundSettings.validKind(kind))return;ringtoneKind=kind;Intent intent=new Intent(RingtoneManager.ACTION_RINGTONE_PICKER).putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE,RingtoneManager.TYPE_ALL).putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE,"countdown".equals(kind)?"صدای تایمر معکوس":"صدای یادآورها").putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT,true).putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT,true).putExtra(RingtoneManager.EXTRA_RINGTONE_DEFAULT_URI,RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)).putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI,SoundSettings.selected(this,kind));try{startActivityForResult(intent,30);}catch(ActivityNotFoundException ignored){toast("انتخاب صدای سیستم در این گوشی در دسترس نیست.");}}
  @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);if(request==20&&results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)permissions();if(request==21){if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED&&pendingDownloadUrl!=null)callback("onNativeDownload",UpdateStore.start(this,pendingDownloadUrl,pendingDownloadHash));else callback("onNativeDownload","{\"ok\":false,\"error\":\"مجوز ذخیرهٔ فایل داده نشد.\"}");pendingDownloadUrl=null;pendingDownloadHash=null;}}
  void permissions(){if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},20);return;}if(!AlarmStore.exact(this)){startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+getPackageName())));return;}startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName()));}
  public final class Bridge {
    @JavascriptInterface public void sync(String json){try{AlarmStore.sync(MainActivity.this,json);}catch(Exception e){runOnUiThread(()->android.widget.Toast.makeText(MainActivity.this,"تنظیم زنگ انجام نشد؛ مجوزها را بررسی کنید",1).show());}}
    @JavascriptInterface public void permissions(){runOnUiThread(()->MainActivity.this.permissions());}
    @JavascriptInterface public String status(){return "{\"exact\":"+AlarmStore.exact(MainActivity.this)+",\"notifications\":"+getSystemService(NotificationManager.class).areNotificationsEnabled()+"}";}
    @JavascriptInterface public void fireDue(){
      org.json.JSONArray list=AlarmStore.read(MainActivity.this);StringBuilder titles=new StringBuilder();String kind="reminder";
      for(int n=0;n<list.length();n++)try{JSONObject a=list.getJSONObject(n);if(a.getLong("at")<=System.currentTimeMillis()){JSONObject fired=AlarmStore.fire(MainActivity.this,a.getString("id"));if(fired!=null){if(titles.length()>0)titles.append(" • ");titles.append(fired.optString("title"));if("countdown".equals(fired.optString("id")))kind="countdown";}}}catch(Exception ignored){}
      if(titles.length()>0)startForegroundService(new Intent(MainActivity.this,AlarmService.class).putExtra("title",titles.toString()).putExtra("kind",kind));
    }
    @JavascriptInterface public void stopAlarm(){stopService(new Intent(MainActivity.this,AlarmService.class));}
    @JavascriptInterface public void testAlarm(){runOnUiThread(()->startForegroundService(new Intent(MainActivity.this,AlarmService.class).putExtra("title","آزمایش زنگ مدیریت زمان علی میرزا")));}
    @JavascriptInterface public void chooseSound(String kind){if(SoundSettings.validKind(kind))runOnUiThread(()->MainActivity.this.chooseSound(kind));}
    @JavascriptInterface public String soundStatus(){return SoundSettings.status(MainActivity.this);}
    @JavascriptInterface public void testSound(String kind){if(SoundSettings.validKind(kind))runOnUiThread(()->startForegroundService(new Intent(MainActivity.this,AlarmService.class).putExtra("title","آزمایش صدای زنگ").putExtra("kind",kind)));}
    @JavascriptInterface public void checkForUpdate(){new Thread(()->{try{callback("onNativeUpdate",UpdateStore.fetch(MainActivity.this).toString());}catch(Exception e){callback("onNativeUpdate","{\"ok\":false,\"error\":\"بررسی نسخه انجام نشد؛ اتصال اینترنت را بررسی کنید.\"}");}},"zaman-update-check").start();}
    @JavascriptInterface public String downloadUpdate(String url,String hash){
      if(!UpdateStore.validApk(url)||!UpdateStore.validHash(hash))return "{\"ok\":false,\"error\":\"نشانی یا اثر انگشت فایل معتبر نیست.\"}";
      if(Build.VERSION.SDK_INT<29&&checkSelfPermission(android.Manifest.permission.WRITE_EXTERNAL_STORAGE)!=PackageManager.PERMISSION_GRANTED){pendingDownloadUrl=url;pendingDownloadHash=hash;runOnUiThread(()->requestPermissions(new String[]{android.Manifest.permission.WRITE_EXTERNAL_STORAGE},21));return "{\"ok\":false,\"permissionPending\":true,\"error\":\"مجوز ذخیرهٔ فایل را در پیام گوشی تأیید کنید.\"}";}
      return UpdateStore.start(MainActivity.this,url,hash);
    }
    @JavascriptInterface public String downloadStatus(){return UpdateStore.status(MainActivity.this);}
    @JavascriptInterface public void openDownloads(){runOnUiThread(()->{try{startActivity(new Intent(DownloadManager.ACTION_VIEW_DOWNLOADS));}catch(ActivityNotFoundException ignored){toast("پوشهٔ Downloads را در فایل‌های گوشی باز کنید.");}});}
    @JavascriptInterface public void openHelp(){runOnUiThread(()->web.loadUrl("https://appassets.androidplatform.net/help.html"));}
    @JavascriptInterface public void openGuide(){runOnUiThread(()->{try{startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/pdf").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE,"ali-mirza-user-guide.pdf"),12);}catch(ActivityNotFoundException ignored){toast("ذخیره‌ساز فایل در دسترس نیست.");}});}
    @JavascriptInterface public void export(String text){if(text.length()>5000000)return;runOnUiThread(()->{exportText=text;startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE,"zaman-backup.json"),11);});}
  }
}
