package ir.zaman.app;

import android.content.*;
import android.media.*;
import android.net.Uri;
import org.json.*;

final class SoundSettings {
  static final String SILENT="silent";
  static boolean validKind(String kind){return "countdown".equals(kind)||"reminder".equals(kind);}
  static android.content.SharedPreferences prefs(Context c){return c.getSharedPreferences("zaman-sounds",0);}
  static Uri selected(Context c,String kind){String value=prefs(c).getString(kind,null);if(SILENT.equals(value))return null;return value==null?RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM):Uri.parse(value);}
  static void save(Context c,String kind,Uri uri){if(!validKind(kind))return;prefs(c).edit().putString(kind,uri==null?SILENT:uri.toString()).apply();}
  static String title(Context c,String kind){
    if(SILENT.equals(prefs(c).getString(kind,null)))return "بی‌صدا";
    Uri uri=selected(c,kind);try{Ringtone tone=RingtoneManager.getRingtone(c,uri);if(tone!=null)return tone.getTitle(c);}catch(Exception ignored){}
    return "صدای پیش‌فرض گوشی";
  }
  static String status(Context c){JSONObject out=new JSONObject();for(String kind:new String[]{"countdown","reminder"})try{out.put(kind,new JSONObject().put("title",title(c,kind)).put("silent",SILENT.equals(prefs(c).getString(kind,null))));}catch(JSONException ignored){}return out.toString();}
}
