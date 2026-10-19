package ir.zaman.app;
import android.content.*;
import org.json.JSONObject;
public class AlarmReceiver extends BroadcastReceiver {
  @Override public void onReceive(Context c,Intent i) {
    if(!"ir.zaman.ALARM".equals(i.getAction())) {AlarmStore.restore(c);return;}
    JSONObject alarm=AlarmStore.fire(c,i.getStringExtra("id"));
    if(alarm!=null)c.startForegroundService(new Intent(c,AlarmService.class).putExtra("title",alarm.optString("title","یادآور")));
  }
}
