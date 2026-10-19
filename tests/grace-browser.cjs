const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
      executablePath: "/usr/bin/chromium",
      headless: true,
      args: ["--no-sandbox"],
    }),
    page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:4173/");
  await page.evaluate(() => {
    const old = E.add(todayKey(), -1);
    state.startDate = old;
    E.setPlan(state, todayKey(), {
      wake: "08:30",
      off: false,
      blocks: { book: [30], technical: [], platform: [5] },
    });
    E.setPlan(state, old, {
      wake: "08:00",
      off: false,
      blocks: { technical: [5, 5, 5] },
    });
    save();
    render();
  });
  const technical = page.locator(".grace-card").filter({ hasText: "تکنیکال" });
  assert.equal(await technical.count(), 1);
  assert.match(await technical.innerText(), /ارفاقی/);
  assert.equal(await technical.locator("[data-action=block]").count(), 3);
  assert.equal(
    await page.locator(".grace-card").filter({ hasText: "کتاب" }).count(),
    0,
  );
  await technical.locator("[data-action=block]").first().click();
  assert.equal(
    await page.evaluate(() => state.active.planDate),
    await page.evaluate(() => E.add(todayKey(), -1)),
  );
  await page.evaluate(() => {
    state.active.start = Date.now() - 300000;
    state.active.deadline = Date.now();
    tick();
  });
  assert.equal(await technical.locator("[data-action=block]").count(), 2);
  await page.reload();
  assert.match(
    await page
      .locator(".grace-card")
      .filter({ hasText: "تکنیکال" })
      .innerText(),
    /۲ بخش/,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS browser: activity-specific grace, old work completion, actual time today and persistence.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
