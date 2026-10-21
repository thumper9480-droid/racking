package ir.zaman.app;

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

public class MainActivity extends Activity {
  WebView web; ValueCallback<Uri[]> chooser; String exportText;
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
        try {String file=path.equals("/")?"index.html":path.substring(1);String mime=file.endsWith(".js")?"text/javascript":file.endsWith(".css")?"text/css":file.endsWith(".ttf")?"font/ttf":file.endsWith(".png")?"image/png":"text/html";return new WebResourceResponse(mime,"UTF-8",getAssets().open(file));}catch(IOException e){return missing();}
      }
      @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){return !"https://appassets.androidplatform.net/".equals(r.getUrl().toString());}
    });
    web.setWebChromeClient(new WebChromeClient(){
      @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> callback,FileChooserParams params){if(chooser!=null)chooser.onReceiveValue(null);chooser=callback;startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE),10);return true;}
    });
    web.loadUrl("https://appassets.androidplatform.net/");
  }
  static WebResourceResponse missing(){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",java.util.Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
  @Override protected void onResume(){super.onResume();if(web!=null){web.onResume();web.evaluateJavascript("if(typeof tick==='function')tick();if(typeof updateNativeStatus==='function')updateNativeStatus();",null);}AlarmStore.restore(this);}
  @Override protected void onPause(){if(web!=null){web.evaluateJavascript("if(typeof save==='function')save();",null);web.onPause();}super.onPause();}
  @Override public void onBackPressed(){web.evaluateJavascript("if(document.querySelector('#settings-dialog').open)document.querySelector('#settings-dialog').close();else if(document.querySelector('#dialog').open)dismissModal();else{tab='today';render();}",null);}
  @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==10&&chooser!=null){chooser.onReceiveValue(result==RESULT_OK&&data!=null?new Uri[]{data.getData()}:null);chooser=null;}if(request==11){if(result==RESULT_OK&&data!=null&&exportText!=null)try(OutputStream out=getContentResolver().openOutputStream(data.getData())){out.write(exportText.getBytes(StandardCharsets.UTF_8));}catch(Exception e){android.widget.Toast.makeText(this,"ذخیرهٔ فایل انجام نشد",1).show();}exportText=null;}}
  @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);if(request==20&&results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)permissions();}
  void permissions(){if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},20);return;}if(!AlarmStore.exact(this)){startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+getPackageName())));return;}startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName()));}
  public final class Bridge {
    @JavascriptInterface public void sync(String json){try{AlarmStore.sync(MainActivity.this,json);}catch(Exception e){runOnUiThread(()->android.widget.Toast.makeText(MainActivity.this,"تنظیم زنگ انجام نشد؛ مجوزها را بررسی کنید",1).show());}}
    @JavascriptInterface public void permissions(){runOnUiThread(()->MainActivity.this.permissions());}
    @JavascriptInterface public String status(){return "{\"exact\":"+AlarmStore.exact(MainActivity.this)+",\"notifications\":"+getSystemService(NotificationManager.class).areNotificationsEnabled()+"}";}
    @JavascriptInterface public void fireDue(){
      org.json.JSONArray list=AlarmStore.read(MainActivity.this);StringBuilder titles=new StringBuilder();
      for(int n=0;n<list.length();n++)try{JSONObject a=list.getJSONObject(n);if(a.getLong("at")<=System.currentTimeMillis()){JSONObject fired=AlarmStore.fire(MainActivity.this,a.getString("id"));if(fired!=null){if(titles.length()>0)titles.append(" • ");titles.append(fired.optString("title"));}}}catch(Exception ignored){}
      if(titles.length()>0)startForegroundService(new Intent(MainActivity.this,AlarmService.class).putExtra("title",titles.toString()));
    }
    @JavascriptInterface public void stopAlarm(){stopService(new Intent(MainActivity.this,AlarmService.class));}
    @JavascriptInterface public void testAlarm(){runOnUiThread(()->startForegroundService(new Intent(MainActivity.this,AlarmService.class).putExtra("title","آزمایش زنگ مدیریت زمان علی میرزا")));}
    @JavascriptInterface public void export(String text){if(text.length()>5000000)return;runOnUiThread(()->{exportText=text;startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE,"zaman-backup.json"),11);});}
  }
}
