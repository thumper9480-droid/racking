package ir.racking.app;

import android.app.*;
import android.content.*;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.*;
import android.text.InputType;
import android.view.*;
import android.widget.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.json.*;

public class MainActivity extends Activity {
  static final int TEAL = 0xff087f73, INK = 0xff173d3a, MUTED = 0xff6d817d, BG = 0xfff3f7f5;
  Store store;
  LinearLayout root, body;
  int tab = 0, period = 1;
  String filter = "";
  final Handler handler = new Handler();
  TextView clock;
  String pendingExport;
  final Runnable ticker =
      new Runnable() {
        public void run() {
          JSONObject session = store.data.optJSONObject("session");
          if (session != null && System.currentTimeMillis() > session.optLong("end") + 1000) {
            store = new Store(MainActivity.this);
            render();
          } else if (clock != null) updateClock();
          handler.postDelayed(this, 1000);
        }
      };

  @Override
  public void onCreate(Bundle b) {
    super.onCreate(b);
    store = new Store(this);
    getWindow().setStatusBarColor(BG);
    getWindow().setNavigationBarColor(BG);
    render();
  }

  @Override
  public void onResume() {
    super.onResume();
    store = new Store(this);
    handler.removeCallbacks(ticker);
    handler.post(ticker);
    render();
  }

  @Override
  public void onPause() {
    handler.removeCallbacks(ticker);
    super.onPause();
  }

  int dp(float n) {
    return (int) (getResources().getDisplayMetrics().density * n + .5f);
  }

  GradientDrawable shape(int color, int radius) {
    GradientDrawable g = new GradientDrawable();
    g.setColor(color);
    g.setCornerRadius(dp(radius));
    return g;
  }

  LinearLayout col() {
    LinearLayout l = new LinearLayout(this);
    l.setOrientation(LinearLayout.VERTICAL);
    return l;
  }

  TextView text(String s, int size, int color) {
    TextView t = new TextView(this);
    t.setText(s);
    t.setTextSize(size);
    t.setTextColor(color);
    t.setPadding(0, dp(5), 0, dp(5));
    return t;
  }

  void heading(LinearLayout l, String s) {
    TextView t = text(s, 23, INK);
    t.setTypeface(null, Typeface.BOLD);
    l.addView(t);
  }

  void sub(LinearLayout l, String s) {
    l.addView(text(s, 13, MUTED));
  }

  Button button(LinearLayout l, String s, Runnable r) {
    Button b = new Button(this);
    b.setText(s);
    b.setTextColor(TEAL);
    b.setTextSize(14);
    b.setAllCaps(false);
    b.setOnClickListener(
        v -> {
          try {
            r.run();
          } catch (Exception e) {
            error(e);
          }
        });
    l.addView(b, new LinearLayout.LayoutParams(-1, dp(50)));
    return b;
  }

  LinearLayout card() {
    LinearLayout c = col();
    c.setPadding(dp(16), dp(12), dp(16), dp(12));
    c.setBackground(shape(Color.WHITE, 18));
    LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(-1, -2);
    p.setMargins(0, dp(7), 0, dp(7));
    body.addView(c, p);
    return c;
  }

  String fa(String s) {
    return s.replace('0', '۰')
        .replace('1', '۱')
        .replace('2', '۲')
        .replace('3', '۳')
        .replace('4', '۴')
        .replace('5', '۵')
        .replace('6', '۶')
        .replace('7', '۷')
        .replace('8', '۸')
        .replace('9', '۹');
  }

  String duration(long sec) {
    return fa(String.format(Locale.US, "%02d:%02d:%02d", sec / 3600, (sec / 60) % 60, sec % 60));
  }

  String date() {
    android.icu.util.Calendar p =
        android.icu.util.Calendar.getInstance(
            new android.icu.util.ULocale("fa_IR@calendar=persian"));
    String[] months = {
      "فروردین",
      "اردیبهشت",
      "خرداد",
      "تیر",
      "مرداد",
      "شهریور",
      "مهر",
      "آبان",
      "آذر",
      "دی",
      "بهمن",
      "اسفند"
    };
    return fa(
        p.get(android.icu.util.Calendar.DATE)
            + " "
            + months[p.get(android.icu.util.Calendar.MONTH)]
            + " "
            + p.get(android.icu.util.Calendar.YEAR));
  }

