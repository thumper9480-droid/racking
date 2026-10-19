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
  const w = X.buildWorkbook(ExcelJS, s, { year: 1405, layout: "monthly" });
  const bytes = await w.xlsx.writeBuffer(),
    read = new ExcelJS.Workbook();
  await read.xlsx.load(bytes);
  const monthlySheets = read.worksheets.filter((sheet) =>
    /^.+ 1405$/.test(sheet.name),
  );
  assert.equal(monthlySheets.length, 12);
  for (const sheet of monthlySheets) {
    assert.ok(sheet.rowCount <= 33);
    assert.equal(sheet.views[0].topLeftCell, "A3");
    assert.ok(!sheet.views[0].xSplit);
    assert.ok(sheet.views[0].zoomScale <= 90);
    assert.ok(sheet.getColumn(11).width <= 3);
    assert.equal(sheet.getCell("A3").border.top.style, "thin");
    assert.equal(sheet.pageSetup.fitToWidth, 1);
  }
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
  assert.equal(r.plans[0].plan.off, false);
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
test("TRACK layout is continuous with one header, original group positions and source colors", async () => {
  const s = E.fresh(),
    k = E.parsePersian("1405/7/27");
  E.setPlan(s, k, {
    wake: "06:30",
    off: false,
    blocks: { walk: [35], book: [40], technical: [], platform: [], chart: [] },
  });
  const w = X.buildWorkbook(ExcelJS, s, { year: 1405 });
  assert.equal(w.worksheets.length, 4);
  const table = w.getWorksheet("برنامه روزانه");
  assert.equal(table.rowCount, 366);
  assert.equal(table.views[0].topLeftCell, "A2");
  assert.equal(table.views[0].ySplit, 1);
  assert.equal(table.getCell("A1").value, "شماره روز");
  assert.equal(table.getCell("J1").value, "جمع مطالعه تکنیکال");
  assert.equal(table.getCell("W1").value, "جمع پلتفرم");
  assert.equal(table.getCell("AJ1").value, "تحلیل چارت");
  assert.ok(table.model.merges.includes("K1:V1"));
  assert.ok(table.model.merges.includes("X1:AI1"));
  assert.ok(table.model.merges.includes("AJ1:AZ1"));
  assert.equal(table.getColumn(53).hidden, true);
  const r = E.range(E.first(1405), k).length + 1;
  assert.equal(table.getCell(r, 11).value, "*");
  assert.equal(table.getCell(r, 11).fill.fgColor.argb, "FF99FF99");
  assert.equal(table.getCell(r, 6).fill.fgColor.argb, "FF000000");
  const read = new ExcelJS.Workbook();
  await read.xlsx.load(await w.xlsx.writeBuffer());
  const report = X.readWorkbook(read, E.fresh(), id);
  assert.equal(report.errors.length, 0);
  assert.equal(report.plans.length, 365);
  assert.equal(report.plans.find((p) => p.date === k).plan.wake, "06:30");
  assert.deepEqual(
    report.plans.find((p) => p.date === k).plan.blocks.technical,
    [],
  );
});
test("blank and starred cells are activity-specific grace, never automatically a whole-day holiday", () => {
  const { w, s } = simple();
  s.addRow([1, "", 6, "مهر", 1405, 8, 30, "*"]);
  s.addRow([2, "", 7, "مهر", 1405, 8.15, "", ""]);
  s.addRow([3, "", 8, "مهر", 1405, 8.3, 10, 5]);
  const report = X.readWorkbook(w, E.fresh(), id),
    next = X.applyReport(E.fresh(), report).state;
  assert.equal(report.errors.length, 0);
  assert.equal(report.plans[0].plan.wake, "08:00");
  assert.equal(report.plans[1].plan.wake, "08:15");
  assert.equal(report.plans[2].plan.wake, "08:30");
  assert.ok(
    E.graceActivities(next, "2026-09-28").some((a) => a.id === "technical"),
  );
  assert.ok(
    !E.graceActivities(next, "2026-09-28").some((a) => a.id === "book"),
  );
  assert.equal(next.plans["2026-09-29"].off, false);
});
