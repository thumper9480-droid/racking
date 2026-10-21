package ir.zaman.app;

import android.app.*;
import android.content.*;
import android.net.Uri;
import android.os.Build;
import org.json.*;
import java.util.*;

final class AlarmStore {
  static android.content.SharedPreferences prefs(Context c) { return c.getSharedPreferences("zaman-alarms",0); }
  static AlarmManager manager(Context c) { return c.getSystemService(AlarmManager.class); }
  static boolean exact(Context c) { return Build.VERSION.SDK_INT<31 || manager(c).canScheduleExactAlarms(); }
  static PendingIntent pending(Context c,String id) {
    return PendingIntent.getBroadcast(c,0,new Intent(c,AlarmReceiver.class).setAction("ir.zaman.ALARM").setData(Uri.parse("zaman://alarm/"+Uri.encode(id))).putExtra("id",id),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
  }
  static JSONArray read(Context c) {
    try { return new JSONArray(prefs(c).getString("alarms","[]")); } catch(JSONException e) { return new JSONArray(); }
  }
  static long next(long at,String repeat,long now) {
    Calendar cal=Calendar.getInstance();cal.setTimeInMillis(at);
    do { cal.add(Calendar.DAY_OF_MONTH,"weekly".equals(repeat)?7:1); } while(cal.getTimeInMillis()<=now);
    return cal.getTimeInMillis();
  }
  static synchronized void sync(Context c,String raw) throws JSONException {
    JSONObject data=new JSONObject(raw);JSONArray list=data.getJSONArray("alarms"),next=new JSONArray();
    for(int i=0;i<list.length();i++) { JSONObject a=list.getJSONObject(i);if(a.optBoolean("enabled"))next.put(new JSONObject(a.toString())); }
    JSONObject timer=data.getJSONObject("countdown");long end=timer.optLong("end",0);
    if(end>0)next.put(new JSONObject().put("id","countdown").put("title","تایمر معکوس تمام شد").put("at",end).put("repeat","none"));
    for(int i=0;i<read(c).length();i++)manager(c).cancel(pending(c,read(c).getJSONObject(i).getString("id")));
    prefs(c).edit().putString("alarms",next.toString()).commit(); restore(c);
  }
  static synchronized void clear(Context c) throws JSONException,java.io.IOException {
    JSONArray alarms=read(c);
    for(int i=0;i<alarms.length();i++){
      JSONObject alarm=alarms.optJSONObject(i);if(alarm==null||alarm.optString("id","").isEmpty())continue;
      PendingIntent intent=pending(c,alarm.optString("id"));
      manager(c).cancel(intent);intent.cancel();
    }
    PendingIntent countdown=pending(c,"countdown");manager(c).cancel(countdown);countdown.cancel();
    if(Build.VERSION.SDK_INT>=34)manager(c).cancelAll();
    if(!prefs(c).edit().clear().commit())throw new java.io.IOException("alarm settings were not cleared");
  }
  static synchronized void restore(Context c) {
    JSONArray old=read(c),kept=new JSONArray();long now=System.currentTimeMillis();
    for(int i=0;i<old.length();i++)try {
      JSONObject a=old.getJSONObject(i);String id=a.getString("id");long at=a.getLong("at"),fired=prefs(c).getLong("fired:"+id,0);
      if(at<=fired) { if("none".equals(a.optString("repeat","none")))continue;at=next(at,a.optString("repeat"),now);a.put("at",at); }
      kept.put(a);long trigger=Math.max(now+1000,at);
      if(exact(c))manager(c).setAlarmClock(new AlarmManager.AlarmClockInfo(trigger,PendingIntent.getActivity(c,0,new Intent(c,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT)),pending(c,id));
      else manager(c).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,trigger,pending(c,id));
    } catch(Exception ignored) { }
    prefs(c).edit().putString("alarms",kept.toString()).commit();
  }
  static synchronized JSONObject fire(Context c,String id) {
    JSONArray old=read(c),kept=new JSONArray();JSONObject fired=null;long now=System.currentTimeMillis();
    for(int i=0;i<old.length();i++)try {
      JSONObject a=old.getJSONObject(i);
      if(!id.equals(a.getString("id"))) {kept.put(a);continue;}
      long at=a.getLong("at");
      // Ignore a stale broadcast after a timer was edited or reset.
      if(at>now+1000 || at<=prefs(c).getLong("fired:"+id,0)) {kept.put(a);continue;}
      fired=new JSONObject(a.toString());prefs(c).edit().putLong("fired:"+id,at).commit();
      if(!"none".equals(a.optString("repeat","none"))) {a.put("at",next(at,a.optString("repeat"),now));kept.put(a);}
    } catch(JSONException ignored) { }
    prefs(c).edit().putString("alarms",kept.toString()).commit();restore(c);return fired;
  }
}
