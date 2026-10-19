package ir.racking.app;

import android.app.*;
import android.content.*;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import java.util.Calendar;

final class Alarms {
  static AlarmManager manager(Context c) {
    return (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
  }

  static boolean exact(Context c) {
    return Build.VERSION.SDK_INT < 31 || manager(c).canScheduleExactAlarms();
  }

  static void requestExact(Activity c) {
    if (Build.VERSION.SDK_INT >= 31)
      c.startActivity(
          new Intent(
              Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
              Uri.parse("package:" + c.getPackageName())));
  }

  static PendingIntent event(Context c, int code, String kind) {
    return PendingIntent.getBroadcast(
        c,
        code,
        new Intent(c, AlarmReceiver.class).setAction(kind),
        PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
  }

  static void at(Context c, int code, String kind, long time) {
    if (!exact(c)) return;
    PendingIntent show =
        PendingIntent.getActivity(
            c,
            code,
            new Intent(c, MainActivity.class),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    manager(c).setAlarmClock(new AlarmManager.AlarmClockInfo(time, show), event(c, code, kind));
  }

  static void scheduleWake(Context c) {
    Store s = new Store(c);
    if (!s.data.optBoolean("alarmEnabled")) return;
    String[] hh = s.data.optString("wake", "07:00").split(":");
    Calendar cal = Calendar.getInstance();
    cal.set(Calendar.HOUR_OF_DAY, Integer.parseInt(hh[0]));
    cal.set(Calendar.MINUTE, Integer.parseInt(hh[1]));
    cal.set(Calendar.SECOND, 0);
    cal.set(Calendar.MILLISECOND, 0);
    if (cal.getTimeInMillis() <= System.currentTimeMillis()) cal.add(Calendar.DATE, 1);
    at(c, 1, "wake", cal.getTimeInMillis());
  }

  static void cancelWake(Context c) {
    manager(c).cancel(event(c, 1, "wake"));
    manager(c).cancel(event(c, 3, "snooze"));
  }

  static void session(Context c, long at) {
    at(c, 2, "session", at);
  }

  static void cancelSession(Context c) {
    manager(c).cancel(event(c, 2, "session"));
  }

  static void test(Context c) {
    at(c, 4, "test", System.currentTimeMillis() + 10000);
  }
}
