const { test } = require("node:test");
const assert = require("node:assert/strict");
const E = require("../engine.js");
const sample = "2026-10-19";
test("Persian calendar known date and Persian digits", () => {
  assert.equal(E.parsePersian("۱۴۰۵/۰۷/۲۷"), sample);
  assert.equal(E.label(sample), "1405/07/27");
  assert.equal(E.parsePersian("١٤٠٥/٠٧/٢٧"), sample);
});
test("leap Esfand and invalid day rejected", () => {
  assert.equal(E.monthLength(1403, 12), 30);
  assert.equal(E.fromPersian(1403, 12, 30), "2025-03-20");
  assert.equal(E.fromPersian(1404, 1, 1), "2025-03-21");
  assert.throws(() => E.fromPersian(1404, 12, 30));
  assert.throws(() => E.parsePersian("1405/7/31"));
  assert.throws(() => E.parsePersian("1405/13/1"));
});
test("all months round trip across years", () => {
  for (let y = 1399; y <= 1410; y++)
    for (let m = 1; m <= 12; m++)
      for (const d of [1, E.monthLength(y, m)]) {
        const k = E.fromPersian(y, m, d);
        assert.deepEqual(E.persian(k), { y, m, d });
      }
});
test("block inputs support Persian, repetition, mixed lengths; reject invalid", () => {
  assert.deepEqual(E.parseParts("۵ ۱۰ ۲۰"), [5, 10, 20]);
  assert.deepEqual(E.parseParts("3×5"), [5, 5, 5]);
  assert.deepEqual(E.parseParts("۲*۱۰،۵"), [10, 10, 5]);
  assert.deepEqual(E.parseParts(""), []);
  for (const s of ["-1", "0", "5.5", "101x5", "abc"])
    assert.throws(() => E.parseParts(s));
});
test("day override stays distinct and blank day has no blocks", () => {
  const s = E.fresh(),
    p = structuredClone(E.plan(s, sample));
  p.blocks.technical = [10, 20];
  E.setPlan(s, sample, p);
  assert.deepEqual(E.plan(s, sample).blocks.technical, [10, 20]);
  assert.deepEqual(E.plan(s, E.add(sample, 1)).blocks.technical, [5, 5, 5]);
  p.off = true;
  E.setPlan(s, sample, p);
  assert.equal(E.blocks(s, sample).length, 0);
});
test("reject impossible daily duration without changing saved plan", () => {
  const s = E.fresh(),
    p = structuredClone(E.plan(s, sample));
  p.blocks.book = [720, 720];
  assert.throws(() => E.setPlan(s, sample, p));
  assert.equal(s.plans[sample], undefined);
});
test("pause with rest and phone retains work progress without double counting", () => {
  const s = E.fresh(),
    base = +new Date(sample + "T10:00:00"),
    b = E.blocks(s, sample).find((b) => b.id === "technical");
  E.startBlock(s, b, base);
  E.interrupt(s, "rest", base + 120000);
  assert.equal(s.progress[b.key], 120000);
  E.interrupt(s, "phone", base + 180000);
  E.resume(s, base + 240000);
  assert.equal(s.active.deadline, base + 420000);
  E.settle(s, base + 500000);
  assert.equal(s.completions[b.key], true);
  assert.equal(E.minutes(s, sample, "technical"), 5);
  assert.equal(E.minutes(s, sample, "rest"), 1);
  assert.equal(E.minutes(s, sample, "phone"), 1);
  assert.equal(E.minutes(s, sample), 5);
});
test("future plan completes on assigned day, actual work stays today", () => {
  const s = E.fresh(),
    future = E.add(sample, 1),
    b = E.blocks(s, future).find((b) => b.id === "technical"),
    base = +new Date(sample + "T12:00:00");
  E.startBlock(s, b, base);
  E.settle(s, base + 300000);
  assert.equal(E.stats(s, future, future).done, 1);
  assert.equal(E.stats(s, future, future).actual, 0);
  assert.equal(E.stats(s, sample, sample).actual, 5);
  assert.equal(E.stats(s, sample, sample).done, 0);
});
test("completed checkbox does not fabricate actual time", () => {
  const s = E.fresh(),
    b = E.blocks(s, sample)[0];
  s.completions[b.key] = true;
  const stat = E.stats(s, sample, sample);
  assert.equal(stat.actual, 0);
  assert.equal(stat.completed, b.minutes);
});
test("timing across midnight splits correctly in reports", () => {
  const s = E.fresh();
  s.entries.push({
    activity: "book",
    name: "کتاب",
    note: "",
    start: +new Date(sample + "T23:50:00"),
    end: +new Date(E.add(sample, 1) + "T00:10:00"),
  });
  assert.equal(E.minutes(s, sample), 10);
  assert.equal(E.minutes(s, E.add(sample, 1)), 10);
});
test("legacy users keep entries, tasks and projects; specialized goals become parts", () => {
  const old = {
    version: 1,
    goals: [20, 30, 15, 15, 35, 0, 0],
    wake: "08:45",
    projects: ["دفتر"],
    tasks: [{ title: "test", project: "دفتر", tags: "اصفهان", done: false }],
    entries: [{ name: "کتاب", start: 1000, end: 61000, note: "" }],
    active: null,
  };
  const original = JSON.stringify(old),
    s = E.migrate(old);
  assert.equal(s.version, 2);
  assert.equal(s.entries.length, 1);
  assert.equal(s.tasks[0].title, "test");
  assert.equal(s.templates[0].wake, "08:45");
  assert.deepEqual(s.templates[0].blocks.technical, [5, 5, 5]);
  assert.equal(JSON.stringify(old), original);
  E.validate(s);
});
test("backup validation rejects invalid nested plans, entries and task dates", () => {
  for (const mutate of [
    (s) => (s.plans[sample] = { wake: "25:00", off: false, blocks: {} }),
    (s) =>
      s.entries.push({
        name: "x",
        activity: "book",
        note: "",
        start: 99,
        end: 1,
      }),
    (s) =>
      s.tasks.push({
        id: "1",
        title: "x",
        project: "دفتر",
        tags: "",
        done: false,
        date: "2026-02-30",
        time: "09:00",
        lead: 0,
      }),
    (s) => (s.completions.x = "yes"),
  ]) {
    const s = E.fresh();
    mutate(s);
    assert.throws(() => E.validate(s));
  }
});
test("full year range and stats include custom activities", () => {
  const s = E.fresh(),
    from = E.first(1405),
    to = E.add(E.first(1406), -1);
  assert.equal(E.range(from, to).length, 365);
  s.activities.push({
    id: "trade",
    name: "ترید",
    useful: true,
    special: true,
    custom: true,
  });
  const p = structuredClone(E.plan(s, sample));
  p.blocks.trade = [20];
  E.setPlan(s, sample, p);
  assert.equal(E.blocks(s, sample).filter((b) => b.id === "trade").length, 1);
  E.validate(s);
  assert.ok(E.stats(s, from, to).planned > 0);
});
test("task reminder due time and schedules retain project identity", () => {
  const t = { date: sample, time: "10:30", lead: 15, project: "دفتر" };
  assert.equal(E.reminderTime(t), +new Date(sample + "T10:15:00"));
  assert.equal(E.reminderTime({ ...t, time: "" }), null);
  assert.equal(t.project, "دفتر");
});
test("series follows variable-length planned blocks with timed rest between them", () => {
  const s = E.fresh(),
    base = +new Date(sample + "T10:00:00");
  E.startSeries(s, sample, "technical", 10, base);
  assert.equal(s.active.deadline, base + 300000);
  E.advanceSeries(s, base + 300000);
  assert.equal(s.active.activity, "rest");
  assert.equal(s.active.deadline, base + 900000);
  assert.equal(s.completions[s.series.queue[0].key], true);
  E.advanceSeries(s, base + 900000);
  assert.equal(s.active.activity, "technical");
  assert.equal(s.active.deadline, base + 1200000);
  E.advanceSeries(s, base + 1200000);
  E.advanceSeries(s, base + 1800000);
  E.advanceSeries(s, base + 2100000);
  assert.equal(s.series, null);
  assert.equal(s.active, null);
  assert.equal(E.minutes(s, sample, "technical"), 15);
  assert.equal(E.minutes(s, sample, "rest"), 20);
  E.validate(s);
});
test("interrupt series rest and resume remaining rest, not the full rest", () => {
  const s = E.fresh(),
    base = +new Date(sample + "T10:00:00");
  E.startSeries(s, sample, "technical", 10, base);
  E.advanceSeries(s, base + 300000);
  E.interrupt(s, "phone", base + 420000);
  assert.equal(s.series.paused, true);
  assert.equal(s.paused.remaining, 480000);
  E.resume(s, base + 480000);
  assert.equal(s.series.paused, false);
  assert.equal(s.active.deadline, base + 960000);
  E.advanceSeries(s, base + 960000);
  assert.equal(s.active.activity, "technical");
  assert.equal(E.minutes(s, sample, "rest"), 10);
  assert.equal(E.minutes(s, sample, "phone"), 1);
  E.validate(s);
});
test("typed activities normalize Arabic letters and spacing; exact match never duplicates", () => {
  const s = E.fresh(),
    length = s.activities.length;
  assert.equal(E.ensureActivity(s, " كِتاب ", "ignored").id, "book");
  assert.equal(s.activities.length, length);
  const a = E.ensureActivity(s, "یادگیری زبان", "language", true);
  assert.equal(E.ensureActivity(s, "يادگيري  زبان", "ignored").id, a.id);
  assert.equal(s.activities.length, length + 1);
  assert.throws(() => E.ensureActivity(s, "  ", "bad"));
  E.validate(s);
});
test("search suggests similar existing activity but does not auto-replace user intent", () => {
  const s = E.fresh();
  assert.ok(
    E.similarActivities(s, "تگنیکال").some((a) => a.id === "technical"),
  );
  assert.ok(
    E.similarActivities(s, "کتاب انگلیسی").some((a) => a.id === "book"),
  );
  assert.equal(E.findActivity(s, "کتاب انگلیسی"), undefined);
  assert.equal(E.similarActivities(s, "شطرنج").length, 0);
});
test("empty group is grace for that activity only, and its prior backlog remains assigned to the original day", () => {
  const s = E.fresh(),
    today = "2026-10-19",
    yesterday = E.add(today, -1);
  s.startDate = yesterday;
  E.setPlan(s, today, {
    wake: "08:30",
    off: false,
    blocks: { book: [30], technical: [], platform: [5] },
  });
  assert.ok(E.graceActivities(s, today).some((a) => a.id === "technical"));
  assert.ok(!E.graceActivities(s, today).some((a) => a.id === "book"));
  const pending = E.backlog(s, today, "technical");
  assert.equal(pending.length, 3);
  assert.equal(pending[0].date, yesterday);
  const t = +new Date(today + "T12:00:00");
  E.startBlock(s, pending[0], t);
  E.settle(s, t + 300000);
  assert.equal(E.backlog(s, today, "technical").length, 2);
  assert.equal(E.stats(s, today, today).done, 0);
  assert.equal(E.stats(s, today, today).actual, 5);
  assert.equal(E.stats(s, yesterday, yesterday).done, 1);
  assert.deepEqual(E.parseParts("*"), []);
});
test("an explicitly resting day stays distinct from group-specific grace", () => {
  const s = E.fresh(),
    k = "2026-10-19",
    p = structuredClone(E.plan(s, k));
  p.off = true;
  E.setPlan(s, k, p);
  assert.deepEqual(E.graceActivities(s, k), []);
});
