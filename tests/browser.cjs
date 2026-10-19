const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    headless: true,
    args: ["--no-sandbox"],
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto("http://127.0.0.1:4173/");
  await page.locator("[data-action=nav]").first().waitFor();
  const nav = async (name) =>
    page.locator(`[data-action=nav][data-arg=${name}]`).click();
  assert.match(await page.locator("#view").innerText(), /تکنیکال: ۱۵/);
  assert.equal(await page.locator("[data-complete]").count(), 15);
  // Real user: planned block -> rest -> phone -> resume; no new duplicate timer.
  await page
    .locator("[data-action=block]")
    .filter({ hasText: "شروع ۵" })
    .first()
    .click();
  assert.ok(await page.locator("#clock").count());
  await page.locator("[data-action=quick][data-arg=rest]").click();
  assert.match(await page.locator("#view").innerText(), /ادامهٔ کار قبلی/);
  await page.locator("[data-action=quick][data-arg=phone]").click();
  await page.locator("[data-action=resume]").click();
  await page.locator("[data-action=stop]").click();
  // Planned series uses adjustable rest and survives a real UI interruption.
  await page.locator("[data-action=series][data-arg=technical]").click();
  await page.locator("[name=rest]").fill("10");
  await page.locator("#form button[type=submit]").click();
  await page.evaluate(() => {
    state.active.start = Date.now() - state.active.target;
    state.active.deadline = Date.now();
    tick();
  });
  assert.match(await page.locator("#view").innerText(), /جلسهٔ تکنیکال/);
  assert.equal(await page.evaluate(() => state.series.stage), "rest");
  await page.locator("[data-action=quick][data-arg=phone]").click();
  await page.locator("[data-action=resume]").click();
  assert.equal(await page.evaluate(() => state.series.paused), false);
  await page.locator("[data-action=stop]").click();
  // Completion and persistence.
  await page.locator("[data-complete]").first().check();
  await page.reload();
  assert.ok(await page.locator("[data-complete]").first().isChecked());
  // Persian month editing and explicit day override.
  await nav("planner");
  await page.locator("#planner-year").fill("1405");
  await page.locator("#planner-month").selectOption("8");
  await page.locator("[data-action=chooseMonth]").click();
  assert.equal(await page.locator("tbody tr").count(), 30);
  const field = page.locator('[data-day="2026-10-23"][data-field=technical]');
  await field.fill("۳×۵");
  await field.press("Tab");
  await page.waitForTimeout(50);
  assert.equal(
    await page
      .locator('[data-day="2026-10-23"][data-field=technical]')
      .inputValue(),
    "5 5 5",
  );
  // Blank day.
  await page.locator('[data-off="2026-10-24"]').check();
  await page.locator('[data-action=openDay][data-arg="2026-10-24"]').click();
  assert.match(await page.locator("#view").innerText(), /روز خالی/);
  // Custom specialized group.
  await nav("planner");
  await page.locator("[data-action=addGroup]").click();
  await page.locator("[name=name]").fill("ترید");
  await page.locator("#form button[type=submit]").click();
  assert.ok(
    await page.getByRole("columnheader", { name: "ترید", exact: true }).count(),
  );
  // Bulk entire month, preserving other groups; confirmation handled once.
  await page.locator("[data-action=bulk]").click();
  await page.locator("[name=activity]").selectOption("technical");
  await page.locator("[name=parts]").fill("۵ ۱۰ ۲۰");
  page.once("dialog", (d) => d.accept());
  await page.locator("#form button[type=submit]").click();
  assert.equal(
    await page
      .locator('[data-day="2026-10-23"][data-field=technical]')
      .inputValue(),
    "5 10 20",
  );
  // Work from tomorrow may be completed now while assigned to tomorrow.
  await page.evaluate(() => {
    selected = E.add(todayKey(), 1);
    tab = "today";
    render();
  });
  await page.locator("[data-complete]").last().check();
  // Project task -> date + time -> today's list, keep project.
  await nav("projects");
  await page.locator("[data-action=addTask]").click();
  await page.locator("[name=title]").fill("پیگیری دفتر");
  await page.locator("[name=project]").selectOption({ label: "دفتر" });
  await page.locator("[name=tags]").fill("اصفهان، اداری");
  await page.locator("#form button[type=submit]").click();
  const row = page.locator(".task").filter({ hasText: "پیگیری دفتر" });
  await row.locator("[data-action=schedule]").click();
  await page.locator("[data-action=fillToday]").click();
  await page.locator("[name=time]").fill("23:50");
  await page.locator("[name=lead]").selectOption("10");
  await page.locator("#form button[type=submit]").click();
  await nav("today");
  await page.locator("[data-action=goToday]").click();
  assert.match(await page.locator("#view").innerText(), /پیگیری دفتر/);
  assert.match(await page.locator("#view").innerText(), /دفتر/);
  await page.locator("[data-task]").check();
  // Due reminders are delivered once, without requiring Notification API.
  await page.evaluate(() => {
    const t = state.tasks[0];
    t.done = false;
    t.time = new Date(Date.now() - 60000).toTimeString().slice(0, 5);
    t.lead = 0;
    delete state.delivered[t.id];
    reminders();
    reminders();
  });
  assert.equal(
    await page
      .locator(".toast")
      .filter({ hasText: "یادآوری: پیگیری دفتر" })
      .count(),
    1,
  );
  // All reporting periods render, annual planned graph contains 12 buckets.
  await nav("reports");
  for (const p of ["day", "week", "month", "year"])
    await page.locator(`[data-action=reportPeriod][data-arg=${p}]`).click();
  assert.equal(await page.locator(".chart-line").count(), 12);
  // Native browser JSON export and download, then restore (including planned blocks).
  const downloadPromise = page.waitForEvent("download");
  await page.locator("[data-action=backup]").click();
  const download = await downloadPromise;
  const fs = require("fs");
  const file = await download.path();
  const exported = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(exported.version, 2);
  assert.equal(exported.active, null);
  assert.ok(exported.plans["2026-10-23"]);
  await nav("settings");
  page.once("dialog", (d) => d.accept());
  await page
    .locator("#restore")
    .setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(exported)),
    });
  await page.waitForTimeout(200);
  assert.match(await page.locator("#toasts").innerText(), /بازیابی کامل شد/);
  // XSS is escaped in custom group and task content.
  await page.evaluate(() => {
    state.tasks.push({
      id: "xss",
      title: '<img src=x onerror="window.bad=true">',
      project: "دفتر",
      tags: "",
      done: false,
      date: todayKey(),
      time: "",
      lead: 0,
    });
    save();
    tab = "projects";
    render();
  });
  assert.equal(await page.locator("img").count(), 0);
  assert.equal(await page.evaluate(() => window.bad), undefined);
  // Screenshot actual implementation and mobile fit.
  await nav("today");
  await page.screenshot({ path: "/tmp/raval-today-v2.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/raval-mobile-v2.png", fullPage: true });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS browser: timer interruptions, completions, Persian monthly edits, blank days, custom groups, bulk planning, project scheduling, reminders once, annual chart, JSON download/restore, XSS escaping, responsive layout.",
  );
  // A separate browser context demonstrates actual v1 storage migration.
  const old = await browser.newContext();
  const legacy = await old.newPage();
  await legacy.goto("http://127.0.0.1:4173/");
  await legacy.evaluate(() =>
    localStorage.setItem(
      "raval-desktop-v1",
      JSON.stringify({
        version: 1,
        goals: [20, 30, 15, 15, 35, 0, 0],
        wake: "08:30",
        entries: [],
        tasks: [
          { title: "کار قدیمی", project: "دفتر", tags: "اصفهان", done: false },
        ],
        projects: ["دفتر"],
        active: null,
      }),
    ),
  );
  await legacy.reload();
  await legacy.locator("[data-action=nav][data-arg=projects]").click();
  assert.match(await legacy.locator("#view").innerText(), /کار قدیمی/);
  assert.ok(
    await legacy.evaluate(() => localStorage.getItem("raval-before-v2")),
  );
  console.log(
    "PASS browser migration: v1 tasks survive upgrade with preserved original backup.",
  );
  await browser.close();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
