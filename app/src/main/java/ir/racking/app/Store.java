package ir.racking.app;

import android.content.Context;
import android.util.AtomicFile;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.*;
import org.json.*;

final class Store {
  static final String[] NAMES = {
    "پیاده‌روی / ورزش",
    "کتاب",
    "پلتفرم",
    "مطالعه تکنیکال",
    "تحلیل چارت",
    "استراحت",
    "خارج از برنامه"
  };
  final Context context;
  JSONObject data;

  Store(Context c) {
    context = c.getApplicationContext();
    try (FileInputStream in = file().openRead()) {
      data = new JSONObject(new String(read(in, 16 * 1024 * 1024), StandardCharsets.UTF_8));
    } catch (FileNotFoundException e) {
      data = fresh();
    } catch (Exception e) {
      throw new IllegalStateException(
          "خواندن داده‌ها ناموفق بود؛ برای جلوگیری از حذف اطلاعات ذخیره‌سازی متوقف شد.", e);
    }
  }

  static byte[] read(InputStream in, int limit) throws IOException {
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    byte[] b = new byte[8192];
    int n;
    while ((n = in.read(b, 0, Math.min(b.length, limit - out.size()))) > 0) {
      out.write(b, 0, n);
      if (out.size() >= limit) break;
    }
    return out.toByteArray();
  }

  AtomicFile file() {
    return new AtomicFile(new File(context.getFilesDir(), "racking.json"));
  }

  static JSONObject fresh() {
    JSONObject d = new JSONObject();
    try {
      d.put("version", 1);
      d.put("entries", new JSONArray());
      d.put("tasks", new JSONArray());
      d.put(
          "projects",
          new JSONArray(
              Arrays.asList(
                  "خانه بالا", "خانه پایین", "پشت‌بام", "دفتر", "پروژه‌های حاشیه‌ای", "خرید")));
      d.put("goals", new JSONObject());
      d.put("wake", "07:00");
      d.put("alarmEnabled", false);
      d.put("workMinutes", 5);
      d.put("breakMinutes", 10);
      d.put("rounds", 3);
      int[] goals = {20, 30, 15, 15, 35, 0, 0};
      for (int i = 0; i < NAMES.length; i++) d.getJSONObject("goals").put(NAMES[i], goals[i]);
    } catch (JSONException e) {
      throw new RuntimeException(e);
    }
    return d;
  }

  synchronized void save() {
    FileOutputStream out = null;
    try {
      out = file().startWrite();
      out.write(data.toString(2).getBytes(StandardCharsets.UTF_8));
      file().finishWrite(out);
    } catch (Exception e) {
      if (out != null) file().failWrite(out);
      throw new IllegalStateException("ذخیره ناموفق بود", e);
    }
  }

  void put(String k, Object v) {
    try {
      data.put(k, v);
      save();
    } catch (JSONException e) {
      throw new RuntimeException(e);
    }
  }

  JSONArray array(String k) {
    return data.optJSONArray(k);
  }

  static String day(long time) {
    return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date(time));
  }

  long seconds(String category, String day) {
    long n = 0;
    JSONArray a = array("entries");
    for (int i = 0; i < a.length(); i++) {
      JSONObject e = a.optJSONObject(i);
      if (e != null
          && e.optString("day").equals(day)
          && (category == null
              ? !e.optString("category").equals("استراحت")
              : e.optString("category").equals(category))) n += e.optLong("seconds");
    }
    return n;
  }

  void entry(String category, long start, long end, String note) {
    if (end <= start) return;
    try {
      long cursor = start;
      while (cursor < end) {
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(cursor);
        c.add(Calendar.DAY_OF_MONTH, 1);
        c.set(Calendar.HOUR_OF_DAY, 0);
        c.set(Calendar.MINUTE, 0);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        long stop = Math.min(end, c.getTimeInMillis());
        array("entries")
            .put(
                new JSONObject()
                    .put("id", UUID.randomUUID().toString())
                    .put("category", category)
                    .put("start", cursor)
                    .put("end", stop)
                    .put("seconds", (stop - cursor) / 1000)
                    .put("day", day(cursor))
                    .put("note", note));
        cursor = stop;
      }
      save();
    } catch (JSONException e) {
      throw new RuntimeException(e);
    }
  }

  static void validate(JSONObject d) throws JSONException {
    if (d.getInt("version") != 1) throw new JSONException("نسخه پشتیبان پشتیبانی نمی‌شود");
    JSONArray entries = d.getJSONArray("entries"),
        tasks = d.getJSONArray("tasks"),
        projects = d.getJSONArray("projects");
    JSONObject goals = d.getJSONObject("goals");
    if (entries.length() > 100000 || tasks.length() > 100000 || projects.length() > 10000)
      throw new JSONException("فایل بیش از حد بزرگ است");
    for (int i = 0; i < entries.length(); i++) {
      JSONObject e = entries.getJSONObject(i);
      long s = e.getLong("start"), end = e.getLong("end");
      e.getString("id");
      e.getString("category");
      e.getString("note");
      if (s < 0
          || end <= s
          || e.getLong("seconds") != (end - s) / 1000
          || !e.getString("day").matches("\\d{4}-\\d{2}-\\d{2}"))
        throw new JSONException("بازه نامعتبر");
    }
    for (int i = 0; i < tasks.length(); i++) {
      JSONObject t = tasks.getJSONObject(i);
      t.getString("id");
      t.getString("title");
      t.getString("project");
      t.getString("tags");
      t.getBoolean("done");
    }
    for (int i = 0; i < projects.length(); i++) projects.getString(i);
    for (String n : NAMES)
      if (goals.getInt(n) < 0 || goals.getInt(n) > 1440) throw new JSONException("هدف نامعتبر");
    if (!d.getString("wake").matches("([01][0-9]|2[0-3]):[0-5][0-9]"))
      throw new JSONException("ساعت نامعتبر");
    for (String k : new String[] {"workMinutes", "breakMinutes", "rounds"})
      if (d.getInt(k) < 1 || d.getInt(k) > 180) throw new JSONException("تنظیم جلسه نامعتبر");
    d.getBoolean("alarmEnabled");
    // Running processes are never restored from another device.
    d.remove("active");
    d.remove("session");
    d.put("alarmEnabled", false);
  }

  String csv() {
    StringBuilder b = new StringBuilder("\uFEFFdate,category,start,end,minutes,note\r\n");
    JSONArray a = array("entries");
    for (int i = 0; i < a.length(); i++) {
      JSONObject e = a.optJSONObject(i);
      b.append(q(e.optString("day")))
          .append(',')
          .append(q(e.optString("category")))
          .append(',')
          .append(q(new Date(e.optLong("start")).toString()))
          .append(',')
          .append(q(new Date(e.optLong("end")).toString()))
          .append(',')
          .append(String.format(Locale.US, "%.2f", e.optLong("seconds") / 60.0))
          .append(',')
          .append(q(e.optString("note")))
          .append("\r\n");
    }
    return b.toString();
  }

  static String q(String s) {
    if (s.matches("^[=+@\\-\\t\\r].*")) s = "'" + s;
    return "\"" + s.replace("\"", "\"\"") + "\"";
  }
}
