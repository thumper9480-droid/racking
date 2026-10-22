package ir.zaman.app;

import java.io.IOException;
import java.io.InputStream;
import java.util.Base64;

/** Small messages avoid passing an entire recording through one WebView IPC call. */
final class VoiceTransfer {
  static final long LIMIT = 8L * 1024 * 1024;
  interface Sink { void accept(int index, String base64) throws IOException; }
  static int send(InputStream input, Sink sink) throws IOException {
    byte[] buffer = new byte[24 * 1024];
    int count = 0, n; long total = 0;
    while ((n = input.read(buffer)) != -1) {
      if (n == 0) continue;
      total += n;
      if (total > LIMIT) throw new IOException("voice size limit");
      byte[] block = n == buffer.length ? buffer : java.util.Arrays.copyOf(buffer, n);
      sink.accept(count++, Base64.getEncoder().encodeToString(block));
    }
    if (total == 0) throw new IOException("empty recording");
    return count;
  }
}
