package ir.racking.app;

import android.content.*;
import org.json.*;

public class AlarmReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context c, Intent i) {
    String action = i.getAction();
    if ("mobile-alarm".equals(action)) {
      MobileAlarms.restore(c);
      c.startForegroundService(
          new Intent(c, AlarmService.class)
              .putExtra("wake", i.getBooleanExtra("wake", false))
              .putExtra("label", i.getStringExtra("label")));
      return;
    }
    MobileAlarms.restore(c);
    Store s = new Store(c);
    if (Intent.ACTION_BOOT_COMPLETED.equals(action)
        || Intent.ACTION_MY_PACKAGE_REPLACED.equals(action)
        || "android.app.action.SCHEDULE_EXACT_ALARM_PERMISSION_STATE_CHANGED".equals(action)) {
      Alarms.scheduleWake(c);
      JSONObject session = s.data.optJSONObject("session");
      if (session != null)
        Alarms.session(c, Math.max(System.currentTimeMillis() + 1000, session.optLong("end")));
      return;
    }
    boolean wake = "wake".equals(action) || "snooze".equals(action) || "test".equals(action);
    if ("wake".equals(action)) Alarms.scheduleWake(c);
    String label = "وقت بیدارشدن است";
    if ("session".equals(action)) {
      JSONObject session = s.data.optJSONObject("session"), active = s.data.optJSONObject("active");
      if (session == null || active == null) return;
      long end = session.optLong("end");
      s.entry(active.optString("category"), active.optLong("start"), end, "جلسه تمرکز");
      s.put("active", null);
      try {
        boolean rest = session.optBoolean("break");
        int round = session.optInt("round"), rounds = session.optInt("rounds");
        if (!rest && round >= rounds) {
          s.put("session", null);
          label = "جلسهٔ تمرکز تمام شد";
        } else {
          if (rest) round++;
          rest = !rest;
          long now = System.currentTimeMillis();
          long next = now + session.optInt(rest ? "rest" : "work") * 60000L;
          session.put("round", round).put("break", rest).put("end", next);
          s.put("session", session);
          s.put(
              "active",
              new JSONObject()
                  .put("category", rest ? "استراحت" : session.optString("category"))
                  .put("start", now)
                  .put("note", "جلسه تمرکز"));
          Alarms.session(c, next);
          label = rest ? "وقت استراحت است" : "دور بعدی کار شروع شد";
        }
      } catch (JSONException e) {
        throw new RuntimeException(e);
      }
    }
    c.startForegroundService(
        new Intent(c, AlarmService.class).putExtra("wake", wake).putExtra("label", label));
  }
}