  void render() {
    clock = null;
    root = col();
    root.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
    root.setBackgroundColor(BG);
    root.setPadding(dp(16), dp(10), dp(16), 0);
    root.setOnApplyWindowInsetsListener(
        (v, insets) -> {
          v.setPadding(
              dp(16) + insets.getSystemWindowInsetLeft(),
              dp(10) + insets.getSystemWindowInsetTop(),
              dp(16) + insets.getSystemWindowInsetRight(),
              insets.getSystemWindowInsetBottom());
          return insets;
        });
    TextView brand = text("روال   /   فضای شخصی تو", 16, TEAL);
    brand.setTypeface(null, Typeface.BOLD);
    root.addView(brand);
    ScrollView scroll = new ScrollView(this);
    body = col();
    body.setPadding(0, 0, 0, dp(20));
    scroll.setFillViewport(true);
    scroll.addView(body);
    root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
    LinearLayout nav = new LinearLayout(this);
    String[] labels = {"امروز", "پروژه‌ها", "گزارش‌ها", "تنظیمات"};
    for (int i = 0; i < 4; i++) {
      final int n = i;
      Button b = new Button(this);
      b.setText(labels[i]);
      b.setTextSize(12);
      b.setTextColor(tab == i ? TEAL : MUTED);
      b.setOnClickListener(
          v -> {
            tab = n;
            render();
          });
      nav.addView(b, new LinearLayout.LayoutParams(0, dp(56), 1));
    }
    root.addView(nav);
    setContentView(root);
    if (tab == 0) today();
    else if (tab == 1) projects();
    else if (tab == 2) reports();
    else settings();
  }

  void today() {
    heading(body, "امروز، قدم‌به‌قدم");
    sub(body, date());
    LinearLayout summary = card();
    sub(summary, "زمان مفید ثبت‌شدهٔ امروز");
    TextView total =
        text(duration(store.seconds(null, Store.day(System.currentTimeMillis()))), 36, TEAL);
    total.setTypeface(null, Typeface.BOLD);
    summary.addView(total);
    JSONObject active = store.data.optJSONObject("active");
    if (active != null) {
      LinearLayout c = card();
      heading(c, active.optString("category"));
      clock = text("", 32, TEAL);
      c.addView(clock);
      updateClock();
      button(c, "پایان و ثبت فعالیت", () -> stopActive(true));
      button(c, "تغییر فعالیت", () -> chooseActivity());
    } else {
      LinearLayout c = card();
      heading(c, "الان چه کار می‌کنی؟");
      button(c, "شروع فعالیت", this::chooseActivity);
      button(c, "ثبت از آخرین فعالیت تا الان", this::sinceLast);
    }
    JSONObject session = store.data.optJSONObject("session");
    if (session != null) {
      LinearLayout c = card();
      heading(c, "جلسهٔ تمرکز • " + session.optString("category"));
      sub(
          c,
          "دور "
              + fa("" + session.optInt("round"))
              + " از "
              + fa("" + session.optInt("rounds"))
              + " • "
              + (session.optBoolean("break") ? "استراحت" : "کار"));
      button(
          c,
          "پایان جلسه و ثبت زمان",
          () -> {
            stopActive(false);
            store.put("session", null);
            Alarms.cancelSession(this);
            render();
          });
    } else button(body, "جلسهٔ کار و استراحت", this::focusDialog);
    heading(body, "هدف‌های امروز");
    for (int i = 0; i < 5; i++) {
      String name = Store.NAMES[i];
      int goal = store.data.optJSONObject("goals").optInt(name);
      long seconds = store.seconds(name, Store.day(System.currentTimeMillis()));
      LinearLayout c = card();
      heading(c, name);
      sub(
          c,
          fa("" + (seconds / 60))
              + " دقیقه از "
              + fa("" + goal)
              + " دقیقه"
              + (i >= 2 ? " • تخصصی" : ""));
      ProgressBar bar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
      bar.setMax(Math.max(1, goal * 60));
      bar.setProgress((int) Math.min(Integer.MAX_VALUE, seconds));
      bar.setProgressTintList(android.content.res.ColorStateList.valueOf(TEAL));
      c.addView(bar);
      button(c, "شروع", () -> start(name));
    }
    heading(body, "خط زمانی امروز");
    JSONArray a = store.array("entries");
    boolean any = false;
    for (int i = a.length() - 1; i >= 0; i--) {
      JSONObject e = a.optJSONObject(i);
      if (!e.optString("day").equals(Store.day(System.currentTimeMillis()))) continue;
      any = true;
      LinearLayout c = card();
      sub(c, time(e.optLong("start")) + " ← " + time(e.optLong("end")));
      c.addView(text(e.optString("category") + " • " + duration(e.optLong("seconds")), 17, INK));
      if (!e.optString("note").isEmpty()) sub(c, e.optString("note"));
      final int index = i;
      button(
          c,
          "حذف ثبت اشتباه",
          () ->
              new AlertDialog.Builder(this)
                  .setMessage("این بازه حذف شود؟")
                  .setPositiveButton(
                      "حذف",
                      (d, w) -> {
                        a.remove(index);
                        store.save();
                        render();
                      })
                  .setNegativeButton("انصراف", null)
                  .show());
    }
    if (!any) sub(body, "هنوز زمانی ثبت نشده؛ اولین فعالیتت را شروع کن.");
  }

