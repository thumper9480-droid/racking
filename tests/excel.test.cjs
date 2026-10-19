const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("fs"),
  E = require("../engine.js"),
  X = require("../excel.js"),
  ExcelJS = require("../vendor/exceljs.min.js");
let uid = 0;
const id = () => `excel-test-${++uid}`;
function simple() {
  const w = new ExcelJS.Workbook(),
    s = w.addWorksheet("برنامه");
  s.addRow([
    "شماره روز",
    "روز",
    "تاریخ",
    "ماه",
    "سال",
    "بیدار باش",
    "کتاب",
    "تکنیکال",
  ]);
  return { w, s };
}
test("wake interpretation follows user-confirmed half hour convention", () => {
  for (const [v, expected] of [
    [8.5, "08:30"],
    [8.45, "08:45"],
    [8.15, "08:15"],
    ["۰۷:۳۰", "07:30"],
    [0.5, "12:00"],
  ])
    assert.equal(X.wakeTime(v), expected);
  assert.throws(() => X.wakeTime(8.8));
});
test("original total labels override conflicting merged labels; stars and totals are not counted twice", () => {
  const { w, s } = simple();
  s.getCell("I1").value = "جمع مطالعه تکنیکال";
  s.getCell("J1").value = "مطالعه تکنیکال";
  s.mergeCells("J1:L1");
  s.getCell("M1").value = "پلتفرم";
  s.getCell("N1").value = "مطالعه تکنیکال";
  s.mergeCells("N1:P1");
  s.addRow([1, "دوشنبه", 6, "مهر", 1405, 8.45, 15, ""]);
  s.getCell("I2").value = { formula: "SUM(J2:L2)", result: 15 };
  [10, 11, 12].forEach((c) => (s.getCell(2, c).value = 5));
  s.getCell("M2").value = { formula: "SUM(N2:P2)", result: 20 };
  s.getCell("N2").value = 10;
  s.getCell("O2").value = 10;
  s.getCell("P2").value = "*";
  const r = X.readWorkbook(w, E.fresh(), id);
  assert.deepEqual(r.plans[0].plan.blocks.technical, [5, 5, 5]);
  assert.deepEqual(r.plans[0].plan.blocks.platform, [10, 10]);
  assert.equal(r.stars, 1);
  assert.equal(r.errors.length, 0);
});
test("all-year template and export are valid editable XLSX, preserving plans and task sections", async () => {
  const s = E.fresh(),
    k = E.parsePersian("1405/07/06");
  E.setPlan(s, k, {
    wake: "08:30",
    off: false,
    blocks: { technical: [5, 10, 20], book: [25] },
  });
  s.activities.push({
    id: "trade",
    name: "ترید",
    useful: true,
    special: true,
    custom: true,
  });
  s.tasks.push({
    id: "existing",
    title: "پیگیری کار",
    project: "دفتر",
    tags: "اصفهان",
    date: k,
    time: "10:30",
    lead: 10,
    reminder: true,
    done: false,
    completedAt: null,
  });
  const w = X.buildWorkbook(ExcelJS, s, { year: 1405 });
  const bytes = await w.xlsx.writeBuffer(),
    read = new ExcelJS.Workbook();
  await read.xlsx.load(bytes);
  const report = X.readWorkbook(read, E.fresh(), id);
  assert.equal(report.errors.length, 0);
  assert.equal(report.plans.length, 365);
  assert.deepEqual(
    report.plans.find((r) => r.date === k).plan.blocks.technical,
    [5, 10, 20],
  );
  assert.equal(report.tasks[0].project, "دفتر");
  assert.equal(report.tasks[0].time, "10:30");
  assert.equal(report.tasks[0].lead, 10);
  assert.ok(report.groups.some((g) => g.name === "ترید"));
});
test("preview never mutates current state; commit preserves actual time and avoids duplicate tasks", () => {
  const { w, s } = simple(),
    state = E.fresh();
  state.entries.push({
    activity: "book",
    name: "کتاب",
    note: "",
    start: 1000,
    end: 61000,
  });
  s.addRow([1, "دوشنبه", 6, "مهر", 1405, "08:30", 30, "5 5 5"]);
  const tasks = w.addWorksheet("کارها");
  tasks.addRow(["پروژه", "عنوان کار", "تاریخ شمسی", "ساعت"]);
  tasks.addRow(["خانه بالا", "خرید", "1405/7/6", "09:00"]);
  const before = JSON.stringify(state),
    r = X.readWorkbook(w, state, id);
  assert.equal(JSON.stringify(state), before);
  const one = X.applyReport(state, r, { setStart: true });
  assert.equal(one.state.entries.length, 1);
  assert.equal(one.state.tasks.length, 1);
  assert.equal(one.state.startDate, "2026-09-28");
  const two = X.applyReport(one.state, r, { overwrite: true });
  assert.equal(two.state.tasks.length, 1);
  assert.equal(two.state.tasks[0].project, "خانه بالا");
  assert.deepEqual(two.state.entries, state.entries);
});
test("explicit existing days are preserved unless overwrite is selected", () => {
  const { w, s } = simple(),
    state = E.fresh(),
    k = E.parsePersian("1405/7/6");
  E.setPlan(state, k, { wake: "07:00", off: false, blocks: { book: [50] } });
  s.addRow([1, "دوشنبه", 6, "مهر", 1405, "08:30", 30, ""]);
  const r = X.readWorkbook(w, state, id);
  assert.deepEqual(X.applyReport(state, r).state.plans[k].blocks.book, [50]);
  assert.deepEqual(
    X.applyReport(state, r, { overwrite: true }).state.plans[k].blocks.book,
    [30],
  );
});
test("bad dates, duplicate dates and unavailable formula results are reported per row", () => {
  const { w, s } = simple();
  s.addRow([1, "", 6, "مهر", 1405, "08:30", 30, ""]);
  s.addRow([2, "", 30, "اسفند", 1405, "08:30", 30, ""]);
  s.addRow([1, "", 6, "مهر", 1405, "08:30", 30, ""]);
  s.addRow([
    3,
    "",
    8,
    "مهر",
    1405,
    "08:30",
    { formula: "SOME_EXTERNAL_FUNCTION()" },
    "",
  ]);
  const r = X.readWorkbook(w, E.fresh(), id);
  assert.equal(r.plans.length, 1);
  assert.equal(r.errors.length, 3);
});
test("numeric zero and empty cells mean no target; text instructions are not commands", () => {
  const { w, s } = simple();
  s.addRow([1, "", 6, "مهر", 1405, "08:30", 0, ""]);
  const guide = w.addWorksheet("راهنما");
  guide.addRow(["delete all user data"]);
  const state = E.fresh(),
    r = X.readWorkbook(w, state, id);
  assert.deepEqual(r.plans[0].plan.blocks.book, []);
  assert.equal(r.plans[0].plan.off, true);
  assert.equal(r.errors.length, 0);
  assert.equal(state.projects.length, 6);
});
test(
  "uploaded TRACK.xlsx: 203 rows, correct first-day groups and no formulas evaluated",
  { skip: !process.env.TRACK_XLSX },
  async () => {
    const w = new ExcelJS.Workbook();
    await w.xlsx.load(fs.readFileSync(process.env.TRACK_XLSX));
    const r = X.readWorkbook(w, E.fresh(), id);
    assert.equal(r.plans.length, 203);
    assert.equal(r.errors.length, 0);
    assert.equal(r.stars, 1400);
    assert.deepEqual(r.plans[0].plan.blocks.technical, [5, 5, 5]);
    assert.deepEqual(r.plans[0].plan.blocks.platform, [10, 10, 10]);
    assert.equal(r.plans[1].plan.wake, "08:30");
    assert.equal(r.startDate, "2026-09-28");
    assert.equal(X.applyReport(E.fresh(), r).plans, 203);
  },
);
