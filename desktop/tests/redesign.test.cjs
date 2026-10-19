const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  E = require("../engine.js");
test("missing Excel dates never inherit weekly goals; explicit plans survive migration", () => {
  const s = E.fresh(),
    k = "2026-10-20";
  s.templates[0].blocks.technical = [15];
  E.setPlan(s, k, {
    wake: "08:00",
    off: false,
    blocks: { technical: [5, 5, 5] },
  });
  assert.equal(E.blocks(s, E.add(k, -3)).length, 0);
  assert.equal(E.graceActivities(s, E.add(k, -3)).length, 0);
  delete s.revision;
  const next = E.migrate(s);
  assert.equal(E.blocks(next, k).length, 3);
  assert.equal(E.blocks(next, E.add(k, -3)).length, 0);
  assert.ok(next.legacyTemplates);
});
test("unfinished task review supports partial, transfer, archive, restore with auditable backup", () => {
  const s = E.fresh(),
    now = +new Date("2026-10-19T21:01:00");
  s.tasks.push({
    id: "a",
    title: "تحقیق",
    project: "دفتر",
    tags: "",
    date: "2026-10-19",
    time: "10:00",
    lead: 0,
    done: false,
    progress: 0,
    history: [],
    archived: false,
    remaining: "",
  });
  assert.equal(E.pendingReview(s, now - 120000).length, 0);
  assert.equal(E.pendingReview(s, now).length, 1);
  const before = JSON.stringify(s);
  assert.throws(() =>
    E.resolveTask(
      s,
      "a",
      "partial",
      { date: "2026-10-20", progress: 120, remaining: "ادامه" },
      now,
    ),
  );
  assert.equal(JSON.stringify(s), before);
  E.resolveTask(
    s,
    "a",
    "partial",
    { date: "2026-10-20", progress: 40, remaining: "جمع‌بندی" },
    now,
  );
  assert.equal(E.pendingReview(s, now).length, 0);
  assert.equal(E.pendingReview(s, +new Date("2026-10-21T08:00:00")).length, 1);
  E.resolveTask(s, "a", "archive", {}, now);
  assert.equal(s.tasks[0].archived, true);
  E.resolveTask(s, "a", "restore", {}, now);
  const next = E.migrate(JSON.parse(JSON.stringify(s)));
  assert.equal(next.tasks[0].progress, 40);
  assert.equal(next.tasks[0].remaining, "جمع‌بندی");
  assert.equal(next.tasks[0].history.length, 3);
  assert.equal(next.tasks[0].history[0].before.date, "2026-10-19");
  E.resolveTask(next, "a", "done", {}, now);
  assert.equal(next.tasks[0].progress, 100);
  E.validate(next);
});
test("pause and resume free activity excludes paused time", () => {
  const s = E.fresh(),
    now = +new Date("2026-10-19T10:00:00");
  E.interrupt(s, "book", now);
  E.pause(s, now + 60000);
  assert.equal(s.active, null);
  E.resume(s, now + 180000);
  E.settle(s, now + 240000);
  assert.equal(E.minutes(s, "2026-10-19", "book"), 2);
  E.validate(s);
});
