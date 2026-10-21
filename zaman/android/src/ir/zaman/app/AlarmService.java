package ir.zaman.app;
import android.app.*;
import android.content.*;
import android.media.*;
import android.os.*;
public class AlarmService extends Service {
  MediaPlayer player; Vibrator vibrator; PowerManager.WakeLock lock;
  final Handler handler=new Handler(Looper.getMainLooper());
  @Override public int onStartCommand(Intent i,int flags,int id) {
    if(i==null||"stop".equals(i.getAction())) {stopSelf();return START_NOT_STICKY;}
    String title=i.getStringExtra("title"),kind=i.getStringExtra("kind");if(!SoundSettings.validKind(kind))kind="reminder";
    NotificationManager nm=getSystemService(NotificationManager.class);
    NotificationChannel channel=new NotificationChannel("zaman-alarm","زنگ تایمر و یادآورها",NotificationManager.IMPORTANCE_HIGH);channel.setSound(null,null);nm.createNotificationChannel(channel);
    PendingIntent stop=PendingIntent.getService(this,0,new Intent(this,AlarmService.class).setAction("stop"),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
    startForeground(1,new Notification.Builder(this,"zaman-alarm").setSmallIcon(android.R.drawable.ic_lock_idle_alarm).setContentTitle(title).setContentText("برای بازکردن لمس کنید؛ برای خاموش‌کردن، قطع زنگ را بزنید").setContentIntent(open).setCategory(Notification.CATEGORY_ALARM).setVisibility(Notification.VISIBILITY_PUBLIC).setOngoing(true).addAction(new Notification.Action.Builder(null,"قطع زنگ",stop).build()).build());
    if(player!=null){player.release();player=null;}
    android.net.Uri selected=SoundSettings.selected(this,kind);
    if(selected!=null)try {play(selected);}catch(Exception ignored){try{play(RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM));}catch(Exception fallbackIgnored){}}
    vibrator=getSystemService(Vibrator.class);vibrator.vibrate(VibrationEffect.createWaveform(new long[]{0,500,700},0));
    if(lock==null){lock=getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"zaman:alarm");lock.acquire(5*60*1000L);}
    handler.removeCallbacksAndMessages(null);handler.postDelayed(this::stopSelf,5*60*1000L);
    return START_NOT_STICKY;
  }
  void play(android.net.Uri uri)throws Exception{if(player!=null){player.release();player=null;}player=new MediaPlayer();player.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build());player.setDataSource(this,uri);player.setLooping(true);player.prepare();player.start();}
  @Override public void onDestroy(){handler.removeCallbacksAndMessages(null);if(player!=null)player.release();if(vibrator!=null)vibrator.cancel();if(lock!=null&&lock.isHeld())lock.release();stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();}
  @Override public IBinder onBind(Intent i){return null;}
}
