package ir.zaman.app;
import java.io.*;
import java.util.*;
public class VoiceTransferTest {
  public static void main(String[] args) throws Exception {
    byte[] source = new byte[2*1024*1024+7]; new Random(72).nextBytes(source);
    ByteArrayOutputStream restored = new ByteArrayOutputStream(); int[] expected = {0};
    InputStream input = new ByteArrayInputStream(source) {
      @Override public synchronized int read(byte[] target,int offset,int length) { return super.read(target,offset,Math.min(length,137)); }
    };
    int count = VoiceTransfer.send(input,(index,data)->{
      if(index!=expected[0]++ || data.length()>32768)throw new AssertionError();
      restored.write(Base64.getDecoder().decode(data));
    });
    if(count!=expected[0] || !Arrays.equals(source,restored.toByteArray()))throw new AssertionError();
    try { VoiceTransfer.send(new ByteArrayInputStream(new byte[0]),(index,data)->{});throw new AssertionError(); } catch(IOException correct) {}
    try { VoiceTransfer.send(new ByteArrayInputStream(new byte[(int)VoiceTransfer.LIMIT+1]),(index,data)->{});throw new AssertionError(); } catch(IOException correct) {}
    try { VoiceTransfer.send(new ByteArrayInputStream(source),(index,data)->{throw new IOException("cancelled");});throw new AssertionError(); } catch(IOException correct) {}
    System.out.println("PASS actual native voice transfer: partial reads, ordered bounded messages, byte-exact 2MiB roundtrip, empty/oversize rejection and cancellation");
  }
}