  String time(long t) {
    return fa(new java.text.SimpleDateFormat("HH:mm", Locale.US).format(new Date(t)));
  }

  void updateClock() {
    JSONObject a = store.data.optJSONObject("active");
    if (a != null && clock != null) {
      JSONObject session = store.data.optJSONObject("session");
      long now = System.currentTimeMillis();
      if (session != null)
        clock.setText(duration(Math.max(0, (session.optLong("end") - now) / 1000)) + " مانده");
      else clock.setText(duration(Math.max(0, (now - a.optLong("start")) / 1000)));
    }
  }

  void chooseActivity() {
    new AlertDialog.Builder(this)
        .setTitle("انتخاب فعالیت")
        .setItems(
            Store.NAMES,
            (d, n) -> {
              if (n == 6) {
                EditText e = input("اسم فعالیت", false);
                new AlertDialog.Builder(this)
                    .setTitle("خارج از برنامه")
                    .setView(e)
                    .setPositiveButton(
                        "شروع", (x, y) -> start("خارج از برنامه", e.getText().toString()))
                    .setNegativeButton("انصراف", null)
                    .show();
              } else start(Store.NAMES[n]);
            })
        .show();
  }

  void start(String name) {
    start(name, "");
  }

  void start(String name, String note) {
    try {
      stopActive(false);
      store.put("session", null);
      Alarms.cancelSession(this);
      store.put(
          "active",
          new JSONObject()
              .put("category", name)
              .put("start", System.currentTimeMillis())
              .put("note", note));
      render();
    } catch (Exception e) {
      error(e);
    }
  }

  void stopActive(boolean redraw) {
    JSONObject a = store.data.optJSONObject("active");
    if (a != null) {
      JSONObject s = store.data.optJSONObject("session");
      long end =
          s == null
              ? System.currentTimeMillis()
              : Math.min(System.currentTimeMillis(), s.optLong("end"));
      store.entry(a.optString("category"), a.optLong("start"), end, a.optString("note"));
      store.put("active", null);
    }
    if (redraw) {
      store.put("session", null);
      Alarms.cancelSession(this);
      render();
    }
  }

  void sinceLast() {
    if (store.data.has("active")) {
      toast("ابتدا فعالیت جاری را پایان بده");
      return;
    }
    long latest = 0;
    JSONArray a = store.array("entries");
    for (int i = 0; i < a.length(); i++)
      latest = Math.max(latest, a.optJSONObject(i).optLong("end"));
    latest = Math.max(latest, store.data.optLong("wakeAt"));
    Calendar c = Calendar.getInstance();
    c.set(Calendar.HOUR_OF_DAY, 0);
    c.set(Calendar.MINUTE, 0);
    c.set(Calendar.SECOND, 0);
    c.set(Calendar.MILLISECOND, 0);
    latest = Math.max(latest, c.getTimeInMillis());
    if (latest == c.getTimeInMillis() && !store.data.has("wakeAt")) {
      toast("برای اولین ثبت، یک فعالیت را شروع کن یا بیدارشدن را ثبت کن.");
      return;
    }
    final long from = latest, to = System.currentTimeMillis();
    new AlertDialog.Builder(this)
        .setTitle("ثبت " + duration((to - from) / 1000) + " تا همین الان")
        .setItems(
            Store.NAMES,
            (d, n) ->
                new AlertDialog.Builder(this)
                    .setMessage(
                        Store.NAMES[n] + " از " + time(from) + " تا " + time(to) + " ثبت شود؟")
                    .setPositiveButton(
                        "ثبت",
                        (x, y) -> {
                          store.entry(Store.NAMES[n], from, to, "");
                          render();
                        })
                    .setNegativeButton("انصراف", null)
                    .show())
        .show();
  }

