package ir.racking.app;

import android.app.*;
import android.content.*;
import org.json.*;

final class MobileAlarms {
  static PendingIntent pending(Context c, int id, String label, boolean wake) {
    return PendingIntent.getBroadcast(
        c,
        id,
        new Intent(c, AlarmReceiver.class)
            .setAction("mobile-alarm")
            .putExtra("label", label)
            .putExtra("wake", wake),
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }

  static synchronized void sync(Context c, JSONObject data) throws JSONException {
    android.content.SharedPreferences prefs = c.getSharedPreferences("mobile-alarms", 0);
    JSONArray alarms = data.getJSONArray("alarms");
    String serialized = alarms.toString();
    if (!serialized.equals(prefs.getString("scheduled", ""))
        || prefs.getBoolean("exact", false) != Alarms.exact(c)) {
      cancel(c, prefs.getString("scheduled", "[]"));
      prefs.edit().putString("scheduled", serialized).putBoolean("exact", Alarms.exact(c)).apply();
      schedule(c, alarms);
    }
    NotificationManager nm = c.getSystemService(NotificationManager.class);
    NotificationChannel channel =
        new NotificationChannel("mobile-timer", "فعالیت جاری", NotificationManager.IMPORTANCE_LOW);
    channel.setSound(null, null);
    nm.createNotificationChannel(channel);
    JSONObject active = data.optJSONObject("active");
    if (active == null) {
      nm.cancel(200);
      return;
    }
    PendingIntent open =
        PendingIntent.getActivity(
            c,
            201,
            new Intent(c, MobileActivity.class),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    Notification.Builder builder =
        new Notification.Builder(c, "mobile-timer")
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(active.optString("name"))
            .setContentText("برای وقفه، ادامه یا پایان لمس کن")
            .setContentIntent(open)
            .setOngoing(true)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true);
    long end = active.optLong("deadline");
    if (end > System.currentTimeMillis())
      builder.setWhen(end).setUsesChronometer(true).setChronometerCountDown(true);
    for (String action : new String[] {"pause", "interrupt", "resume"}) {
      String label =
          action.equals("pause") ? "توقف" : action.equals("interrupt") ? "وقفه" : "برگشت";
      PendingIntent intent =
          PendingIntent.getActivity(
              c,
              action.hashCode(),
              new Intent(c, MobileActivity.class).putExtra("mobileAction", action),
              PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
      builder.addAction(new Notification.Action.Builder(null, label, intent).build());
    }
    try {
      nm.notify(200, builder.build());
    } catch (SecurityException ignored) {
    }
  }

  static void cancel(Context c, String raw) {
    try {
      JSONArray list = new JSONArray(raw);
      for (int n = 0; n < list.length(); n++)
        Alarms.manager(c).cancel(pending(c, list.getJSONObject(n).getInt("id"), "", false));
    } catch (JSONException ignored) {
    }
  }

  static void schedule(Context c, JSONArray list) throws JSONException {
    if (!Alarms.exact(c)) return;
    long now = System.currentTimeMillis();
    boolean wakeScheduled = false;
    int count = 0;
    for (int n = 0; n < list.length(); n++) {
      JSONObject a = list.getJSONObject(n);
      if (a.optLong("at") <= now) continue;
      if (a.optBoolean("wake")) {
        if (wakeScheduled) continue;
        wakeScheduled = true;
      }
      if (count++ >= 450) break;
      PendingIntent show =
          PendingIntent.getActivity(
              c,
              a.getInt("id"),
              new Intent(c, MobileActivity.class),
              PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
      Alarms.manager(c)
          .setAlarmClock(
              new AlarmManager.AlarmClockInfo(a.getLong("at"), show),
              pending(c, a.getInt("id"), a.getString("label"), a.optBoolean("wake")));
    }
  }

  static void restore(Context c) {
    try {
      schedule(
          c,
          new JSONArray(c.getSharedPreferences("mobile-alarms", 0).getString("scheduled", "[]")));
    } catch (JSONException ignored) {
    }
  }
}
