package ir.zaman.app;

import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.media.RingtoneManager;
import android.os.*;
import android.provider.Settings;
import android.webkit.*;
import android.speech.RecognizerIntent;
import java.io.*;
import java.nio.charset.StandardCharsets;
import org.json.*;

public class MainActivity extends Activity {
  NativeVoiceRecorder nativeVoice; String pendingVoiceId; boolean voicePermissionPending=false,voiceResumed=false;
  AppUpdates updates;
  WebView web; PermissionRequest pendingMic; ValueCallback<Uri[]> chooser; String exportText,ringtoneKind,dictationRequestId;
  @Override public void onCreate(Bundle saved) {
    super.onCreate(saved);
    updates=new AppUpdates(this);
    nativeVoice=new NativeVoiceRecorder(this,(name,json)->callback(name,json));
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
      @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){Uri u=r.getUrl();if("tel".equals(u.getScheme())&&"09131693134".equals(u.getSchemeSpecificPart())&&r.hasGesture()){try{startActivity(new Intent(Intent.ACTION_DIAL,u));}catch(ActivityNotFoundException ignored){toast("شمارهٔ طراح: 09131693134");}return true;}String path=u.getPath();return !("https".equals(u.getScheme())&&"appassets.androidplatform.net".equals(u.getHost())&&(u.getPort()==-1||u.getPort()==443)&&(u.getQuery()==null)&&(path.equals("/")||path.equals("/index.html")||path.equals("/help.html")));}
    });
    web.setWebChromeClient(new WebChromeClient(){
      @Override public void onPermissionRequest(PermissionRequest request){runOnUiThread(()->{
        Uri origin=request.getOrigin();String[] resources=request.getResources();
        if(!"https".equals(origin.getScheme())||!"appassets.androidplatform.net".equals(origin.getHost())||(origin.getPort()!=-1&&origin.getPort()!=443)||resources.length!=1||!PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resources[0])){request.deny();return;}
        if(pendingMic!=null){request.deny();return;}
        if(checkSelfPermission(android.Manifest.permission.RECORD_AUDIO)==PackageManager.PERMISSION_GRANTED)request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        else{pendingMic=request;requestPermissions(new String[]{android.Manifest.permission.RECORD_AUDIO},41);}
      });}
      @Override public void onPermissionRequestCanceled(PermissionRequest request){runOnUiThread(()->{if(pendingMic==request)pendingMic=null;});}
      @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> callback,FileChooserParams params){if(chooser!=null)chooser.onReceiveValue(null);chooser=callback;startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE),10);return true;}
    });
    web.loadUrl("https://appassets.androidplatform.net/");
  }
  static WebResourceResponse missing(){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",java.util.Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
  @Override protected void onResume(){super.onResume();voiceResumed=true;if(web!=null){web.onResume();web.evaluateJavascript("if(typeof tick==='function')tick();if(typeof updateNativeStatus==='function')updateNativeStatus();if(typeof restoreUpdateDownload==='function')restoreUpdateDownload();if(typeof autoCheckForUpdate==='function')autoCheckForUpdate(true);",null);}startPendingVoice();AlarmStore.restore(this);}
  @Override protected void onPause(){voiceResumed=false;if(nativeVoice!=null)nativeVoice.stopCurrent();if(web!=null){web.evaluateJavascript("if(typeof stopAudioRecording==='function')stopAudioRecording();if(typeof save==='function')save();",null);web.onPause();}super.onPause();}
  @Override public void onBackPressed(){if(web.getUrl()!=null&&web.getUrl().startsWith("https://appassets.androidplatform.net/help.html")){if(web.canGoBack())web.goBack();else web.loadUrl("https://appassets.androidplatform.net/");return;}web.evaluateJavascript("if(document.querySelector('#memorial-dialog')?.open){}else if(document.querySelector('#wipe-dialog')?.open&&typeof cancelWipeFlow==='function')cancelWipeFlow();else if(document.querySelector('#education-dialog')?.open)document.querySelector('#education-dialog').close();else if(document.querySelector('#about-dialog')&&document.querySelector('#about-dialog').open)document.querySelector('#about-dialog').close();else if(document.querySelector('#settings-dialog').open)document.querySelector('#settings-dialog').close();else if(document.querySelector('#dialog').open)dismissModal();else{tab='today';render();}",null);}
  @Override protected void onActivityResult(int request,int result,Intent data){
    super.onActivityResult(request,result,data);
    if(request==40&&dictationRequestId!=null){String id=dictationRequestId;dictationRequestId=null;String text=null;if(result==RESULT_OK&&data!=null){java.util.ArrayList<String> words=data.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);if(words!=null&&!words.isEmpty())text=words.get(0);}dictationResult(id,text,null,result!=RESULT_OK);}
    if(request==10&&chooser!=null){chooser.onReceiveValue(result==RESULT_OK&&data!=null?new Uri[]{data.getData()}:null);chooser=null;}
    if(request==11){if(result==RESULT_OK&&data!=null&&exportText!=null)try(OutputStream out=getContentResolver().openOutputStream(data.getData())){if(out==null)throw new IOException();out.write(exportText.getBytes(StandardCharsets.UTF_8));}catch(Exception e){toast("ذخیرهٔ فایل انجام نشد");}exportText=null;}
    if(request==12&&result==RESULT_OK&&data!=null&&data.getData()!=null){Uri destination=data.getData();boolean stored=false;try(InputStream in=getAssets().open("user-guide.pdf");OutputStream out=getContentResolver().openOutputStream(destination)){if(out==null)throw new IOException();byte[] block=new byte[32768];int n;while((n=in.read(block))!=-1)out.write(block,0,n);stored=true;}catch(Exception e){toast("ذخیرهٔ جزوه انجام نشد");}if(stored){toast("جزوهٔ PDF ذخیره شد");try{startActivity(new Intent(Intent.ACTION_VIEW).setDataAndType(destination,"application/pdf").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));}catch(ActivityNotFoundException ignored){toast("فایل ذخیره شد؛ برای خواندن، نمایشگر PDF نصب کنید.");}}}
    if(request==30&&ringtoneKind!=null){if(result==RESULT_OK&&data!=null){Uri uri=data.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI);SoundSettings.save(this,ringtoneKind,uri);if(uri!=null)try{getContentResolver().takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION);}catch(Exception ignored){}}ringtoneKind=null;web.evaluateJavascript("if(typeof updateNativeSounds==='function')updateNativeSounds();",null);}
    updates.onActivityResult(request,result,data);
  }
  @Override protected void onDestroy(){pendingVoiceId=null;if(nativeVoice!=null)nativeVoice.close();if(pendingMic!=null){pendingMic.deny();pendingMic=null;}if(web!=null)web.destroy();super.onDestroy();}
  void requestVoice(String id){
    if(!NativeVoiceRecorder.validId(id))return;
    if(pendingVoiceId!=null){nativeVoice.error(id,"BUSY","درخواست قبلی میکروفن هنوز پایان نیافته است.");return;}
    pendingVoiceId=id;
    if(checkSelfPermission(android.Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){voicePermissionPending=true;requestPermissions(new String[]{android.Manifest.permission.RECORD_AUDIO},42);return;}
    startPendingVoice();
  }
  void startPendingVoice(){
    if(!voiceResumed||voicePermissionPending||pendingVoiceId==null)return;
    String id=pendingVoiceId;pendingVoiceId=null;
    if(checkSelfPermission(android.Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){nativeVoice.error(id,"PERMISSION_DENIED","اجازهٔ میکروفن داده نشد؛ مجوز میکروفن برنامه را در تنظیمات گوشی فعال کنید.");return;}
    nativeVoice.start(id);
  }
  void cancelVoice(String id){if(id!=null&&id.equals(pendingVoiceId)){pendingVoiceId=null;voicePermissionPending=false;}nativeVoice.cancel(id);}
  void dictationResult(String id,String text,String error,boolean cancelled){try{JSONObject result=new JSONObject();result.put("requestId",id);result.put("cancelled",cancelled);if(text!=null)result.put("text",text);if(error!=null)result.put("error",error);callback("onNativeTaskVoice",result.toString());}catch(JSONException ignored){}}
  void startTaskDictation(String id){
    if(id==null||!id.matches("[a-fA-F0-9-]{36}")||dictationRequestId!=null)return;
    dictationRequestId=id;
    Intent speech=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM).putExtra(RecognizerIntent.EXTRA_LANGUAGE,"fa-IR").putExtra(RecognizerIntent.EXTRA_PROMPT,"کار پروژه را بگویید").putExtra(RecognizerIntent.EXTRA_MAX_RESULTS,1);
    try{startActivityForResult(speech,40);}catch(Exception e){dictationRequestId=null;dictationResult(id,null,"سرویس تشخیص گفتار در این گوشی در دسترس نیست؛ از میکروفن صفحه‌کلید استفاده کنید.",false);}
  }
  void toast(String message){runOnUiThread(()->android.widget.Toast.makeText(this,message,1).show());}
  void callback(String name,String json){runOnUiThread(()->{if(web!=null&&!isFinishing()&&!isDestroyed())web.evaluateJavascript("if(typeof window."+name+"==='function')window."+name+"("+json+");",null);});}
  void chooseSound(String kind){if(!SoundSettings.validKind(kind))return;ringtoneKind=kind;Intent intent=new Intent(RingtoneManager.ACTION_RINGTONE_PICKER).putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE,RingtoneManager.TYPE_ALL).putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE,"countdown".equals(kind)?"صدای تایمر معکوس":"صدای یادآورها").putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT,true).putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT,true).putExtra(RingtoneManager.EXTRA_RINGTONE_DEFAULT_URI,RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)).putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI,SoundSettings.selected(this,kind));try{startActivityForResult(intent,30);}catch(ActivityNotFoundException ignored){toast("انتخاب صدای سیستم در این گوشی در دسترس نیست.");}}
  @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){super.onRequestPermissionsResult(request,permissions,results);if(request==42){voicePermissionPending=false;if(pendingVoiceId!=null){if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)startPendingVoice();else{String id=pendingVoiceId;pendingVoiceId=null;nativeVoice.error(id,"PERMISSION_DENIED","اجازهٔ میکروفن داده نشد؛ مجوز میکروفن برنامه را در تنظیمات گوشی فعال کنید.");}}}if(request==41&&pendingMic!=null){PermissionRequest mic=pendingMic;pendingMic=null;if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)mic.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});else mic.deny();}if(request==20&&results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED)permissions();updates.onRequestPermissionsResult(request,results);}

  void permissions(){if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},20);return;}if(!AlarmStore.exact(this)){startActivity(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,Uri.parse("package:"+getPackageName())));return;}startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName()));}
  public final class Bridge {
    @JavascriptInterface public void startVoiceRecording(String id){runOnUiThread(()->requestVoice(id));}
    @JavascriptInterface public void stopVoiceRecording(String id){runOnUiThread(()->nativeVoice.stop(id));}
    @JavascriptInterface public void cancelVoiceRecording(String id){runOnUiThread(()->cancelVoice(id));}
    @JavascriptInterface public void startTaskDictation(String requestId){runOnUiThread(()->MainActivity.this.startTaskDictation(requestId));}
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
    @JavascriptInterface public String distributionChannel(){return updates.channel();}
    @JavascriptInterface public String openStore(){return updates.openStore();}
    @JavascriptInterface public void checkForUpdate(){updates.check();}
    @JavascriptInterface public String downloadUpdate(String url,String hash){return updates.download(url,hash);}
    @JavascriptInterface public String downloadStatus(){return updates.status();}
    @JavascriptInterface public String installDownloadedUpdate(){updates.install();return "{\"ok\":true,\"scheduled\":true}";}
    @JavascriptInterface public String clearAppData(){
      try{
        dictationRequestId=null;exportText=null;ringtoneKind=null;
        AlarmStore.clear(MainActivity.this);
        stopService(new Intent(MainActivity.this,AlarmService.class));
        getSystemService(NotificationManager.class).cancel(1);
        updates.clear();
        if(!SoundSettings.prefs(MainActivity.this).edit().clear().commit())throw new IOException("sound settings were not cleared");
        return "{\"ok\":true}";
      }catch(Exception e){return "{\"ok\":false,\"error\":\"پاک‌کردن همهٔ تنظیمات اندروید کامل نشد؛ دوباره تلاش کنید.\"}";}
    }
    @JavascriptInterface public void openDownloads(){runOnUiThread(()->{try{startActivity(new Intent(DownloadManager.ACTION_VIEW_DOWNLOADS));}catch(ActivityNotFoundException ignored){toast("پوشهٔ Downloads را در فایل‌های گوشی باز کنید.");}});}
    @JavascriptInterface public void openHelpSection(String section){if(section==null||!section.matches("today|sleep|journey|timers|projects|audio|reports|settings|updates|answers"))return;runOnUiThread(()->web.loadUrl("https://appassets.androidplatform.net/help.html#"+section));}
    @JavascriptInterface public void openHelp(){runOnUiThread(()->web.loadUrl("https://appassets.androidplatform.net/help.html"));}
    @JavascriptInterface public void openGuide(){runOnUiThread(()->{try{startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/pdf").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE,"ali-mirza-user-guide.pdf"),12);}catch(ActivityNotFoundException ignored){toast("ذخیره‌ساز فایل در دسترس نیست.");}});}
    @JavascriptInterface public void export(String text){if(text.length()>104857600)return;runOnUiThread(()->{exportText=text;startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE,"zaman-backup.json"),11);});}
  }
}