  EditText input(String hint, boolean number) {
    EditText e = new EditText(this);
    e.setHint(hint);
    e.setTextSize(15);
    if (number) e.setInputType(InputType.TYPE_CLASS_NUMBER);
    return e;
  }

  void focusDialog() {
    LinearLayout l = col();
    l.setPadding(dp(20), 0, dp(20), 0);
    Spinner sp = new Spinner(this);
    sp.setAdapter(
        new ArrayAdapter<>(
            this, android.R.layout.simple_spinner_dropdown_item, Arrays.copyOf(Store.NAMES, 5)));
    l.addView(sp);
    EditText work = input("دقیقه کار", true),
        rest = input("دقیقه استراحت", true),
        rounds = input("تعداد دور", true);
    work.setText("" + store.data.optInt("workMinutes", 5));
    rest.setText("" + store.data.optInt("breakMinutes", 10));
    rounds.setText("" + store.data.optInt("rounds", 3));
    sub(l, "دقیقه کار / دقیقه استراحت / تعداد دور");
    l.addView(work);
    l.addView(rest);
    l.addView(rounds);
    AlertDialog d =
        new AlertDialog.Builder(this)
            .setTitle("جلسهٔ تمرکز")
            .setView(l)
            .setPositiveButton("شروع", null)
            .setNegativeButton("انصراف", null)
            .create();
    d.setOnShowListener(
        v ->
            d.getButton(-1)
                .setOnClickListener(
                    w -> {
                      try {
                        int wm = positive(work), rm = positive(rest), rn = positive(rounds);
                        if (!Alarms.exact(this)) {
                          toast("برای ادامه، دسترسی زنگ دقیق را فعال کن");
                          Alarms.requestExact(this);
                          return;
                        }
                        stopActive(false);
                        long now = System.currentTimeMillis();
                        store.put("workMinutes", wm);
                        store.put("breakMinutes", rm);
                        store.put("rounds", rn);
                        String name = sp.getSelectedItem().toString();
                        store.put(
                            "session",
                            new JSONObject()
                                .put("category", name)
                                .put("work", wm)
                                .put("rest", rm)
                                .put("rounds", rn)
                                .put("round", 1)
                                .put("break", false)
                                .put("end", now + wm * 60000L));
                        store.put(
                            "active",
                            new JSONObject()
                                .put("category", name)
                                .put("start", now)
                                .put("note", "جلسه تمرکز"));
                        Alarms.session(this, now + wm * 60000L);
                        d.dismiss();
                        render();
                      } catch (Exception e) {
                        toast("مقدار هر فیلد باید بین ۱ تا ۱۸۰ باشد");
                      }
                    }));
    d.show();
  }

  int positive(EditText e) {
    int n = Integer.parseInt(e.getText().toString());
    if (n < 1 || n > 180) throw new IllegalArgumentException();
    return n;
  }

