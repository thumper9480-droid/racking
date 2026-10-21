package ir.zaman.app;
import android.app.DownloadManager;
import android.content.*;

public class UpdateReceiver extends BroadcastReceiver {
  @Override public void onReceive(Context c,Intent i){
    if(!DownloadManager.ACTION_DOWNLOAD_COMPLETE.equals(i.getAction()))return;long id=i.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID,-1);if(id!=UpdateStore.prefs(c).getLong("id",-2))return;
    PendingResult pending=goAsync();new Thread(()->{try{UpdateStore.finish(c,id);}finally{pending.finish();}},"zaman-update-verify").start();
  }
}
