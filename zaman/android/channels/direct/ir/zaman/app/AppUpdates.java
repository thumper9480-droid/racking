package ir.zaman.app;

import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import java.io.IOException;

/** Only included in APKs distributed directly by the owner. */
final class AppUpdates {
  final MainActivity activity;
  String pendingUrl,pendingHash;
  volatile int generation=0;
  volatile boolean pendingInstall=false,installBusy=false;
  AppUpdates(MainActivity activity){this.activity=activity;}
  String channel(){return "direct";}
  String openStore(){return "{\"ok\":false}";}
  void check(){new Thread(()->{try{activity.callback("onNativeUpdate",UpdateStore.fetch(activity).toString());}catch(Exception e){activity.callback("onNativeUpdate","{\"ok\":false,\"error\":\"بررسی نسخه انجام نشد؛ اتصال اینترنت را بررسی کنید.\"}");}},"zaman-update-check").start();}
  String download(String url,String hash){
    if(!UpdateStore.validApk(url)||!UpdateStore.validHash(hash))return "{\"ok\":false,\"error\":\"نشانی یا اثر انگشت فایل معتبر نیست.\"}";
    if(Build.VERSION.SDK_INT<29&&activity.checkSelfPermission(android.Manifest.permission.WRITE_EXTERNAL_STORAGE)!=PackageManager.PERMISSION_GRANTED){pendingUrl=url;pendingHash=hash;activity.runOnUiThread(()->activity.requestPermissions(new String[]{android.Manifest.permission.WRITE_EXTERNAL_STORAGE},21));return "{\"ok\":false,\"permissionPending\":true,\"error\":\"مجوز ذخیرهٔ فایل را در پیام گوشی تأیید کنید.\"}";}
    return UpdateStore.start(activity,url,hash);
  }
  String status(){return UpdateStore.status(activity);}
  void onRequestPermissionsResult(int request,int[] results){
    if(request!=21)return;
    if(results.length>0&&results[0]==PackageManager.PERMISSION_GRANTED&&pendingUrl!=null)activity.callback("onNativeDownload",UpdateStore.start(activity,pendingUrl,pendingHash));
    else activity.callback("onNativeDownload","{\"ok\":false,\"error\":\"مجوز ذخیرهٔ فایل داده نشد.\"}");
    pendingUrl=null;pendingHash=null;
  }
  void onActivityResult(int request,int result,Intent data){
    if(request!=31||!pendingInstall)return;
    pendingInstall=false;
    if(activity.getPackageManager().canRequestPackageInstalls())install();
    else activity.callback("onNativeInstall","{\"ok\":false,\"error\":\"اجازهٔ نصب داده نشد. فایل APK همچنان در دانلودها موجود است.\"}");
  }
  void install(){
    if(installBusy)return;installBusy=true;final int startedGeneration=generation;
    new Thread(()->{
      try{
        Uri uri=UpdateStore.verifiedUri(activity);
        activity.runOnUiThread(()->{
          installBusy=false;if(startedGeneration!=generation||activity.isFinishing()||activity.isDestroyed())return;
          try{
            if(!activity.getPackageManager().canRequestPackageInstalls()){
              pendingInstall=true;
              activity.startActivityForResult(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,Uri.parse("package:"+activity.getPackageName())),31);
              activity.callback("onNativeInstall","{\"ok\":false,\"permissionPending\":true,\"message\":\"برای نصب به‌روزرسانی، اجازهٔ نصب از این برنامه را در تنظیمات گوشی تأیید کنید.\"}");
              return;
            }
            Intent installer=new Intent(Intent.ACTION_VIEW).setDataAndType(uri,"application/vnd.android.package-archive").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            installer.setClipData(ClipData.newRawUri("verified-update",uri));
            activity.startActivity(installer);
            activity.callback("onNativeInstall","{\"ok\":true,\"installerOpened\":true,\"message\":\"صفحهٔ نصب اندروید باز شد؛ نصب را در گوشی تأیید کنید.\"}");
          }catch(Exception e){pendingInstall=false;activity.callback("onNativeInstall","{\"ok\":false,\"error\":\"نصب‌کننده باز نشد؛ فایل APK را از پوشهٔ دانلودها باز کنید.\"}");}
        });
      }catch(Exception e){activity.runOnUiThread(()->{installBusy=false;if(startedGeneration==generation)activity.callback("onNativeInstall","{\"ok\":false,\"error\":\"فایل نصب موجود یا معتبر نیست؛ دوباره دانلود کنید.\"}");});}
    },"zaman-open-installer").start();
  }
  void clear()throws IOException{generation++;pendingInstall=false;pendingUrl=null;pendingHash=null;UpdateStore.clear(activity);}
}
