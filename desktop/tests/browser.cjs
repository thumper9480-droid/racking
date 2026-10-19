const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("fs");
(async () => {
  const browser = await chromium.launch({
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox"],
    }),
    page = await browser.newPage({
      viewport: { width: 1440, height: 1050 },
      acceptDownloads: true,
    }),
    errors = [];
  try {
    page.setDefaultTimeout(10000);
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:4173/");
    const nav = async (n) => page.locator(`#nav [data-arg=${n}]`).click(),
      submit = async () => page.locator("#form button[type=submit]").click();
    assert.equal(await page.locator("[data-complete]").count(), 0);
    assert.match(await page.locator("#view").innerText(), /اکسل/);
    await page.evaluate(() => {
      const k = todayKey();
      state.startDate = E.add(k, -2);
      for (const d of [E.add(k, -1), k, E.add(k, 1)])
        E.setPlan(state, d, {
          wake: "08:30",
          off: false,
          blocks: {
            book: [30],
            walk: [20],
            technical: [5, 5, 5],
            platform: [5, 5, 5],
            chart: [5, 5],
          },
        });
      save();
      render();
    });
    assert.equal(await page.locator("[data-complete]").count(), 10);
    // Real timer: work -> pause -> resume -> rest -> phone -> resume -> completion.
    await page
      .locator(".activity-row")
      .filter({ hasText: "تکنیکال" })
      .locator("[data-action=block]")
      .click();
    await page.evaluate(() => {
      state.active.start -= 120000;
    });
    await page.locator("[data-action=pause]").click();
    assert.equal(await page.evaluate(() => state.active), null);
    await page.locator("[data-action=resume]").click();
    assert.equal(await page.evaluate(() => state.active.activity), "technical");
    await page.locator("[data-action=quick][data-arg=rest]").click();
    assert.equal(await page.evaluate(() => state.active.activity), "rest");
    await page.locator("[data-action=quick][data-arg=phone]").click();
    await page.locator("[data-action=resume]").click();
    await page.evaluate(() => {
      state.active.start = Date.now() - 180000;
      state.active.deadline = Date.now();
      tick();
    });
    assert.equal(
      await page.evaluate(() => E.stats(state, todayKey(), todayKey()).done),
      1,
    );
    // Typed activity exact/similar match and a new activity persist.
    await page.locator("[data-action=activityDialog]").first().click();
    await page.locator("#activity-name").fill("تگنیکال");
    await page
      .locator("[data-action=pickActivity][data-arg=technical]")
      .click();
    await submit();
    assert.equal(await page.evaluate(() => state.active.activity), "technical");
    await page.locator("[data-action=finishFocus]").click();
    await page.locator("#quick-activity").fill("شطرنج");
    await page.locator("[data-action=quickTyped]").click();
    await submit();
    assert.equal(await page.evaluate(() => state.active.name), "شطرنج");
    await page.locator("[data-action=finishFocus]").click();
    // Matrix cell toggles and survives navigation, weekly/monthly are distinct.
    await nav("planner");
    await page.locator("[data-action=plannerSpan][data-arg=week]").click();
    assert.equal(await page.locator(".matrix tbody tr").count(), 7);
    const key = await page
      .locator(".matrix-part.is-pending")
      .first()
      .getAttribute("data-arg");
    await page.locator(".matrix-part.is-pending").first().click();
    assert.ok(await page.evaluate((k) => state.completions[k], key));
    assert.ok((await page.locator(".matrix-part.is-complete").count()) > 0);
    await page.locator("[data-action=plannerSpan][data-arg=month]").click();
    assert.ok((await page.locator(".matrix tbody tr").count()) >= 29);
    // Create a task with date/time in one form; appears on Today; partial transfer is audited.
    await nav("projects");
    await page.locator("[data-action=addTask]").click();
    await page.locator("[name=title]").fill("خرید وسایل دفتر");
    await page
      .locator("[name=date]")
      .fill(await page.evaluate(() => E.label(todayKey())));
    await page.locator("[name=time]").fill("14:30");
    await submit();
    await nav("today");
    assert.match(await page.locator("#view").innerText(), /خرید وسایل دفتر/);
    await page.locator("[data-action=reviewTask]").click();
    await page
      .locator("[data-action=reviewAction]")
      .filter({ hasText: "بخشی" })
      .click();
    await page.locator("[name=progress]").fill("40");
    await page.locator("[name=remaining]").fill("خرید پوشه");
    await submit();
    assert.equal(await page.evaluate(() => state.tasks[0].progress), 40);
    assert.equal(
      await page.evaluate(() => state.tasks[0].date),
      await page.evaluate(() => E.add(todayKey(), 1)),
    );
    await nav("projects");
    await page.locator("[data-action=taskHistory]").click();
    assert.match(await page.locator("#form").innerText(), /خرید پوشه/);
    await page.locator("[data-action=closeModal]").click();
    await page.locator("[data-action=reviewTask]").click();
    await page
      .locator("[data-action=reviewAction]")
      .filter({ hasText: "بایگانی" })
      .click();
    assert.equal(await page.locator(".task").count(), 0);
    await page.locator("[data-action=toggleArchive]").click();
    assert.equal(await page.locator(".task").count(), 1);
    await page.locator("[data-action=restoreTask]").click();
    assert.equal(await page.evaluate(() => state.tasks[0].archived), false);
    // Report uses saved actual time; responsive views contain page width.
    await nav("reports");
    assert.ok((await page.locator(".chart-column").count()) > 0);
    await page.screenshot({
      path: "/tmp/raval-reports-v3.png",
      fullPage: true,
    });
    await nav("today");
    await page.screenshot({ path: "/tmp/raval-today-v3.png", fullPage: true });
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 950 });
      for (const n of ["today", "reports", "projects", "settings", "planner"]) {
        await nav(n);
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          `${n} overflows ${width}`,
        );
      }
    }
    // A single complete JSON backup restores progress, history, plans, entries and settings.
    await nav("settings");
    assert.equal(await page.locator("[data-action=editTemplate]").count(), 0);
    const download = page.waitForEvent("download");
    await page.locator("[data-action=backup]").click();
    const file = await (await download).path(),
      backup = JSON.parse(fs.readFileSync(file));
    assert.equal(backup.tasks[0].progress, 40);
    assert.ok(backup.tasks[0].history.length >= 3);
    await page.evaluate(() => {
      state.tasks = [];
      state.plans = {};
      save();
      render();
    });
    page.on("dialog", (d) => d.accept());
    await page.locator("#restore").setInputFiles({
      name: "backup.json",
      mimeType: "application/json",
      buffer: fs.readFileSync(file),
    });
    await page.waitForFunction(() => state.tasks.length === 1);
    assert.equal(
      await page.evaluate(() => state.tasks[0].remaining),
      "خرید پوشه",
    );
    assert.ok((await page.evaluate(() => Object.keys(state.plans).length)) > 0);
    await page.reload();
    assert.equal(await page.evaluate(() => state.tasks[0].progress), 40);
    // If the page was closed at day end, reopening still prompts for overdue work.
    await page.evaluate(() => {
      state.tasks[0].date = E.add(todayKey(), -1);
      state.tasks[0].reviewedOn = "";
      delete state.reviewPromptedOn;
      save();
    });
    await page.reload();
    await page.locator("#dialog[open]").waitFor();
    assert.match(await page.locator("#form").innerText(), /این کار چی شد/);
    await page
      .locator("[data-action=reviewAction]")
      .filter({ hasText: "انجام شد" })
      .first()
      .click();
    assert.equal(await page.evaluate(() => state.tasks[0].done), true);
    assert.deepEqual(errors, []);
    console.log(
      "PASS browser: timer/pause/interrupt, activity search, green weekly/monthly matrix, dated task, partial review/history/archive, responsive reports, complete backup/restore.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
