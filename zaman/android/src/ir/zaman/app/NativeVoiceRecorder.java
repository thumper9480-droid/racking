package ir.zaman.app;

import android.content.Context;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.SystemClock;
import java.io.*;
import org.json.*;

/** Foreground-only AAC recording. Android runtime permission is handled by the Activity. */
final class NativeVoiceRecorder {
  interface Events { void send(String callback, String json); }
  private final Context context;
  private final Events events;
  private MediaRecorder recorder;
  private String recordingId;
  private File recordingFile;
  private long startedAt;
  private volatile String transferId;
  private volatile boolean closed;

  NativeVoiceRecorder(Context context, Events events) {
    this.context = context; this.events = events;
    File[] files = context.getCacheDir().listFiles((dir, name) -> name.startsWith("voice-note-") && name.endsWith(".m4a"));
    if (files != null) for (File file : files) file.delete();
  }
  static boolean validId(String id) { return id != null && id.matches("[a-fA-F0-9-]{36}"); }
  private JSONObject message(String id, String status) throws JSONException {
    return new JSONObject().put("requestId", id).put("status", status);
  }
  void error(String id, String code, String message) {
    if (closed) return;
    try { events.send("onNativeVoiceResult", message(id, "error").put("code", code).put("error", message).toString()); } catch (JSONException ignored) {}
  }
  void start(String id) {
    if (!validId(id) || closed) return;
    if (recorder != null || transferId != null) { error(id, "BUSY", "ابتدا ضبط قبلی را پایان دهید."); return; }
    File file = new File(context.getCacheDir(), "voice-note-" + id + ".m4a");
    MediaRecorder candidate = null;
    try {
      candidate = Build.VERSION.SDK_INT >= 31 ? new MediaRecorder(context) : new MediaRecorder();
      candidate.setAudioSource(MediaRecorder.AudioSource.MIC);
      candidate.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
      candidate.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
      candidate.setAudioChannels(1);
      candidate.setAudioSamplingRate(44100);
      candidate.setAudioEncodingBitRate(48000);
      candidate.setOutputFile(file.getAbsolutePath());
      candidate.setMaxDuration(300000);
      candidate.setMaxFileSize(VoiceTransfer.LIMIT);
      candidate.setOnInfoListener((source, what, extra) -> {
        if (what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED || what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_FILESIZE_REACHED) stop(id);
      });
      candidate.setOnErrorListener((source, what, extra) -> {
        cancel(id); error(id, "RECORDER_ERROR", "ضبط صدا متوقف شد؛ میکروفن گوشی و برنامه‌های ضبط دیگر را بررسی کنید.");
      });
      candidate.prepare(); candidate.start();
      recorder = candidate; recordingId = id; recordingFile = file; startedAt = SystemClock.elapsedRealtime();
      events.send("onNativeVoiceResult", message(id, "recording").toString());
    } catch (Exception error) {
      try { candidate.release(); } catch (Exception ignored) {}
      file.delete(); recorder = null; recordingId = null; recordingFile = null;
      error(id, "RECORDER_START", "شروع ضبط انجام نشد؛ اگر برنامهٔ دیگری ضبط می‌کند آن را ببندید و کلید میکروفن گوشی را بررسی کنید.");
    }
  }
  void stopCurrent() { if (recordingId != null) stop(recordingId); }
  void stop(String id) {
    if (!validId(id) || recorder == null || !id.equals(recordingId)) return;
    MediaRecorder current = recorder; File file = recordingFile;
    long duration = Math.min(300000, SystemClock.elapsedRealtime() - startedAt);
    recorder = null; recordingId = null; recordingFile = null;
    try { current.setOnInfoListener(null); current.setOnErrorListener(null); current.stop(); }
    catch (Exception failure) { file.delete(); error(id, "RECORDING_TOO_SHORT", "صدا آماده نشد؛ ضبط را دوباره شروع کنید و چند ثانیه بعد پایان دهید."); return; }
    finally { try { current.release(); } catch (Exception ignored) {} }
    transferId = id;
    try { events.send("onNativeVoiceResult", message(id, "saving").toString()); } catch (JSONException ignored) {}
    new Thread(() -> {
      try (InputStream input = new FileInputStream(file)) {
        long size = file.length();
        int count = VoiceTransfer.send(input, (index, data) -> {
          if (closed || !id.equals(transferId)) throw new IOException("cancelled");
          try { events.send("onNativeVoiceChunk", new JSONObject().put("requestId", id).put("index", index).put("data", data).toString()); }
          catch (JSONException failure) { throw new IOException(failure); }
        });
        if (!closed && id.equals(transferId)) events.send("onNativeVoiceResult", message(id, "finished").put("size", size).put("chunks", count).put("mimeType", "audio/mp4").put("durationMs", duration).toString());
      } catch (Exception failure) {
        if (!closed && id.equals(transferId)) error(id, "TRANSFER", "دریافت فایل صدا انجام نشد؛ دوباره ضبط کنید.");
      } finally { if (id.equals(transferId)) transferId = null; file.delete(); }
    }, "zaman-voice-transfer").start();
  }
  void cancel(String id) {
    if (!validId(id)) return;
    if (id.equals(transferId)) transferId = null;
    if (id.equals(recordingId)) {
      MediaRecorder current = recorder; File file = recordingFile;
      recorder = null; recordingId = null; recordingFile = null;
      try { current.setOnInfoListener(null); current.setOnErrorListener(null); current.stop(); } catch (Exception ignored) {}
      try { current.release(); } catch (Exception ignored) {}
      if (file != null) file.delete();
    }
  }
  void close() { closed = true; transferId = null; if (recordingId != null) cancel(recordingId); }
}
