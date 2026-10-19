package ir.racking.app;

import android.app.*;
import android.content.Intent;
import android.os.Bundle;
import android.view.*;
import android.widget.*;

public class AlarmActivity extends Activity {
  @Override
  public void onCreate(Bundle b) {
    super.onCreate(b);
    if (android.os.Build.VERSION.SDK_INT >= 27) {
      setShowWhenLocked(true);
      setTurnScreenOn(true);
    } else {
      getWindow()
          .addFlags(
              WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                  | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
    }
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    LinearLayout l = new LinearLayout(this);
    l.setOrientation(LinearLayout.VERTICAL);
    l.setGravity(Gravity.CENTER);
    l.setPadding(32, 32, 32, 32);
    l.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
    l.setBackgroundColor(0xffedf6f1);
    TextView title = new TextView(this);
    title.setText(getIntent().getStringExtra("label"));
    title.setTextSize(30);
    title.setTextColor(0xff087f73);
    l.addView(title);
    boolean wake = getIntent().getBooleanExtra("wake", true);
    Button done = new Button(this);
    done.setText(wake ? "بیدار شدم؛ خاموش کن" : "تأیید");
    l.addView(done);
    done.setOnClickListener(
        v -> {
          if (wake) new Store(this).put("wakeAt", System.currentTimeMillis());
          stopService(new Intent(this, AlarmService.class));
          startActivity(
              new Intent(this, MobileActivity.class)
                  .putExtra("mobileAction", wake ? "wake" : "stage"));
          finish();
        });
    if (wake) {
      Button snooze = new Button(this);
      snooze.setText("۵ دقیقه دیگر");
      l.addView(snooze);
      snooze.setOnClickListener(
          v -> {
            Alarms.at(this, 3, "snooze", System.currentTimeMillis() + 5 * 60000L);
            stopService(new Intent(this, AlarmService.class));
            finish();
          });
    }
    setContentView(l);
  }
}
