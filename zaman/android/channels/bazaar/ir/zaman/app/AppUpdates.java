package ir.zaman.app;

import android.content.*;
import android.net.Uri;
import java.io.IOException;

/** Bazaar owns downloading and installing updates; this variant has no APK installer. */
final class AppUpdates {
  final MainActivity activity;
  static final String STORE_URL="https://cafebazaar.ir/app/ir.zaman.app";
  static final String STORE_URI="bazaar://details?id=ir.zaman.app";
  AppUpdates(MainActivity activity){this.activity=activity;}
  String channel(){return "bazaar";}
  String openStore(){
    activity.runOnUiThread(()->{
      try{activity.startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(STORE_URI)).setPackage("com.farsitel.bazaar"));}
      catch(ActivityNotFoundException e){
        try{activity.startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(STORE_URL)));}
        catch(ActivityNotFoundException ignored){activity.toast("بازار را باز کنید و مدیریت زمان علی میرزا را جست‌وجو کنید.");}
      }
    });
    return "{\"ok\":true,\"scheduled\":true}";
  }
  void check(){activity.callback("onNativeUpdate","{\"ok\":true,\"channel\":\"bazaar\"}");}
  String download(String url,String hash){return "{\"ok\":false,\"error\":\"به‌روزرسانی این نسخه از بازار انجام می‌شود.\"}";}
  String status(){return "{\"status\":\"idle\"}";}
  void install(){openStore();}
  void onActivityResult(int request,int result,Intent data){}
  void onRequestPermissionsResult(int request,int[] results){}
  void clear()throws IOException{
    // Discard only old direct-update metadata when migrating; user data stays untouched.
    if(!activity.getSharedPreferences("zaman-updates",0).edit().clear().commit())throw new IOException("update settings were not cleared");
  }
}
