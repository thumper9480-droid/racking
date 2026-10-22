package ir.zaman.app;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
/** Tests the actual update URL/checksum policy without invoking Android services. */
public class UpdatePolicyTest {
  static void check(boolean value){if(!value)throw new AssertionError();}
  public static void main(String[] args)throws Exception{
    String prefix="https://raw.githubusercontent.com/thumper9480-droid/racking/gh-pages/downloads/";
    check(UpdateStore.validApk(prefix+"zaman-android-1.6.0.apk"));
    for(String invalid:new String[]{"http://raw.githubusercontent.com/thumper9480-droid/racking/gh-pages/downloads/update.apk",prefix+"../update.apk",prefix+"%2e%2e/update.apk",prefix+"nested/update.apk",prefix+"a.apk?x=1",prefix+"a.apk#fragment",prefix+"a.zip","https://evil.example/a.apk",prefix+"a.apk/evil.apk","https://raw.githubusercontent.com/thumper9480-droid/other/gh-pages/downloads/a.apk"})check(!UpdateStore.validApk(invalid));
    check(UpdateStore.downloadFilename("zaman-android-1.11.0.apk","first").equals("zaman-android-1.11.0-first.apk"));
    check(!UpdateStore.downloadFilename("zaman-android-1.11.0.apk","first").equals(UpdateStore.downloadFilename("zaman-android-1.11.0.apk","second")));
    check(UpdateStore.downloadFailure(1009).contains("هم‌نام"));
    check(UpdateStore.downloadFailure(1006).contains("فضای"));
    check(!UpdateStore.validApk(null));check(UpdateStore.validHash("A".repeat(64)));check(!UpdateStore.validHash("a".repeat(63)));check(!UpdateStore.validHash("g".repeat(64)));
    check(UpdateStore.hash(new ByteArrayInputStream("abc".getBytes(StandardCharsets.UTF_8))).equals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"));
    check(SoundSettings.validKind("countdown"));check(SoundSettings.validKind("reminder"));check(!SoundSettings.validKind(null));check(!SoundSettings.validKind("arbitrary"));
    System.out.println("PASS native update URL allowlist, traversal/query rejection, SHA-256 verification and sound category policy");
  }
}
