package ir.zaman.app;

import android.app.*;
import android.content.*;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import java.io.*;
import java.net.*;
import java.security.MessageDigest;
import java.util.Locale;
import org.json.*;

final class UpdateStore {
  static final String MANIFEST="https://raw.githubusercontent.com/thumper9480-droid/racking/gh-pages/zaman/release.json";
  static final String PREFIX="https://raw.githubusercontent.com/thumper9480-droid/racking/gh-pages/downloads/";
  static android.content.SharedPreferences prefs(Context c){return c.getSharedPreferences("zaman-updates",0);}
  static boolean validApk(String url){return url!=null&&url.startsWith(PREFIX)&&url.substring(PREFIX.length()).matches("[A-Za-z0-9][A-Za-z0-9._-]*\\.apk");}
  static boolean validHash(String hash){return hash!=null&&hash.matches("[a-fA-F0-9]{64}");}
  static String downloadFilename(String source,String token){return source.substring(0,source.length()-4)+"-"+token+".apk";}
  static String downloadFailure(int reason){
    if(reason==DownloadManager.ERROR_FILE_ALREADY_EXISTS)return "فایل هم‌نام در دانلودها وجود دارد؛ دوباره دریافت کنید تا فایل تازه ساخته شود.";
    if(reason==DownloadManager.ERROR_INSUFFICIENT_SPACE)return "فضای گوشی کافی نیست؛ کمی فضا خالی کنید و دوباره دریافت کنید.";
    if(reason==DownloadManager.ERROR_DEVICE_NOT_FOUND)return "پوشهٔ دانلودها در دسترس نیست؛ حافظهٔ گوشی را بررسی کنید.";
    return "دانلود انجام نشد (کد "+reason+")؛ اتصال اینترنت را بررسی و دوباره دریافت کنید.";
  }
  static int versionCode(Context c){try{return c.getPackageManager().getPackageInfo(c.getPackageName(),0).versionCode;}catch(Exception ignored){return 0;}}
  static JSONObject fetch(Context c)throws Exception{
    HttpURLConnection connection=(HttpURLConnection)new URL(MANIFEST).openConnection();connection.setConnectTimeout(12000);connection.setReadTimeout(12000);connection.setInstanceFollowRedirects(false);connection.setUseCaches(false);
    try{if(connection.getResponseCode()!=200)throw new IOException("release unavailable");ByteArrayOutputStream buffer=new ByteArrayOutputStream();try(InputStream in=connection.getInputStream()){byte[] chunk=new byte[4096];int n;while((n=in.read(chunk))!=-1){if(buffer.size()+n>65536)throw new IOException("release too large");buffer.write(chunk,0,n);}}
      JSONObject release=new JSONObject(buffer.toString("UTF-8"));if(release.getInt("versionCode")<1||!validApk(release.getString("apkUrl"))||!validHash(release.getString("sha256")))throw new IOException("invalid release");
      return new JSONObject().put("ok",true).put("versionCode",release.getInt("versionCode")).put("versionName",release.optString("versionName","")).put("apkUrl",release.getString("apkUrl")).put("sha256",release.getString("sha256")).put("currentVersionCode",versionCode(c));
    }finally{connection.disconnect();}
  }
  static synchronized String start(Context c,String url,String hash){
    JSONObject result=new JSONObject();try{
      if(!validApk(url)||!validHash(hash))throw new IllegalArgumentException();
      refresh(c);
      if("downloading".equals(prefs(c).getString("status","")))return new JSONObject(status(c)).put("ok",true).toString();
      if("verified".equals(prefs(c).getString("status",""))&&hash.equalsIgnoreCase(prefs(c).getString("sha256",""))){
        try{verifiedUri(c);return new JSONObject(status(c)).put("ok",true).toString();}catch(Exception ignored){}
      }
      // DownloadManager never overwrites an existing public file. A unique name
      // also makes retry safe without deleting the user's earlier complete APKs.
      String file=downloadFilename(url.substring(PREFIX.length()),java.util.UUID.randomUUID().toString());
      DownloadManager.Request request=new DownloadManager.Request(Uri.parse(url)).setTitle("به‌روزرسانی مدیریت زمان علی میرزا").setDescription("فایل نصب پس از دانلود در پوشهٔ Downloads قرار می‌گیرد.").setMimeType("application/vnd.android.package-archive").setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED).setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,file);
      long id=c.getSystemService(DownloadManager.class).enqueue(request);
      if(!prefs(c).edit().putLong("id",id).putString("sha256",hash.toLowerCase(Locale.ROOT)).putString("status","downloading").putString("message","دریافت فایل نصب شروع شد…").commit())throw new IOException("download state unavailable");
      return result.put("ok",true).put("status","downloading").put("sha256",hash.toLowerCase(Locale.ROOT)).put("message","دریافت فایل نصب شروع شد…").put("id",id).toString();
    }catch(Exception e){try{return result.put("ok",false).put("error","دانلود شروع نشد؛ اتصال اینترنت و فضای گوشی را بررسی کنید.").toString();}catch(JSONException ignored){return "{\"ok\":false}";}}
  }
  static String hash(InputStream in)throws Exception{MessageDigest digest=MessageDigest.getInstance("SHA-256");byte[] bytes=new byte[32768];int n;while((n=in.read(bytes))!=-1)digest.update(bytes,0,n);StringBuilder value=new StringBuilder();for(byte b:digest.digest())value.append(String.format(Locale.ROOT,"%02x",b&255));return value.toString();}
  static synchronized void finish(Context c,long id){
    if(id!=prefs(c).getLong("id",-1))return;DownloadManager manager=c.getSystemService(DownloadManager.class);
    try(Cursor cursor=manager.query(new DownloadManager.Query().setFilterById(id))){
      if(cursor==null||!cursor.moveToFirst())throw new IOException("missing download");int status=cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));if(status!=DownloadManager.STATUS_SUCCESSFUL){prefs(c).edit().putString("status","failed").putString("message",downloadFailure(cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON)))).commit();return;}
      Uri uri=manager.getUriForDownloadedFile(id);if(uri==null)throw new IOException("missing file");String expected=prefs(c).getString("sha256","");String actual;try(InputStream in=c.getContentResolver().openInputStream(uri)){if(in==null)throw new IOException();actual=hash(in);}
      if(!expected.equals(actual)){manager.remove(id);throw new IOException("checksum mismatch");}
      prefs(c).edit().putString("status","verified").putString("message","فایل نصب بررسی شد و در دانلودها آماده است. برای نصب، فایل APK را باز کنید و تأیید گوشی را انجام دهید.").commit();
    }catch(Exception ignored){prefs(c).edit().putString("status","failed").putString("message","دانلود کامل یا معتبر نبود؛ دوباره دریافت کنید.").commit();}
  }
  static void refresh(Context c){
    if(!"downloading".equals(prefs(c).getString("status","")))return;long id=prefs(c).getLong("id",-1);
    try(Cursor cursor=c.getSystemService(DownloadManager.class).query(new DownloadManager.Query().setFilterById(id))){if(cursor==null||!cursor.moveToFirst()){prefs(c).edit().putString("status","failed").putString("message","دانلود پیدا نشد؛ دوباره دریافت کنید.").apply();return;}int status=cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));if(status==DownloadManager.STATUS_SUCCESSFUL||status==DownloadManager.STATUS_FAILED)finish(c,id);}catch(Exception ignored){}
  }
  static synchronized String status(Context c){
    refresh(c);JSONObject out=new JSONObject();
    try{
      String state=prefs(c).getString("status","idle");long id=prefs(c).getLong("id",-1);
      out.put("status",state).put("message",prefs(c).getString("message","")).put("id",id).put("sha256",prefs(c).getString("sha256",""));
      if("downloading".equals(state))try(Cursor cursor=c.getSystemService(DownloadManager.class).query(new DownloadManager.Query().setFilterById(id))){
        if(cursor!=null&&cursor.moveToFirst()){
          int status=cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
          long downloaded=cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)),total=cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
          out.put("downloadedBytes",downloaded).put("totalBytes",total);
          if(status==DownloadManager.STATUS_PAUSED)out.put("message","دانلود موقتاً متوقف است؛ اتصال اینترنت گوشی را بررسی کنید.");
          else if(status==DownloadManager.STATUS_PENDING)out.put("message","در انتظار شروع دانلود در گوشی…");
          else if(total>0)out.put("progress",Math.max(0,Math.min(100,downloaded*100/total)));
        }
      }
    }catch(Exception ignored){}
    return out.toString();
  }
  // An install is always an explicit user action. Recheck the actual bytes immediately
  // before sharing the app-owned DownloadManager URI with Android's installer.
  static synchronized Uri verifiedUri(Context c)throws Exception{
    refresh(c);
    if(!"verified".equals(prefs(c).getString("status","")))throw new IOException("no verified update");
    long id=prefs(c).getLong("id",-1);DownloadManager manager=c.getSystemService(DownloadManager.class);
    try(Cursor cursor=manager.query(new DownloadManager.Query().setFilterById(id))){
      if(cursor==null||!cursor.moveToFirst()||cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))!=DownloadManager.STATUS_SUCCESSFUL)throw new IOException("missing update");
    }
    Uri uri=manager.getUriForDownloadedFile(id);
    if(uri==null||!"content".equals(uri.getScheme()))throw new IOException("missing content URI");
    try(InputStream in=c.getContentResolver().openInputStream(uri)){
      if(in==null||!prefs(c).getString("sha256","").equals(hash(in)))throw new IOException("changed update");
    }
    return uri;
  }
  static synchronized void clear(Context c)throws IOException{
    long id=prefs(c).getLong("id",-1);
    if(id>=0){
      DownloadManager manager=c.getSystemService(DownloadManager.class);
      try(Cursor cursor=manager.query(new DownloadManager.Query().setFilterById(id))){
        // Keep completed public APKs; remove only an active or failed partial download.
        if(cursor!=null&&cursor.moveToFirst()&&cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))!=DownloadManager.STATUS_SUCCESSFUL)manager.remove(id);
      }
    }
    if(!prefs(c).edit().clear().commit())throw new IOException("update settings were not cleared");
  }
}
