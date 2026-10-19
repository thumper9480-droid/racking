package ir.racking.app;

import android.app.*;
import android.content.*;
import android.media.*;
import android.os.*;

public class AlarmService extends Service {
  MediaPlayer player;
  Vibrator vibrator;
  PowerManager.WakeLock lock;

  @Override
  public int onStartCommand(Intent i, int flags, int id) {
    if (i == null) {
      stopSelf();
      return START_NOT_STICKY;
    }
    String action = i.getAction();
    if ("stop".equals(action) || "snooze".equals(action)) {
      if ("snooze".equals(action))
        Alarms.at(this, 3, "snooze", System.currentTimeMillis() + 5 * 60000L);
      else if (i.getBooleanExtra("wake", false))
        new Store(this).put("wakeAt", System.currentTimeMillis());
      stopSelf();
      return START_NOT_STICKY;
    }
    boolean wake = i.getBooleanExtra("wake", false);
    String label = i.getStringExtra("label");
    NotificationManager nm = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
    NotificationChannel ch =
        new NotificationChannel(
            "alarm-v1", "بیدارباش و تمرکز", NotificationManager.IMPORTANCE_HIGH);
    ch.setSound(null, null);
    ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    nm.createNotificationChannel(ch);
    Intent show =
        new Intent(this, AlarmActivity.class)
            .putExtra("label", label)
            .putExtra("wake", wake)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    PendingIntent screen =
        PendingIntent.getActivity(
            this, 0, show, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    PendingIntent stop =
        PendingIntent.getService(
            this,
            11,
            new Intent(this, AlarmService.class).setAction("stop").putExtra("wake", wake),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    Notification.Builder n =
        new Notification.Builder(this, "alarm-v1")
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentTitle(label)
            .setContentText(wake ? "برای خاموش‌کردن لمس کن" : "مرحلهٔ بعدی جلسه")
            .setCategory(Notification.CATEGORY_ALARM)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setContentIntent(screen)
            .setFullScreenIntent(screen, true)
            .addAction(
                new Notification.Action.Builder(null, wake ? "بیدار شدم" : "تأیید", stop).build());
    if (wake) {
      PendingIntent snooze =
          PendingIntent.getService(
              this,
              12,
              new Intent(this, AlarmService.class).setAction("snooze"),
              PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
      n.addAction(new Notification.Action.Builder(null, "تعویق ۵ دقیقه", snooze).build());
    }
    startForeground(100, n.build());
    if (player != null) {
      player.release();
      player = null;
    }
    try {
      player = new MediaPlayer();
      android.net.Uri uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
      if (uri == null) uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
      player.setDataSource(this, uri);
      player.setAudioAttributes(
          new AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_ALARM)
              .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
              .build());
      player.setLooping(true);
      player.prepare();
      player.start();
    } catch (Exception ignored) {
    }
    vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
    vibrator.vibrate(VibrationEffect.createWaveform(new long[] {0, 700, 500}, 0));
    if (lock == null) {
      lock =
          ((PowerManager) getSystemService(POWER_SERVICE))
              .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "racking:alarm");
      lock.acquire(10 * 60 * 1000L);
    }

    return START_NOT_STICKY;
  }

  @Override
  public void onDestroy() {
    if (player != null) player.release();
    if (vibrator != null) vibrator.cancel();
    if (lock != null && lock.isHeld()) lock.release();
    stopForeground(STOP_FOREGROUND_REMOVE);
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent i) {
    return null;
  }
}
