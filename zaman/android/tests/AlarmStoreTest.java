package ir.zaman.app;
import java.time.*;
import java.util.TimeZone;
/** Exercises the actual native recurrence code on the JVM. */
public class AlarmStoreTest {
  static void check(String from,String repeat,String now,String expected){long actual=AlarmStore.next(Instant.parse(from).toEpochMilli(),repeat,Instant.parse(now).toEpochMilli());if(actual!=Instant.parse(expected).toEpochMilli())throw new AssertionError(Instant.ofEpochMilli(actual)+" != "+expected);}
  public static void main(String[] args){
    TimeZone.setDefault(TimeZone.getTimeZone("UTC"));
    check("2026-10-19T09:00:00Z","daily","2026-10-19T09:00:00Z","2026-10-20T09:00:00Z");
    check("2026-10-19T09:00:00Z","weekly","2026-11-03T12:00:00Z","2026-11-09T09:00:00Z");
    TimeZone.setDefault(TimeZone.getTimeZone("Europe/Paris"));
    check("2026-10-24T07:00:00Z","daily","2026-10-24T07:00:00Z","2026-10-25T08:00:00Z");
    check("2026-03-28T08:00:00Z","daily","2026-03-28T08:00:00Z","2026-03-29T07:00:00Z");
    System.out.println("PASS native recurrence: daily, missed weekly occurrences, daylight saving transitions preserve local hour");
  }
}
