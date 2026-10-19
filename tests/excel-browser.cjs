const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("fs"),
  ExcelJS = require("../vendor/exceljs.min.js");
(async () => {
  const browser = await chromium.launch({
      executablePath: "/usr/bin/chromium",
      headless: true,
      args: ["--no-sandbox"],
    }),
    page = await browser.newPage({
      acceptDownloads: true,
      viewport: { width: 1440, height: 1000 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4173/");
  await page.locator("#nav [data-action=nav][data-arg=excel]").click();
  if (process.env.TRACK_XLSX) {
    await page.locator("#excel-file").setInputFiles(process.env.TRACK_XLSX);
    await page.waitForFunction(() => pendingExcel?.plans.length === 203);
    assert.match(await page.locator("#view").innerText(), /۲۰۳/);
    assert.equal(await page.evaluate(() => Object.keys(state.plans).length), 0);
    await page.locator("[data-action=excelCommit]").first().click();
    assert.equal(
      await page.evaluate(() => Object.keys(state.plans).length),
      203,
    );
    assert.equal(await page.evaluate(() => state.startDate), "2026-09-28");
    assert.equal(
      await page.evaluate(() => state.plans["2026-09-29"].wake),
      "08:30",
    );
    await page.reload();
    assert.equal(
      await page.evaluate(() => Object.keys(state.plans).length),
      203,
    );
    console.log(
      "PASS actual-file browser import: preview first, 203 plans retained across reload, correct wake time and numbering.",
    );
  }
  await page.locator("#nav [data-action=nav][data-arg=excel]").click();
  const downloading = page.waitForEvent("download");
  await page.locator('a[download][href*="raval-template.xlsx"]').click();
  const downloaded = await downloading,
    file = await downloaded.path(),
    book = new ExcelJS.Workbook();
  await book.xlsx.load(fs.readFileSync(file));
  assert.ok(book.getWorksheet("برنامه روزانه"));
  assert.ok(book.getWorksheet("کارها"));
  assert.ok(book.getWorksheet("گروه‌ها"));
  await page.locator("#excel-file").setInputFiles({
    name: "roundtrip.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: fs.readFileSync(file),
  });
  await page.waitForFunction(() => pendingExcel?.plans.length > 0);
  assert.equal(await page.evaluate(() => pendingExcel.errors.length), 0);
  // Add a task and a new group through the Excel input, not only the existing planner format.
  const w = new ExcelJS.Workbook(),
    tasks = w.addWorksheet("کارها");
  tasks.addRow([
    "پروژه",
    "عنوان کار",
    "شهر / برچسب",
    "تاریخ شمسی",
    "ساعت",
    "یادآوری (دقیقه قبل)",
    "انجام شد",
  ]);
  tasks.addRow([
    "پروژه اکسل",
    "کار ورودی",
    "اصفهان",
    "1405/08/01",
    "10:30",
    15,
    "خیر",
  ]);
  const groups = w.addWorksheet("گروه‌ها");
  groups.addRow(["نام فعالیت", "تخصصی", "زمان مفید"]);
  groups.addRow(["تحقیق جدید", "بله", "بله"]);
  await page.locator("#excel-file").setInputFiles({
    name: "tasks.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await w.xlsx.writeBuffer()),
  });
  await page.waitForFunction(() => pendingExcel?.tasks.length === 1);
  await page.locator("[data-action=excelCommit]").first().click();
  assert.equal(await page.evaluate(() => state.tasks[0].project), "پروژه اکسل");
  assert.equal(await page.evaluate(() => state.tasks[0].time), "10:30");
  assert.ok(
    await page.evaluate(() =>
      state.activities.some((a) => a.name === "تحقیق جدید"),
    ),
  );
  await page.locator("#nav [data-action=nav][data-arg=projects]").click();
  assert.match(await page.locator("#view").innerText(), /کار ورودی/);
  // A corrupt file cannot mutate the current state.
  const before = await page.evaluate(() => JSON.stringify(state));
  await page.locator("#nav [data-action=nav][data-arg=excel]").click();
  await page.locator("#excel-file").setInputFiles({
    name: "broken.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from("not an excel file"),
  });
  await page.waitForFunction(() => !excelBusy);
  assert.equal(await page.evaluate(() => JSON.stringify(state)), before);
  assert.equal(await page.evaluate(() => pendingExcel), null);
  // A complete replacement removes stale dates without erasing real records or project tasks.
  const sourceBook = new ExcelJS.Workbook(),
    sourceSheet = sourceBook.addWorksheet("برنامه");
  sourceSheet.addRow([
    "شماره روز",
    "روز",
    "تاریخ",
    "ماه",
    "سال",
    "بیدار باش",
    "کتاب",
    "تکنیکال",
  ]);
  sourceSheet.addRow([1, "سه‌شنبه", 28, "مهر", 1405, 8.3, 20, 15]);
  await page.evaluate(() => {
    E.setPlan(state, "2026-10-17", {
      wake: "08:00",
      off: false,
      blocks: { book: [30] },
    });
    state.entries.push({
      activity: "book",
      name: "کتاب",
      note: "",
      start: 1000,
      end: 61000,
    });
    save();
  });
  await page.locator("#excel-file").setInputFiles({
    name: "final.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: Buffer.from(await sourceBook.xlsx.writeBuffer()),
  });
  await page.waitForFunction(() => pendingExcel?.plans.length === 1);
  await page.locator("#excel-replace").check();
  await page.locator("[data-action=excelCommit]").first().click();
  assert.deepEqual(await page.evaluate(() => Object.keys(state.plans)), [
    "2026-10-20",
  ]);
  assert.equal(
    await page.evaluate(() => E.blocks(state, "2026-10-17").length),
    0,
  );
  assert.equal(await page.evaluate(() => state.entries.length), 1);
  assert.equal(await page.evaluate(() => state.tasks.length), 1);
  const response = await page.request.get(
    "http://127.0.0.1:4173/raval-template.xlsx",
  );
  assert.equal(response.status(), 200);
  assert.ok((await response.body()).length > 1000);
  assert.deepEqual(errors, []);
  console.log(
    "PASS browser: XLSX download/re-import, task/project/group mapping, safe corrupt-file failure and template download.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
