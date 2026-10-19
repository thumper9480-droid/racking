package ir.racking.app;

import static org.junit.Assert.*;

import org.json.*;
import org.junit.Test;

public class BackupTest {
  @Test
  public void backupRoundTripPreservesTasksAndEntries() throws Exception {
    JSONObject original = Store.fresh();
    original
        .getJSONArray("entries")
        .put(
            new JSONObject()
                .put("id", "one")
                .put("category", "کتاب")
                .put("start", 100000)
                .put("end", 1900000)
                .put("seconds", 1800)
                .put("day", "2026-10-19")
                .put("note", "مطالعه"));
    original
        .getJSONArray("tasks")
        .put(
            new JSONObject()
                .put("id", "task")
                .put("title", "خرید کتاب")
                .put("project", "خرید")
                .put("tags", "اصفهان")
                .put("done", false));
    JSONObject restored = new JSONObject(original.toString());
    Store.validate(restored);
    assertEquals(1800, restored.getJSONArray("entries").getJSONObject(0).getLong("seconds"));
    assertEquals("اصفهان", restored.getJSONArray("tasks").getJSONObject(0).getString("tags"));
  }

  @Test
  public void restoreNeverRestartsForeignTimersOrAlarms() throws Exception {
    JSONObject d = Store.fresh();
    d.put("active", new JSONObject());
    d.put("session", new JSONObject());
    d.put("alarmEnabled", true);
    Store.validate(d);
    assertFalse(d.has("active"));
    assertFalse(d.has("session"));
    assertFalse(d.getBoolean("alarmEnabled"));
  }

  @Test(expected = JSONException.class)
  public void unknownVersionRejected() throws Exception {
    JSONObject d = Store.fresh();
    d.put("version", 99);
    Store.validate(d);
  }

  @Test(expected = JSONException.class)
  public void invalidWakeTimeRejected() throws Exception {
    JSONObject d = Store.fresh();
    d.put("wake", "25:80");
    Store.validate(d);
  }

  @Test(expected = JSONException.class)
  public void negativeGoalRejected() throws Exception {
    JSONObject d = Store.fresh();
    d.getJSONObject("goals").put("کتاب", -5);
    Store.validate(d);
  }

  @Test(expected = JSONException.class)
  public void falsifiedDurationRejected() throws Exception {
    JSONObject d = Store.fresh();
    d.getJSONArray("entries")
        .put(
            new JSONObject()
                .put("id", "x")
                .put("category", "کتاب")
                .put("start", 1000)
                .put("end", 6000)
                .put("seconds", 999)
                .put("day", "2026-10-19")
                .put("note", ""));
    Store.validate(d);
  }

  @Test
  public void csvEscapesQuotesAndSpreadsheetFormulas() {
    assertEquals("\"a,\"\"b\"\"\"", Store.q("a,\"b\""));
    assertEquals("\"'=1+1\"", Store.q("=1+1"));
  }
}