  void projects() {
    heading(body, "پروژه‌ها و کارها");
    sub(body, "کارهای خانه، دفتر، شهر و ایده‌های تازه");
    button(body, "＋ کار یا ایدهٔ جدید", this::addTask);
    button(
        body,
        "＋ پروژهٔ جدید",
        () -> {
          EditText e = input("نام پروژه", false);
          new AlertDialog.Builder(this)
              .setTitle("پروژهٔ جدید")
              .setView(e)
              .setPositiveButton(
                  "افزودن",
                  (d, w) -> {
                    String n = e.getText().toString().trim();
                    if (!n.isEmpty()) {
                      JSONArray p = store.array("projects");
                      for (int i = 0; i < p.length(); i++)
                        if (n.equals(p.optString(i))) {
                          toast("این پروژه وجود دارد");
                          return;
                        }
                      p.put(n);
                      store.save();
                      render();
                    }
                  })
              .setNegativeButton("انصراف", null)
              .show();
        });
    EditText search = input("فیلتر با نام، پروژه یا شهر…", false);
    search.setText(filter);
    body.addView(search);
    button(
        body,
        "اعمال فیلتر",
        () -> {
          filter = search.getText().toString().trim();
          render();
        });
    JSONArray projects = store.array("projects"), tasks = store.array("tasks");
    for (int i = 0; i < projects.length(); i++) {
      String p = projects.optString(i);
      LinearLayout c = card();
      heading(c, p);
      int count = 0, done = 0;
      for (int j = 0; j < tasks.length(); j++) {
        JSONObject t = tasks.optJSONObject(j);
        if (!p.equals(t.optString("project"))) continue;
        if (!(p + " " + t.optString("title") + " " + t.optString("tags")).contains(filter))
          continue;
        count++;
        if (t.optBoolean("done")) done++;
        CheckBox check = new CheckBox(this);
        check.setText(
            t.optString("title")
                + (t.optString("tags").isEmpty() ? "" : "\n" + t.optString("tags")));
        check.setTextColor(INK);
        check.setChecked(t.optBoolean("done"));
        check.setOnCheckedChangeListener(
            (b, on) -> {
              try {
                t.put("done", on);
                store.save();
              } catch (Exception e) {
                error(e);
              }
            });
        c.addView(check);
        check.setOnLongClickListener(
            v -> {
              new AlertDialog.Builder(this)
                  .setMessage("حذف این کار؟")
                  .setPositiveButton(
                      "حذف",
                      (d, w) -> {
                        for (int k = 0; k < tasks.length(); k++)
                          if (tasks.optJSONObject(k).optString("id").equals(t.optString("id"))) {
                            tasks.remove(k);
                            break;
                          }
                        store.save();
                        render();
                      })
                  .setNegativeButton("انصراف", null)
                  .show();
              return true;
            });
      }
      sub(c, fa("" + done) + " از " + fa("" + count) + " انجام‌شده");
    }
  }

  void addTask() {
    LinearLayout l = col();
    l.setPadding(dp(20), 0, dp(20), 0);
    EditText title = input("عنوان کار یا ایده", false),
        tags = input("برچسب‌ها؛ مثلاً اصفهان، اداری", false);
    Spinner p = new Spinner(this);
    ArrayList<String> names = new ArrayList<>();
    JSONArray a = store.array("projects");
    for (int i = 0; i < a.length(); i++) names.add(a.optString(i));
    p.setAdapter(new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, names));
    l.addView(title);
    l.addView(p);
    l.addView(tags);
    AlertDialog d =
        new AlertDialog.Builder(this)
            .setTitle("ثبت سریع کار")
            .setView(l)
            .setPositiveButton("ذخیره", null)
            .setNegativeButton("انصراف", null)
            .create();
    d.setOnShowListener(
        v ->
            d.getButton(-1)
                .setOnClickListener(
                    w -> {
                      if (title.getText().toString().trim().isEmpty()) {
                        title.setError("عنوان را بنویس");
                        return;
                      }
                      try {
                        store
                            .array("tasks")
                            .put(
                                new JSONObject()
                                    .put("id", UUID.randomUUID().toString())
                                    .put("title", title.getText().toString().trim())
                                    .put("project", p.getSelectedItem().toString())
                                    .put("tags", tags.getText().toString())
                                    .put("done", false));
                        store.save();
                        d.dismiss();
                        render();
                      } catch (Exception e) {
                        error(e);
                      }
                    }));
    d.show();
  }

  void reports() {
    heading(body, "گزارش عملکرد");
    sub(body, "عملکرد ثبت‌شده؛ استراحت در زمان مفید حساب نمی‌شود");
    button(
        body,
        (period == 1 ? "✓ " : "") + "امروز",
        () -> {
          period = 1;
          render();
        });
    button(
        body,
        (period == 7 ? "✓ " : "") + "۷ روز اخیر",
        () -> {
          period = 7;
          render();
        });
    button(
        body,
        (period == 30 ? "✓ " : "") + "۳۰ روز اخیر",
        () -> {
          period = 30;
          render();
        });
    long total = 0;
    long[] seconds = new long[Store.NAMES.length];
    for (int day = 0; day < period; day++) {
      Calendar c = Calendar.getInstance();
      c.add(Calendar.DATE, -day);
      String key = Store.day(c.getTimeInMillis());
      total += store.seconds(null, key);
      for (int k = 0; k < seconds.length; k++) seconds[k] += store.seconds(Store.NAMES[k], key);
    }
    LinearLayout c = card();
    sub(c, "جمع زمان مفید");
    heading(c, duration(total));
    for (int i = 0; i < seconds.length; i++) {
      LinearLayout row = card();
      heading(row, Store.NAMES[i]);
      sub(row, duration(seconds[i]));
    }
    button(
        body,
        "کپی گزارش",
        () -> {
          android.content.ClipboardManager cb =
              (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
          StringBuilder b =
              new StringBuilder("گزارش روال • " + date() + "\n" + period + " روز اخیر\n");
          for (int i = 0; i < seconds.length; i++)
            b.append(Store.NAMES[i]).append(": ").append(duration(seconds[i])).append('\n');
          cb.setPrimaryClip(ClipData.newPlainText("گزارش روال", b.toString()));
          toast("گزارش کپی شد");
        });
    button(body, "خروجی CSV برای اکسل", () -> export(false));
    button(body, "پشتیبان کامل JSON", () -> export(true));
  }

  void settings() {
    heading(body, "تنظیمات روال");
    sub(body, "آفلاین • بدون حساب کاربری • اطلاعات روی همین دستگاه");
    LinearLayout c = card();
    heading(c, "بیدارباش");
    sub(c, "ساعت فعلی: " + fa(store.data.optString("wake")));
    button(
        c,
        "تنظیم ساعت",
        () -> {
          String[] parts = store.data.optString("wake", "07:00").split(":");
          new TimePickerDialog(
                  this,
                  (v, h, m) -> {
                    store.put("wake", String.format(Locale.US, "%02d:%02d", h, m));
                    if (store.data.optBoolean("alarmEnabled")) Alarms.scheduleWake(this);
                    render();
                  },
                  Integer.parseInt(parts[0]),
                  Integer.parseInt(parts[1]),
                  true)
              .show();
        });
    Switch sw = new Switch(this);
    sw.setText("زنگ روزانه");
    sw.setChecked(store.data.optBoolean("alarmEnabled"));
    c.addView(sw);
    sw.setOnCheckedChangeListener(
        (b, on) -> {
          if (on && !Alarms.exact(this)) {
            sw.setChecked(false);
            Alarms.requestExact(this);
            return;
          }
          store.put("alarmEnabled", on);
          if (on) Alarms.scheduleWake(this);
          else Alarms.cancelWake(this);
        });
    button(
        c,
        "دسترسی اعلان‌ها و زنگ",
        () -> {
          if (Build.VERSION.SDK_INT >= 33
              && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                  != android.content.pm.PackageManager.PERMISSION_GRANTED)
            requestPermissions(new String[] {android.Manifest.permission.POST_NOTIFICATIONS}, 3);
          else if (!Alarms.exact(this)) Alarms.requestExact(this);
          else if (Build.VERSION.SDK_INT >= 34
              && !((NotificationManager) getSystemService(NOTIFICATION_SERVICE))
                  .canUseFullScreenIntent())
            startActivity(
                new Intent(
                    "android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT",
                    android.net.Uri.parse("package:" + getPackageName())));
          else toast("دسترسی‌ها فعال‌اند");
        });
    button(
        c,
        "آزمایش زنگ در ۱۰ ثانیه",
        () -> {
          if (!Alarms.exact(this)) {
            Alarms.requestExact(this);
            return;
          }
          Alarms.test(this);
          toast("زنگ آزمایشی تنظیم شد");
        });
    button(
        c,
        "الان بیدار شدم",
        () -> {
          store.put("wakeAt", System.currentTimeMillis());
          toast("ساعت بیداری ثبت شد");
        });
    sub(
        c,
        "برای زنگ روی صفحه قفل، اعلان و نمایش تمام‌صفحه را مجاز کن. خاموش‌کردن اجباری برنامه یا"
            + " محدودیت باتری بعضی گوشی‌ها ممکن است مانع زنگ شود.");
    c = card();
    heading(c, "هدف روزانه (دقیقه)");
    for (int i = 0; i < 5; i++) {
      String name = Store.NAMES[i];
      sub(c, name);
      EditText e = input(name, true);
      e.setText("" + store.data.optJSONObject("goals").optInt(name));
      c.addView(e);
      button(
          c,
          "ذخیرهٔ هدف " + name,
          () -> {
            try {
              int n = Integer.parseInt(e.getText().toString());
              if (n < 0 || n > 1440) throw new IllegalArgumentException();
              store.data.getJSONObject("goals").put(name, n);
              store.save();
              toast("ذخیره شد");
            } catch (Exception ex) {
              toast("عددی بین صفر تا ۱۴۴۰ وارد کن");
            }
          });
    }
    c = card();
    heading(c, "داده‌های تو");
    sub(
        c,
        "پیش از حذف برنامه یا تعویض گوشی، پشتیبان بگیر. بازیابی، اطلاعات فعلی را جایگزین می‌کند؛"
            + " تایمر و زنگ فعال منتقل نمی‌شوند.");
    button(c, "پشتیبان JSON", () -> export(true));
    button(c, "خروجی CSV", () -> export(false));
    button(
        c,
        "بازیابی پشتیبان",
        () -> {
          Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
          i.setType("*/*");
          i.addCategory(Intent.CATEGORY_OPENABLE);
          startActivityForResult(i, 12);
        });
  }

  void export(boolean json) {
    try {
      pendingExport = json ? store.data.toString(2) : store.csv();
      Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
      i.addCategory(Intent.CATEGORY_OPENABLE);
      i.setType(json ? "application/json" : "text/csv");
      i.putExtra(
          Intent.EXTRA_TITLE,
          "racking-" + Store.day(System.currentTimeMillis()) + (json ? ".json" : ".csv"));
      startActivityForResult(i, 11);
    } catch (Exception e) {
      error(e);
    }
  }

  @Override
  protected void onActivityResult(int request, int result, Intent intent) {
    super.onActivityResult(request, result, intent);
    if (result != RESULT_OK || intent == null) return;
    try {
      if (request == 11) {
        if (pendingExport == null) {
          toast("لطفاً خروجی را دوباره بگیر");
          return;
        }
        try (OutputStream out = getContentResolver().openOutputStream(intent.getData())) {
          out.write(pendingExport.getBytes(StandardCharsets.UTF_8));
        }
        pendingExport = null;
        toast("فایل ذخیره شد");
      }
      if (request == 12) {
        String raw;
        try (InputStream in = getContentResolver().openInputStream(intent.getData())) {
          byte[] bytes = Store.read(in, 8 * 1024 * 1024 + 1);
          if (bytes.length > 8 * 1024 * 1024)
            throw new IOException("حداکثر اندازه پشتیبان ۸ مگابایت است");
          raw = new String(bytes, StandardCharsets.UTF_8);
        }
        JSONObject imported = new JSONObject(raw);
        Store.validate(imported);
        new AlertDialog.Builder(this)
            .setTitle("جایگزینی اطلاعات؟")
            .setMessage(
                "ابتدا از اطلاعات فعلی پشتیبان بگیر. تمام اطلاعات فعلی با فایل انتخاب‌شده جایگزین"
                    + " خواهد شد.")
            .setNegativeButton("انصراف", null)
            .setPositiveButton(
                "جایگزینی",
                (d, w) -> {
                  Alarms.cancelWake(this);
                  Alarms.cancelSession(this);
                  store.data = imported;
                  store.save();
                  render();
                  toast("اطلاعات بازیابی شد؛ زنگ را دوباره فعال کن");
                })
            .show();
      }
    } catch (Exception e) {
      error(e);
    }
  }

  @Override
  public void onSaveInstanceState(Bundle state) {
    super.onSaveInstanceState(state);
    state.putString("export", pendingExport);
  }

  @Override
  protected void onRestoreInstanceState(Bundle state) {
    super.onRestoreInstanceState(state);
    pendingExport = state.getString("export");
  }

  void toast(String s) {
    Toast.makeText(this, s, Toast.LENGTH_LONG).show();
  }

  void error(Exception e) {
    new AlertDialog.Builder(this)
        .setTitle("عملیات انجام نشد")
        .setMessage(e.getMessage())
        .setPositiveButton("باشه", null)
        .show();
  }
}
