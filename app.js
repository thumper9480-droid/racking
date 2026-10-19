"use strict";
const E = window.Raval,
  $ = (s) => document.querySelector(s),
  fa = (n) => Number(n).toLocaleString("fa-IR"),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const storageKey = "raval-desktop-v1",
  todayKey = () => E.key(new Date()),
  months = [
    "فروردین",
    "اردیبهشت",
    "خرداد",
    "تیر",
    "مرداد",
    "شهریور",
    "مهر",
    "آبان",
    "آذر",
    "دی",
    "بهمن",
    "اسفند",
  ],
  week = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];
const graceExpanded = new Set();
let pendingExcel = null,
  excelBusy = false,
  excelLoader = null;
let state,
  tab = "today",
  selected = todayKey(),
  calendar = E.persian(selected),
  reportPeriod = "week",
  filter = "",
  storageFailed = false,
  reminderChecking = false,
  dialogSubmit = null;
let source = null;
try {
  source = localStorage.getItem(storageKey);
  state = source ? E.migrate(JSON.parse(source)) : E.fresh();
  if (
    source &&
    JSON.parse(source).version === 1 &&
    !localStorage.getItem("raval-before-v2")
  )
    localStorage.setItem("raval-before-v2", source);
} catch (err) {
  state = E.fresh();
  storageFailed = true;
  $("#storage-warning").innerHTML =
    '<div class="notice">اطلاعات قبلی خوانده نشد و بازنویسی نمی‌شود. از «دریافت دادهٔ قبلی» استفاده کن تا اطلاعاتت محفوظ بماند. <button data-action="rawBackup">دریافت دادهٔ قبلی</button></div>';
}
function save() {
  if (storageFailed) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (err) {
    toast("ذخیره‌سازی ناموفق بود؛ قبل از بستن صفحه پشتیبان بگیر.");
  }
}
function toast(message) {
  const n = document.createElement("div");
  n.className = "toast";
  n.textContent = message;
  $("#toasts").append(n);
  setTimeout(() => n.remove(), 6000);
}
function button(text, action, arg = "", cls = "") {
  return `<button type="button" class="${cls}" data-action="${action}" data-arg="${esc(typeof arg === "string" ? arg : JSON.stringify(arg))}">${text}</button>`;
}
function card(title, content, cls = "") {
  return `<article class="card ${cls}"><h3>${title}</h3>${content}</article>`;
}
function duration(ms) {
  const n = Math.floor(Math.max(0, ms) / 1000);
  return [Math.floor(n / 3600), Math.floor(n / 60) % 60, n % 60]
    .map((x) => String(x).padStart(2, "0"))
    .join(":")
    .replace(/\d/g, (n) => "۰۱۲۳۴۵۶۷۸۹"[n]);
}
const label = (k) => E.label(k).replace(/\d/g, (n) => "۰۱۲۳۴۵۶۷۸۹"[n]);
const time = (t) =>
  new Date(t).toLocaleTimeString("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
  });
const planActivities = () =>
  state.activities.filter(
    (a) =>
      a.custom ||
      ["walk", "book", "platform", "technical", "chart"].includes(a.id),
  );
const groupName = (id) => E.activity(state, id)?.name || id;
function navigate(name) {
  tab = name;
  render();
}
function render() {
  $("#date").textContent = new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "full",
  }).format(new Date());
  $("#nav").innerHTML = [
    ["today", "امروز"],
    ["planner", "برنامهٔ کلی"],
    ["projects", "پروژه‌ها"],
    ["reports", "گزارش‌ها"],
    ["settings", "تنظیمات"],
    ["excel", "اکسل"],
  ]
    .map(([id, name]) => button(name, "nav", id, tab === id ? "on" : ""))
    .join("");
  const fn = {
    today: renderToday,
    planner: renderPlanner,
    projects: renderProjects,
    reports: renderReports,
    settings: renderSettings,
    excel: renderExcel,
  }[tab];
  fn();
  updateClock();
}
function dayControl() {
  return `<div class="day-control">${button("روز قبل", "shiftDay", "-1", "icon")}<label class="sr-only" for="selected-date">تاریخ شمسی</label><input id="selected-date" inputmode="numeric" value="${label(selected)}" aria-label="تاریخ شمسی">${button("برو", "chooseDay")}${button("روز بعد", "shiftDay", "1", "icon")}${button("امروز", "goToday", "", selected === todayKey() ? "primary" : "")}<span class="muted">${week[E.date(selected).getDay()]}</span></div>`;
}
function renderToday() {
  const p = E.plan(state, selected),
    bs = E.blocks(state, selected),
    stats = E.stats(state, selected, selected),
    a = state.active,
    now = todayKey();
  let html =
    dayControl() +
    card(
      selected === now ? "برنامهٔ امروز" : "برنامهٔ " + label(selected),
      `<div class="row"><div><small>انجام برنامه</small><div class="big">${stats.planned ? fa(stats.percent) + "٪" : p.off ? "استراحت" : "ارفاقی"}</div><small>${fa(stats.done)} از ${fa(stats.count)} بخش</small></div><div><small>زمان مفید ثبت‌شدهٔ این روز</small><div class="stat">${fa(Math.round(stats.actual))} دقیقه</div></div><div><small>بیدارباش برنامه</small><div class="stat numeric">${esc(p.wake)}</div>${state.woke && E.key(new Date(state.woke)) === selected ? "<small>بیداری واقعی: " + time(state.woke) + "</small>" : ""}</div></div><progress value="${stats.completed}" max="${stats.planned || 1}"></progress>`,
      "hero",
    );
  if (selected !== now)
    html +=
      '<div class="notice future">این صفحه برنامهٔ تاریخ انتخاب‌شده است؛ اگر الان انجامش بدهی، تیک برای این تاریخ و زمان واقعی برای امروز ثبت می‌شود.</div>';
  html += card(
    "الان چه کار می‌کنی؟",
    `${a ? `<div class="row"><div><strong>${esc(a.name)}</strong><br><small>${a.block ? "زمان باقی‌ماندهٔ بخش" : "زمان سپری‌شده"}</small></div><div id="clock" class="big"></div>${button("پایان و ثبت", "stop", "", "primary")}</div>` : '<p class="muted">یک فعالیت یا بخش برنامه را شروع کن؛ زمانش خودکار ثبت می‌شود.</p>'}<div class="quick">${button("☀ الان بیدار شدم", "wake")}${["rest", "instagram", "wc", "family", "idle", "sleep", "phone", "outside"].map((id) => button(esc(groupName(id)), "quick", id)).join("")}</div>${state.paused ? `<div class="notice success">${esc(state.paused.name)} متوقف شده است. ${button("ادامهٔ کار قبلی", "resume", "", "primary")}</div>` : ""}${state.series ? '<p class="muted">جلسهٔ ' + esc(groupName(state.series.id)) + " • بخش " + fa(state.series.position + 1) + " از " + fa(state.series.queue.length) + " • استراحت " + fa(state.series.restMinutes) + " دقیقه</p>" : ""}${!a ? button("از آخرین ثبت تا الان", "since") : ""}`,
    a ? "active-card" : "",
  );
  html += '<h2 class="section-title">فعالیت‌های برنامه</h2><div class="grid">';
  if (!bs.length)
    html += card(
      p.off ? "روز خالی / استراحت" : "امروز فرصت جبران فعالیت‌هاست",
      button("تنظیم این روز", "editDay", selected),
    );
  for (const activity of planActivities()) {
    const list = bs.filter((b) => b.id === activity.id);
    if (!list.length) {
      if (!p.off) html += graceCard(activity);
      continue;
    }
    const sum = list.reduce((n, b) => n + b.minutes, 0);
    html += card(
      `<span class="activity-heading">${esc(activity.name)}: ${fa(sum)} <span class="arrow">←</span></span>`,
      `${activity.special ? "<small>کارهای تخصصی</small>" : ""}<div class="parts">${list.map((b) => `<label class="part ${state.completions[b.key] ? "checked" : ""}"><input type="checkbox" data-complete="${esc(b.key)}" ${state.completions[b.key] ? "checked" : ""} aria-label="تکمیل بخش ${fa(b.index + 1)} ${esc(activity.name)}"><span>${fa(b.minutes)}</span></label>`).join("")}</div><div class="actions">${
        list
          .filter((b) => !state.completions[b.key])
          .slice(0, 1)
          .map((b) =>
            button(
              (state.active?.block === b.key ? "در حال اجرا: " : "شروع ") +
                fa(b.minutes),
              "block",
              b.key,
              "small",
            ),
          )
          .join("") || "<small>همهٔ بخش‌ها انجام شدند ✓</small>"
      }${list.some((b) => !state.completions[b.key]) ? button("کار / استراحت", "series", activity.id, "small") : ""}</div>`,
    );
  }
  html +=
    '</div><div class="actions" style="margin-top:14px">' +
    button("ویرایش برنامهٔ این روز", "editDay", selected) +
    button("شروع فعالیت دلخواه", "activityDialog") +
    "</div>";
  const tasks = state.tasks
    .filter((t) => t.date === selected)
    .sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
  html +=
    '<h2 class="section-title">کارهای این روز</h2>' +
    card(
      "از پروژه‌ها و کارهای شخصی",
      tasks.length
        ? tasks.map(taskRow).join("")
        : '<p class="empty">کاری برای این تاریخ تعیین نشده. در پروژه‌ها «برنامه‌ریزی» را بزن.</p>',
    );
  html +=
    '<h2 class="section-title">خط زمانی واقعی این روز</h2>' +
    timeline(selected);
  $("#view").innerHTML = html;
}
function graceCard(activity) {
  const pending = E.backlog(state, selected, activity.id),
    expanded = graceExpanded.has(activity.id),
    visible = expanded ? pending : pending.slice(0, 4);
  return card(
    esc(activity.name) + ' <span class="badge">ارفاقی</span>',
    `<p class="muted">امروز برای این فعالیت هدف زمانی جدید نداری؛ می‌توانی عقب‌ماندگی همین گروه را جبران کنی.</p>${pending.length ? "<small>" + fa(pending.length) + ' بخش انجام‌نشده از روزهای قبل</small><div class="stack" style="margin-top:12px">' + visible.map((b) => '<div class="row"><label><input type="checkbox" data-complete="' + esc(b.key) + '" aria-label="جبران ' + esc(activity.name) + " " + label(b.date) + '"> ' + fa(b.minutes) + " دقیقه • " + label(b.date) + "</label>" + button("شروع جبران", "block", b.key, "small") + "</div>").join("") + "</div>" : '<p class="muted">کار عقب‌افتاده‌ای در این گروه ثبت نشده.</p>'}${pending.length > 4 ? button(expanded ? "نمایش کمتر" : "همهٔ عقب‌ماندگی‌ها", "graceExpand", activity.id, "small") : ""}<div style="margin-top:12px">${button("شروع آزاد " + esc(activity.name), "quick", activity.id, "small")}</div>`,
    "grace-card",
  );
}
function timeline(k) {
  const [lo, hi] = E.interval(k),
    items = state.entries
      .map((e, i) => ({ ...e, index: i }))
      .filter((e) => e.start < hi && e.end > lo)
      .reverse();
  return card(
    "ثبت فعالیت‌ها",
    items.length
      ? items
          .map(
            (e) =>
              `<div class="task"><div class="content"><b>${esc(e.name)}</b><br><small>${time(Math.max(lo, e.start))} ← ${time(Math.min(hi, e.end))} • ${fa(Math.round((Math.min(hi, e.end) - Math.max(lo, e.start)) / 60000))} دقیقه</small>${e.note ? `<br><small>${esc(e.note)}</small>` : ""}</div>${button("حذف", "removeEntry", String(e.index), "small danger")}</div>`,
          )
          .join("")
      : '<p class="empty">هنوز زمانی برای این روز ثبت نشده.</p>',
  );
}
function complete(key, checked) {
  state.series = null;
  if (checked && state.active?.block === key) E.settle(state, Date.now());
  state.completions[key] = checked;
  if (!checked) state.progress[key] = 0;
  if (state.paused?.block === key) state.paused = null;
  save();
  render();
}
function startBlock(key) {
  if (state.active?.block === key) return;
  const b = E.blocks(state, key.split("|")[0]).find((x) => x.key === key);
  if (!b) return toast("این بخش تغییر کرده؛ صفحه را تازه کن");
  state.series = null;
  E.startBlock(state, b);
  save();
  render();
}
function quick(id) {
  if (id === "outside") {
    activityDialog();
    return;
  }
  E.interrupt(state, id);
  save();
  render();
}
function stop() {
  const key = state.active?.block,
    wasSeries = state.active?.series;
  E.settle(state, Date.now());
  if (key || wasSeries) {
    state.paused = null;
    state.series = null;
  }
  save();
  render();
}
function wake() {
  state.woke = Date.now();
  save();
  toast("بیداری امروز در ساعت " + time(state.woke) + " ثبت شد");
}
function modal(title, html, submit) {
  dialogSubmit = submit;
  $("#form").innerHTML =
    `<h2>${title}</h2>${html}<div class="actions"><button class="primary" type="submit">ذخیره</button>${button("انصراف", "closeModal")}</div>`;
  $("#dialog").showModal();
}
function closeModal() {
  $("#dialog").close();
  dialogSubmit = null;
}
function activityPicker() {
  return `<label>چه کاری؟<input class="field" name="activityName" id="activity-name" placeholder="اسم کار را بنویس؛ مثلاً کتاب یا زبان" maxlength="80" autocomplete="off" required></label><div id="activity-matches" class="stack"></div><label><input name="newUseful" type="checkbox" checked> فعالیت جدید در زمان مفید حساب شود</label>`;
}
function updateActivityMatches() {
  const input = $("#activity-name"),
    box = $("#activity-matches");
  if (!input || !box) return;
  const name = input.value.trim(),
    exact = E.findActivity(state, name),
    matches = E.similarActivities(state, name);
  box.innerHTML = `${matches.length ? '<small>از فعالیت‌های موجود انتخاب کن:</small><div class="actions">' + matches.map((a) => button(esc(a.name), "pickActivity", a.id, "small")).join("") + "</div>" : ""}${name && !exact ? '<div class="notice">' + (matches.length ? "نام‌های مشابه بالا را ببین؛ اگر منظورت کار دیگری است، با ذخیره به لیست اضافه می‌شود." : "این کار در لیست نیست؛ با ذخیره، به گزینه‌های بعدی اضافه می‌شود.") + "</div>" : ""}${exact ? "<small>از گزینهٔ موجود استفاده می‌شود؛ تکراری ساخته نمی‌شود.</small>" : ""}`;
}
function resolveTypedActivity(f) {
  const name = f.get("activityName").trim();
  return E.ensureActivity(
    state,
    name,
    "g-" + crypto.randomUUID(),
    f.has("newUseful"),
  );
}
function activityDialog() {
  modal(
    "چه کاری انجام می‌دهی؟",
    activityPicker() +
      '<label>یادداشت (اختیاری)<input class="field" name="note" maxlength="200"></label>',
    (f) => {
      const a = resolveTypedActivity(f);
      E.interrupt(state, a.id, Date.now(), f.get("note"));
      save();
      closeModal();
      render();
    },
  );
  updateActivityMatches();
}
function sinceDialog() {
  if (state.active) return toast("اول فعالیت جاری را پایان بده");
  const [midnight] = E.interval(todayKey()),
    last = Math.max(
      midnight,
      state.woke || 0,
      ...state.entries.map((e) => e.end),
    ),
    end = Date.now();
  if (last === midnight || last >= end)
    return toast("اول بیداری را ثبت کن یا یک فعالیت را شروع کن");
  modal(
    "ثبت تا همین الان",
    `<p>${time(last)} تا ${time(end)} • ${fa(Math.round((end - last) / 60000))} دقیقه</p>${activityPicker()}`,
    (f) => {
      const a = resolveTypedActivity(f);
      state.entries.push({
        activity: a.id,
        name: a.name,
        note: "ثبت از آخرین فعالیت",
        start: last,
        end,
      });
      save();
      closeModal();
      render();
    },
  );
  updateActivityMatches();
}
function dateInput(name, k, required = true) {
  return `<input name="${name}" class="field" placeholder="۱۴۰۵/۰۸/۰۱" value="${k ? label(k) : ""}" inputmode="numeric" ${required ? "required" : ""}>`;
}
function renderPlanner() {
  const y = calendar.y,
    m = calendar.m,
    count = E.monthLength(y, m),
    activities = planActivities();
  let rows = "";
  for (let d = 1; d <= count; d++) {
    const k = E.fromPersian(y, m, d),
      p = E.plan(state, k),
      sum = E.blocks(state, k).reduce((n, b) => n + b.minutes, 0),
      n = Math.round((E.date(k) - E.date(state.startDate)) / 86400000) + 1;
    rows += `<tr class="${p.off ? "off" : k === todayKey() ? "current" : ""}"><td>${n > 0 ? fa(n) : "—"}</td><td>${fa(d)} ${months[m - 1]}<br><small>${week[E.date(k).getDay()]}</small></td><td><input aria-label="بیدارباش ${label(k)}" data-day="${k}" data-field="wake" class="table-input wake" type="time" value="${p.wake}"></td>${activities.map((a) => `<td><input aria-label="${esc(a.name)} ${label(k)}" class="table-input" data-day="${k}" data-field="${a.id}" placeholder="۵ ۵ ۵" value="${p.off ? "" : (p.blocks[a.id] || []).join(" ")}"></td>`).join("")}<td>${fa(sum)} دقیقه</td><td><label><input type="checkbox" data-off="${k}" ${p.off ? "checked" : ""}> خالی</label></td><td>${button("برنامهٔ روز", "openDay", k, "small")}${button("ویرایش", "editDay", k, "small")}</td></tr>`;
  }
  $("#view").innerHTML =
    `<div class="row"><div><h2>برنامهٔ کلی تا پایان سال</h2><p class="muted">اینجا برنامه را بچین؛ در «امروز» فقط بخش‌ها و کارهای همان روز را ببین.</p></div>${button("＋ گروه / فعالیت", "addGroup", "", "primary")}</div><div class="card"><div class="actions"><label>سال شمسی<input id="planner-year" type="number" min="1300" max="1599" value="${y}" style="width:110px"></label><label>ماه<select id="planner-month">${months.map((n, i) => `<option value="${i + 1}" ${m === i + 1 ? "selected" : ""}>${n}</option>`).join("")}</select></label>${button("نمایش", "chooseMonth")}${button("ماه قبل", "shiftMonth", "-1")}${button("ماه بعد", "shiftMonth", "1")}${button("تعیین برنامهٔ یک بازه / ماه / سال", "bulk", "", "primary")}${button("ورود / خروجی اکسل", "nav", "excel")}</div><div class="notice">هر خانه، بخش‌های دقیقه‌ای است: <b dir="ltr">5 5 5</b> یعنی سه بخش پنج‌دقیقه‌ای؛ <b dir="ltr">3×5</b> هم همین معنی را دارد. تغییر هر خانه خودکار ذخیره می‌شود. خالی‌بودن خانهٔ هر فعالیت یعنی ارفاقی همان فعالیت. گزینهٔ «روز خالی» فقط برای استراحت کل روز است؛ کارهای پروژه‌ای باقی می‌مانند.</div></div><div class="table-wrap"><table><thead><tr><th>شماره روز</th><th>تاریخ / روز</th><th>بیدارباش</th>${activities.map((a) => `<th>${esc(a.name)}</th>`).join("")}<th>جمع برنامه</th><th>روز خالی</th><th>نمای روز</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
function changePlanInput(input) {
  const k = input.dataset.day,
    p = structuredClone(E.plan(state, k));
  try {
    if (input.dataset.field === "wake") p.wake = input.value;
    else {
      p.blocks[input.dataset.field] = E.parseParts(input.value);
      p.off = false;
    }
    E.setPlan(state, k, p);
    save();
    render();
  } catch (err) {
    toast(err.message);
    render();
  }
}
function planFields(p) {
  return (
    `<label>بیدارباش<input name="wake" type="time" value="${p.wake}" required></label><label><input name="off" type="checkbox" ${p.off ? "checked" : ""}> روز خالی / استراحت</label><p class="muted">بخش‌ها را با فاصله بنویس: ۵ ۵ ۵؛ جمع خودکار محاسبه می‌شود.</p>` +
    planActivities()
      .map(
        (a) =>
          `<label>${esc(a.name)}${a.special ? " • تخصصی" : ""}<input name="block-${a.id}" class="field numeric" value="${(p.blocks[a.id] || []).join(" ")}" placeholder="5 5 5"></label>`,
      )
      .join("")
  );
}
function readPlan(f) {
  const blocks = {};
  for (const a of planActivities())
    blocks[a.id] = E.parseParts(f.get("block-" + a.id) || "");
  return { wake: f.get("wake"), off: f.has("off"), blocks };
}
function editDay(k) {
  modal("برنامهٔ " + label(k), planFields(E.plan(state, k)), (f) => {
    E.setPlan(state, k, readPlan(f));
    save();
    closeModal();
    render();
  });
}
function addGroup() {
  modal(
    "گروه یا فعالیت جدید",
    '<label>نام فعالیت<input class="field" name="name" placeholder="مثلاً ترید" maxlength="80" required></label><label><input name="special" type="checkbox" checked> جزو کارهای تخصصی</label><label><input name="useful" type="checkbox" checked> در زمان مفید حساب شود</label>',
    (f) => {
      const name = f.get("name").trim();
      if (!name) throw Error("نام را بنویس");
      if (state.activities.some((a) => a.name === name))
        throw Error("این نام قبلاً ساخته شده");
      state.activities.push({
        id: "g-" + crypto.randomUUID(),
        name,
        custom: true,
        special: f.has("special"),
        useful: f.has("useful"),
      });
      save();
      closeModal();
      render();
    },
  );
}
function bulk() {
  const y = calendar.y,
    m = calendar.m,
    begin = E.fromPersian(y, m, 1),
    end = E.fromPersian(y, m, E.monthLength(y, m));
  modal(
    "برنامه‌ریزی بازه",
    `<div class="split"><label>از تاریخ شمسی${dateInput("start", begin)}</label><label>تا تاریخ شمسی${dateInput("end", end)}</label></div><p class="muted">برای برنامه تا آخر سال، تاریخ پایان را آخر اسفند بگذار.</p><label>روزهای هفته</label><div class="weekdays">${[6, 0, 1, 2, 3, 4, 5].map((i) => `<label><input name="weekday" value="${i}" type="checkbox" checked> ${week[i]}</label>`).join("")}</div><label>نوع تغییر<select class="field" name="mode"><option value="single">تنظیم یک فعالیت؛ بقیهٔ برنامه حفظ شود</option><option value="copy">تکرار کامل برنامهٔ یک روز</option><option value="off">روزها / هفته‌های خالی</option><option value="template">بازگشت به برنامهٔ پیش‌فرض هفته</option></select></label><label>فعالیت<select class="field" name="activity">${planActivities()
      .map((a) => `<option value="${a.id}">${esc(a.name)}</option>`)
      .join(
        "",
      )}</select></label><label>بخش‌های زمانی<input name="parts" class="field numeric" value="5 5 5"></label><label>بیدارباش (اختیاری)<input name="wake" type="time"></label><label>روز مبنا برای تکرار کامل${dateInput("source", selected)}</label>`,
    (f) => {
      const from = E.parsePersian(f.get("start")),
        to = E.parsePersian(f.get("end")),
        weekdays = f.getAll("weekday").map(Number),
        keys = E.range(from, to).filter((k) =>
          weekdays.includes(E.date(k).getDay()),
        );
      if (!keys.length) throw Error("حداقل یک روز انتخاب کن");
      const mode = f.get("mode"),
        parts = mode === "single" ? E.parseParts(f.get("parts")) : [],
        source =
          mode === "copy"
            ? structuredClone(E.plan(state, E.parsePersian(f.get("source"))))
            : null;
      if (
        !confirm(
          `برنامهٔ ${fa(keys.length)} روز تغییر کند؟ ثبت‌های زمانی و تاریخچه حذف نمی‌شوند.`,
        )
      )
        return;
      const draft = structuredClone(state);
      for (const k of keys) {
        if (mode === "template") {
          delete draft.plans[k];
          continue;
        }
        let p = source
          ? structuredClone(source)
          : structuredClone(E.plan(state, k));
        if (mode === "off") p.off = true;
        if (mode === "single") {
          p.blocks[f.get("activity")] = parts;
          p.off = false;
        }
        if (f.get("wake")) p.wake = f.get("wake");
        E.setPlan(draft, k, p);
      }
      state = draft;
      save();
      closeModal();
      render();
      toast("برنامهٔ بازه ذخیره شد");
    },
  );
}
function taskRow(t) {
  return `<div class="task ${t.done ? "done" : ""}"><input type="checkbox" data-task="${esc(t.id)}" ${t.done ? "checked" : ""} aria-label="تکمیل ${esc(t.title)}"><div class="content"><b class="title">${esc(t.title)}</b><br><small>${esc(t.project)}${t.tags ? " • " + esc(t.tags) : ""}${t.date ? " • " + label(t.date) : ""}${t.time ? " • " + esc(t.time) : ""}</small></div><div class="actions">${button("برنامه‌ریزی", "schedule", t.id, "small")}${button("ویرایش", "editTask", t.id, "small")}${button("×", "deleteTask", t.id, "small danger")}</div></div>`;
}
function renderProjects() {
  let html = `<div class="row"><div><h2>پروژه‌ها و کارها</h2><p class="muted">کار را به امروز یا یک تاریخ شمسی بفرست؛ ارتباطش با پروژه حفظ می‌شود.</p></div><div class="actions">${button("＋ کار جدید", "addTask", "", "primary")}${button("＋ پروژه", "addProject")}</div></div><div class="actions" style="margin-bottom:18px"><input id="search" placeholder="عنوان، پروژه، اصفهان، اداری…" value="${esc(filter)}">${button("جست‌وجو", "search")}</div><div class="grid">`;
  for (const p of state.projects) {
    const tasks = state.tasks.filter(
        (t) =>
          t.project === p &&
          (p + " " + t.title + " " + t.tags).includes(filter),
      ),
      done = tasks.filter((t) => t.done).length;
    html += card(
      esc(p),
      `<small>${fa(done)} از ${fa(tasks.length)} انجام‌شده</small><progress value="${done}" max="${tasks.length || 1}"></progress>${tasks.map(taskRow).join("") || '<p class="empty">هنوز کاری نیست.</p>'}`,
    );
  }
  $("#view").innerHTML = html + "</div>";
}
function addProject() {
  modal(
    "پروژهٔ جدید",
    '<label>نام پروژه<input name="name" class="field" required maxlength="100"></label>',
    (f) => {
      const n = f.get("name").trim();
      if (!n || state.projects.includes(n))
        throw Error("نام خالی یا تکراری است");
      state.projects.push(n);
      save();
      closeModal();
      render();
    },
  );
}
function editTask(id) {
  const t = state.tasks.find((t) => t.id === id);
  modal(
    t ? "ویرایش کار" : "کار یا ایدهٔ جدید",
    `<label>عنوان<input name="title" class="field" required maxlength="200" value="${esc(t?.title || "")}"></label><label>پروژه<select class="field" name="project">${state.projects.map((p) => `<option ${t?.project === p ? "selected" : ""}>${esc(p)}</option>`).join("")}</select></label><label>شهر / برچسب<input class="field" name="tags" placeholder="اصفهان، اداری" value="${esc(t?.tags || "")}" maxlength="200"></label>`,
    (f) => {
      const title = f.get("title").trim();
      if (!title) throw Error("عنوان را بنویس");
      if (t)
        Object.assign(t, {
          title,
          project: f.get("project"),
          tags: f.get("tags"),
        });
      else
        state.tasks.push({
          id: crypto.randomUUID(),
          title,
          project: f.get("project"),
          tags: f.get("tags"),
          done: false,
          date: "",
          time: "",
          lead: 0,
          completedAt: null,
        });
      save();
      closeModal();
      render();
    },
  );
}
function scheduleTask(id) {
  const t = state.tasks.find((t) => t.id === id);
  modal(
    "تعیین روز و یادآوری",
    `<b>${esc(t.title)}</b><p class="muted">پروژه: ${esc(t.project)}</p><label>تاریخ شمسی${dateInput("date", t.date || selected)}</label>${button("تاریخ امروز", "fillToday", "", "small")}<label>ساعت (اختیاری)<input name="time" type="time" value="${esc(t.time)}"></label><label>یادآوری<select name="lead" class="field"><option value="-1" ${t.reminder === false ? "selected" : ""}>بدون یادآوری</option>${[0, 5, 10, 15, 30, 60].map((n) => `<option value="${n}" ${t.reminder !== false && t.lead === n ? "selected" : ""}>${n ? fa(n) + " دقیقه قبل" : "سر ساعت"}</option>`).join("")}</select></label><div class="notice">یادآوری وقتی این صفحه باز و مرورگر فعال باشد اجرا می‌شود. برای اعلان سیستم، در تنظیمات اجازه بده.</div><label><input name="unschedule" type="checkbox"> حذف از تقویم؛ فقط در پروژه بماند</label>`,
    (f) => {
      if (f.has("unschedule")) {
        t.date = "";
        t.time = "";
      } else {
        t.date = E.parsePersian(f.get("date"));
        t.time = f.get("time");
        if (+f.get("lead") >= 0 && !t.time)
          throw Error("برای یادآوری، ساعت را هم تعیین کن");
      }
      t.lead = Math.max(0, +f.get("lead"));
      t.reminder = +f.get("lead") >= 0;
      delete state.delivered[t.id];
      save();
      closeModal();
      render();
      toast(
        t.date
          ? "کار به برنامهٔ " + label(t.date) + " اضافه شد"
          : "کار فقط در پروژه ماند",
      );
    },
  );
}
function reportRange() {
  const p = E.persian(selected);
  if (reportPeriod === "day") return [selected, selected];
  if (reportPeriod === "week") {
    const start = E.add(selected, -((E.date(selected).getDay() + 1) % 7));
    return [start, E.add(start, 6)];
  }
  if (reportPeriod === "month")
    return [
      E.fromPersian(p.y, p.m, 1),
      E.fromPersian(p.y, p.m, E.monthLength(p.y, p.m)),
    ];
  return [E.first(p.y), E.add(E.first(p.y + 1), -1)];
}
function renderReports() {
  const [from, to] = reportRange(),
    s = E.stats(state, from, to);
  let html =
    dayControl() +
    `<h2>برنامه و عملکرد</h2><div class="actions" style="margin-bottom:18px">${[
      ["day", "روز"],
      ["week", "هفته"],
      ["month", "ماه"],
      ["year", "سال"],
    ]
      .map(([id, n]) =>
        button(n, "reportPeriod", id, reportPeriod === id ? "primary" : ""),
      )
      .join(
        "",
      )}<small>${label(from)} تا ${label(to)}</small></div><div class="grid">${card("انجام برنامه", `<div class="stat">${fa(s.percent)}٪</div><small>${fa(s.done)} از ${fa(s.count)} بخش</small>`)}${card("زمان مفید واقعی", `<div class="stat">${fa(Math.round(s.actual))} دقیقه</div>`)}${card("هدف برنامه", `<div class="stat">${fa(s.planned)} دقیقه</div>`)}${card("کارهای پروژه‌ای", `<div class="stat">${fa(s.tasksDone)} از ${fa(s.tasks)}</div>`)}</div>`;
  let buckets = [];
  if (reportPeriod === "year") {
    const y = E.persian(selected).y;
    buckets = months.map((n, i) => ({
      name: n,
      from: E.fromPersian(y, i + 1, 1),
      to: E.fromPersian(y, i + 1, E.monthLength(y, i + 1)),
    }));
  } else
    buckets = E.range(from, to).map((k) => ({
      name: reportPeriod === "day" ? "این روز" : label(k).slice(5),
      from: k,
      to: k,
    }));
  const chart = buckets.map((b) => ({ ...b, s: E.stats(state, b.from, b.to) })),
    max = Math.max(1, ...chart.flatMap((b) => [b.s.planned, b.s.actual]));
  html += card(
    "پیشرفت برنامه و زمان واقعی",
    `<div class="legend"><span><i class="dot" style="background:#c5dcd0"></i>برنامه</span><span><i class="dot" style="background:#26936c"></i>بخش انجام‌شده</span><span><i class="dot" style="background:#e4b85a"></i>زمان مفید واقعی</span></div><div class="bars">${chart.map((b) => `<div class="chart-line"><span>${b.name}</span><div class="tracks"><div class="bar planned" style="width:${(b.s.planned / max) * 100}%"></div><div class="bar completed" style="width:${(b.s.completed / max) * 100}%"></div><div class="bar actual" style="width:${(b.s.actual / max) * 100}%"></div></div><span>${fa(b.s.percent)}٪</span></div>`).join("")}</div><p class="muted" style="margin-top:15px">تیک دستی، انجام بخش را ثبت می‌کند؛ زمان واقعی فقط با ثبت فعالیت محاسبه می‌شود. استراحت و وقفه‌ها جزو زمان مفید نیستند.</p>`,
  );
  html +=
    card(
      "تفکیک زمان فعالیت‌ها",
      state.activities
        .map((a) => {
          const n = E.range(from, to).reduce(
            (v, k) => v + E.minutes(state, k, a.id),
            0,
          );
          return `<div class="row"><span>${esc(a.name)}</span><b>${fa(Math.round(n))} دقیقه</b></div>`;
        })
        .join(""),
    ) +
    `<div class="actions">${button("کپی گزارش", "copyReport")}${button("خروجی CSV", "csv")}${button("پشتیبان JSON", "backup")}</div>`;
  $("#view").innerHTML = html;
}
function renderSettings() {
  const permitted =
    "Notification" in window ? Notification.permission : "unsupported";
  $("#view").innerHTML =
    card(
      "یادآوری مرورگر",
      `<p>وضعیت اعلان: <b>${{ granted: "مجاز", denied: "مسدود", default: "هنوز اجازه ندادی", unsupported: "در این مرورگر پشتیبانی نمی‌شود" }[permitted]}</b></p>${button("فعال‌کردن اعلان‌ها", "notifications", "", "primary")}<p class="muted">اگر اعلان مسدود است از تنظیمات سایت در مرورگر اجازه بده. حتی بدون اعلان سیستم، هنگام بازبودن صفحه پیام داخل برنامه نمایش داده می‌شود.</p><div class="notice">صفحه باید باز بماند. مرورگرِ بسته، خواب کامپیوتر و محدودیت تب پس‌زمینه می‌توانند یادآوری را عقب بیندازند. این نسخه، زنگ بیدارباش اندروید نیست.</div>`,
    ) +
    card(
      "گروه‌ها و فعالیت‌ها",
      planActivities()
        .map(
          (a) =>
            `<div class="row"><span>${esc(a.name)} ${a.special ? "• تخصصی" : ""}</span><small>${a.useful ? "زمان مفید" : "غیرمفید"}</small></div>`,
        )
        .join("") + button("＋ فعالیت جدید", "addGroup"),
    ) +
    card(
      "برنامهٔ پیش‌فرض هفته",
      `<p class="muted">برای روزهایی که هنوز برنامهٔ اختصاصی ندارند؛ روزهای ویرایش‌شده تغییر نمی‌کنند.</p><div class="actions">${[6, 0, 1, 2, 3, 4, 5].map((i) => button(week[i], "editTemplate", String(i))).join("")}</div><label style="margin-top:16px">تاریخ شروع برای شمارهٔ روز<input id="start-date" class="field" value="${label(state.startDate)}"></label>${button("ذخیرهٔ تاریخ شروع", "startDate")}`,
    ) +
    card(
      "پشتیبان و انتقال اطلاعات",
      `<div class="actions">${button("پشتیبان کامل JSON", "backup", "", "primary")}${button("CSV زمان‌ها", "csv")}${button("CSV جدول برنامه", "planCsv")}</div><p class="muted">دادهٔ نسخهٔ قبلی خودکار منتقل می‌شود. پشتیبان این نسخه شامل برنامهٔ روزها، گروه‌ها، تیک‌ها و کارهای تاریخ‌دار است. با بازیابی، دادهٔ فعلی جایگزین می‌شود؛ زمان‌سنج فعال منتقل نمی‌شود.</p><label>بازیابی پشتیبان<input id="restore" type="file" accept=".json,application/json" class="field"></label>`,
    );
}
function exportFile(content, type, name) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function backup() {
  const copy = structuredClone(state);
  copy.active = null;
  copy.paused = null;
  copy.series = null;
  exportFile(
    JSON.stringify(copy, null, 2),
    "application/json",
    "raval-" + todayKey() + ".json",
  );
}
function cell(v) {
  let s = String(v ?? "");
  if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
function csv() {
  const rows = [
    [
      "date",
      "jalali",
      "activity",
      "start",
      "end",
      "minutes",
      "note",
      "assigned_plan_date",
    ],
    ...state.entries.map((e) => [
      E.key(new Date(e.start)),
      E.label(E.key(new Date(e.start))),
      e.name,
      new Date(e.start).toISOString(),
      new Date(e.end).toISOString(),
      ((e.end - e.start) / 60000).toFixed(2),
      e.note,
      e.planDate || "",
    ]),
  ];
  exportFile(
    "\ufeff" + rows.map((r) => r.map(cell).join(",")).join("\r\n"),
    "text/csv;charset=utf-8",
    "raval-times-" + todayKey() + ".csv",
  );
}
function planCsv() {
  const year = calendar.y,
    rows = [
      [
        "jalali_date",
        "day",
        "wake",
        "activity",
        "parts_minutes",
        "planned_minutes",
        "completed_parts",
      ],
    ];
  for (const k of E.range(E.first(year), E.add(E.first(year + 1), -1))) {
    const p = E.plan(state, k),
      bs = E.blocks(state, k);
    for (const a of planActivities()) {
      const list = bs.filter((b) => b.id === a.id);
      rows.push([
        E.label(k),
        week[E.date(k).getDay()],
        p.wake,
        a.name,
        list.map((b) => b.minutes).join(" + "),
        list.reduce((n, b) => n + b.minutes, 0),
        list.filter((b) => state.completions[b.key]).length,
      ]);
    }
  }
  exportFile(
    "\ufeff" + rows.map((r) => r.map(cell).join(",")).join("\r\n"),
    "text/csv;charset=utf-8",
    "raval-plan-" + year + ".csv",
  );
}
async function restore(file) {
  if (!file) return;
  try {
    if (file.size > 8 * 1024 * 1024)
      throw Error("حداکثر اندازهٔ پشتیبان ۸ مگابایت است");
    const next = E.migrate(JSON.parse(await file.text()));
    if (!confirm("اطلاعات فعلی با فایل جایگزین شود؟ قبل از آن پشتیبان بگیر."))
      return;
    next.active = null;
    next.paused = null;
    next.series = null;
    state = next;
    storageFailed = false;
    $("#storage-warning").innerHTML = "";
    save();
    render();
    toast("بازیابی کامل شد");
  } catch (err) {
    toast(err.message);
  }
}
async function copyReport() {
  const [from, to] = reportRange(),
    s = E.stats(state, from, to),
    text = `روال • ${label(from)} تا ${label(to)}\nانجام برنامه: ${fa(s.percent)}٪\nبخش‌ها: ${fa(s.done)} از ${fa(s.count)}\nزمان مفید واقعی: ${fa(Math.round(s.actual))} دقیقه\nکارها: ${fa(s.tasksDone)} از ${fa(s.tasks)}`;
  try {
    await navigator.clipboard.writeText(text);
    toast("کپی شد");
  } catch {
    modal(
      "کپی گزارش",
      `<textarea class="field" rows="8" readonly>${esc(text)}</textarea>`,
      closeModal,
    );
  }
}
function updateClock() {
  const a = state.active,
    c = $("#clock");
  if (a && c)
    c.textContent = duration(
      a.deadline ? a.deadline - Date.now() : Date.now() - a.start,
    );
}
function taskToken(t) {
  return [t.date, t.time, t.lead].join("|");
}
function reminders() {
  if (reminderChecking) return;
  reminderChecking = true;
  try {
    const now = Date.now();
    for (const t of state.tasks) {
      const due = E.reminderTime(t);
      if (
        t.done ||
        t.reminder === false ||
        due === null ||
        due > now ||
        now - due > 86400000 ||
        state.delivered[t.id] === taskToken(t)
      )
        continue;
      state.delivered[t.id] = taskToken(t);
      save();
      toast("یادآوری: " + t.title + " • " + t.project);
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          const notification = new Notification("روال • " + t.title, {
            body: t.project + " • " + label(t.date) + " " + t.time,
            tag: t.id,
          });
          notification.onclick = () => {
            window.focus();
            selected = t.date;
            tab = "today";
            render();
            notification.close();
          };
        } catch {}
      }
    }
  } finally {
    reminderChecking = false;
  }
}
function tick() {
  const a = state.active;
  if (a?.deadline && Date.now() >= a.deadline) {
    if (state.series && !state.series.paused) {
      E.advanceSeries(state, Date.now());
      toast(state.active ? "شروع " + state.active.name : "جلسه تمام شد ✓");
    } else {
      E.settle(state, Date.now());
      toast("بخش «" + a.name + "» انجام شد ✓");
    }
    save();
    render();
  } else updateClock();
  reminders();
}
function seriesDialog(id) {
  modal(
    "کار و استراحت • " + esc(groupName(id)),
    `<p>بخش‌های انجام‌نشدهٔ این روز به ترتیب اجرا می‌شوند.</p><label>استراحت بین بخش‌ها (دقیقه)<input class="field" name="rest" type="number" min="0" max="180" value="10" required></label>`,
    (f) => {
      E.startSeries(state, selected, id, +f.get("rest"));
      save();
      closeModal();
      render();
    },
  );
}
const actions = {
  graceExpand: (id) => {
    if (graceExpanded.has(id)) graceExpanded.delete(id);
    else graceExpanded.add(id);
    render();
  },
  excelCommit: commitExcel,
  excelMonth: () => exportExcel(false),
  excelYear: () => exportExcel(true),
  excelCompact: () => exportExcel(true, "monthly"),
  excelClear: () => {
    pendingExcel = null;
    render();
  },
  pickActivity: (id) => {
    $("#activity-name").value = groupName(id);
    updateActivityMatches();
  },
  series: seriesDialog,
  nav: navigate,
  shiftDay: (n) => {
    selected = E.add(selected, +n);
    render();
  },
  chooseDay: () => {
    selected = E.parsePersian($("#selected-date").value);
    render();
  },
  goToday: () => {
    selected = todayKey();
    render();
  },
  openDay: (k) => {
    selected = k;
    navigate("today");
  },
  editDay,
  addGroup,
  bulk,
  block: startBlock,
  quick,
  stop,
  wake,
  resume: () => {
    E.resume(state);
    save();
    render();
  },
  activityDialog,
  since: sinceDialog,
  removeEntry: (i) => {
    if (confirm("این ثبت حذف شود؟ تیک برنامه تغییر نمی‌کند.")) {
      state.entries.splice(+i, 1);
      save();
      render();
    }
  },
  chooseMonth: () => {
    const y = +$("#planner-year").value,
      m = +$("#planner-month").value;
    E.fromPersian(y, m, 1);
    calendar = { y, m, d: 1 };
    render();
  },
  shiftMonth: (n) => {
    let y = calendar.y,
      m = calendar.m + +n;
    if (m === 0) {
      m = 12;
      y--;
    }
    if (m === 13) {
      m = 1;
      y++;
    }
    E.fromPersian(y, m, 1);
    calendar = { y, m, d: 1 };
    render();
  },
  search: () => {
    filter = $("#search").value;
    render();
  },
  addProject,
  addTask: () => editTask(""),
  editTask,
  schedule: scheduleTask,
  fillToday: () => {
    $("#form [name=date]").value = label(todayKey());
  },
  deleteTask: (id) => {
    if (confirm("این کار حذف شود؟")) {
      state.tasks = state.tasks.filter((t) => t.id !== id);
      save();
      render();
    }
  },
  reportPeriod: (p) => {
    reportPeriod = p;
    render();
  },
  backup,
  csv,
  planCsv,
  copyReport,
  closeModal,
  rawBackup: () =>
    exportFile(source || "", "application/json", "raval-original.json"),
  editTemplate: (i) =>
    modal("پیش‌فرض " + week[+i], planFields(state.templates[+i]), (f) => {
      const p = readPlan(f);
      const probe = structuredClone(state);
      probe.templates[+i] = p;
      E.validate(probe);
      state.templates[+i] = p;
      save();
      closeModal();
      render();
    }),
  startDate: () => {
    state.startDate = E.parsePersian($("#start-date").value);
    save();
    toast("ذخیره شد");
  },
  notifications: async () => {
    if (!("Notification" in window))
      return toast("اعلان در این مرورگر پشتیبانی نمی‌شود");
    await Notification.requestPermission();
    render();
  },
};
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  try {
    const result = actions[b.dataset.action]?.(b.dataset.arg);
    if (result?.catch) result.catch((err) => toast(err.message));
  } catch (err) {
    toast(err.message);
  }
});
document.addEventListener("change", (e) => {
  const el = e.target;
  try {
    if (el.dataset.complete) complete(el.dataset.complete, el.checked);
    if (el.dataset.task) {
      const t = state.tasks.find((t) => t.id === el.dataset.task);
      t.done = el.checked;
      t.completedAt = t.done ? Date.now() : null;
      save();
      render();
    }
    if (el.dataset.day) changePlanInput(el);
    if (el.dataset.off) {
      const p = structuredClone(E.plan(state, el.dataset.off));
      p.off = el.checked;
      E.setPlan(state, el.dataset.off, p);
      save();
      render();
    }
    if (el.id === "restore") restore(el.files[0]);
    if (el.id === "excel-file") importExcel(el.files[0]);
  } catch (err) {
    toast(err.message);
  }
});
$("#form").addEventListener("submit", (e) => {
  e.preventDefault();
  try {
    dialogSubmit?.(new FormData(e.target));
  } catch (err) {
    toast(err.message);
  }
});
window.addEventListener("storage", (e) => {
  if (e.key === storageKey && e.newValue) {
    try {
      state = E.migrate(JSON.parse(e.newValue));
      render();
    } catch {
      toast("دادهٔ تب دیگر خوانده نشد؛ پشتیبان بگیر.");
    }
  }
});
save();
render();
tick();
setInterval(tick, 1000);

document.addEventListener("input", (e) => {
  if (e.target.id === "activity-name") updateActivityMatches();
});

function loadExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (excelLoader) return excelLoader;
  excelLoader = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "vendor/exceljs.min.js?v=4.4.0";
    script.onload = () => resolve(window.ExcelJS);
    script.onerror = () => {
      excelLoader = null;
      reject(Error("ابزار اکسل بارگذاری نشد؛ صفحه را تازه کن."));
    };
    document.head.append(script);
  });
  return excelLoader;
}
function renderExcel() {
  let html = card(
    "برنامه و کارها را از اکسل وارد کن",
    `<p>فایل TRACK.xlsx و قالب خود روال پشتیبانی می‌شوند. برنامهٔ روزانه، گروه‌ها و کارهای پروژه هرکدام در بخش مربوط وارد می‌شوند.</p><label>انتخاب فایل Excel (.xlsx)<input class="field" id="excel-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ${excelBusy ? "disabled" : ""}></label>${excelBusy ? "<p>در حال خواندن فایل…</p>" : ""}<div class="notice">فایل فقط در مرورگر خودت خوانده می‌شود. قبل از ورود، پیش‌نمایش را ببین؛ ورود اکسل، زمان واقعی یا تیک انجام فعالیت‌ها ایجاد نمی‌کند.</div>`,
  );
  html += card(
    "جدول اکسل قابل ویرایش",
    `<p>برنامهٔ ماه ${months[calendar.m - 1]} ${fa(calendar.y)} یا کل سال را بگیر، در جدول پیوسته به سبک TRACK ویرایش کن و دوباره وارد کن. ماه و سال را از «برنامهٔ کلی» انتخاب کن.</p><div class="actions">${button("دریافت اکسل این ماه", "excelMonth", "", "primary")}${button("دریافت اکسل سال به سبک TRACK", "excelYear")}${button("نسخهٔ ماهانهٔ فشرده", "excelCompact")}</div><p><a href="raval-template.xlsx?v=2.4.0" download>دانلود قالب خام برنامه و کارها</a></p><small>شیت برنامهٔ روزانه: جدول پیوسته با بخش‌های زمانی، جمع‌های مشکی و خانه‌های ارفاقی سبز؛ شیت «کارها»: پروژه، عنوان، برچسب، تاریخ و ساعت؛ شیت «گروه‌ها»: گروه‌های دلخواه.</small>`,
  );
  if (pendingExcel) {
    const p = pendingExcel,
      existing = p.plans.filter((r) => state.plans[r.date]).length;
    html += card(
      "پیش‌نمایش " + esc(p.fileName),
      `<div class="grid"><div><b>${fa(p.plans.length)}</b> روز معتبر</div><div><b>${fa(p.tasks.length)}</b> کار پروژه‌ای</div><div><b>${fa(p.groups.length)}</b> گروه جدید</div></div><p>خطا: ${fa(p.errors.length)} ردیف • خانهٔ ستاره‌دار ارفاقی: ${fa(p.stars)}</p>${p.stars ? '<div class="notice">خانه‌های خالی یا * برای همان فعالیت ارفاقی‌اند؛ دقیقه یا انجام‌شده حساب نمی‌شوند و کل روز را تعطیل نمی‌کنند.</div>' : ""}${p.warnings.map((w) => '<p class="notice">' + esc(w) + "</p>").join("")}${
        p.errors.length
          ? '<div class="notice"><b>ردیف‌های زیر وارد نمی‌شوند؛ می‌توانی فایل را اصلاح و دوباره انتخاب کنی:</b><ul>' +
            p.errors
              .slice(0, 20)
              .map(
                (e) =>
                  "<li>" +
                  esc(e.sheet) +
                  "، ردیف " +
                  fa(e.row) +
                  ": " +
                  esc(e.message) +
                  "</li>",
              )
              .join("") +
            "</ul>" +
            (p.errors.length > 20 ? "موارد بیشتری هم وجود دارد." : "") +
            "</div>"
          : ""
      }<div class="table-wrap"><table><thead><tr><th>تاریخ شمسی</th><th>بیدارباش</th><th>برنامهٔ بخش‌ها (دقیقه)</th></tr></thead><tbody>${p.plans
        .slice(0, 7)
        .map(
          (r) =>
            "<tr><td>" +
            label(r.date) +
            "</td><td>" +
            r.plan.wake +
            "</td><td>" +
            Object.entries(r.plan.blocks)
              .filter(([, list]) => list.length)
              .map(
                ([id, list]) =>
                  esc(E.activity(p.draft, id).name) +
                  ": " +
                  list.map(fa).join(" + "),
              )
              .join(" • ") +
            "</td></tr>",
        )
        .join(
          "",
        )}</tbody></table></div><p class="muted">نمایش چند ردیف اول؛ همهٔ ردیف‌های معتبر با تأیید وارد می‌شوند.</p><label><input id="excel-overwrite" type="checkbox"> برنامه‌ها و کارهای موجود با اطلاعات فایل جایگزین شوند</label><small>${fa(existing)} روز در حال حاضر برنامهٔ اختصاصی دارند؛ بدون این انتخاب حفظ می‌شوند. ثبت‌های زمانی و بقیهٔ تاریخ‌ها حذف نمی‌شوند.</small>${p.startDate ? '<label><input id="excel-start" type="checkbox" checked> شروع شماره‌روز از ' + label(p.startDate) + "، مطابق جدول اکسل</label>" : ""}<div class="actions" style="margin-top:16px">${button(p.errors.length ? "ورود ردیف‌های معتبر" : "تأیید و ورود اطلاعات", "excelCommit", "", "primary")}${button("انصراف", "excelClear")}</div>`,
    );
  }
  $("#view").innerHTML = html;
}
async function importExcel(file) {
  if (!file || excelBusy) return;
  if (!/\.xlsx$/i.test(file.name))
    return toast("فایل را با پسوند xlsx ذخیره کن.");
  if (file.size > 8 * 1024 * 1024)
    return toast("حداکثر اندازهٔ فایل ۸ مگابایت است.");
  excelBusy = true;
  pendingExcel = null;
  render();
  try {
    const ExcelJS = await loadExcelJS(),
      workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer(), {
      ignoreNodes: [
        "dataValidations",
        "conditionalFormatting",
        "drawing",
        "picture",
      ],
    });
    const report = window.RavalExcel.readWorkbook(
      workbook,
      state,
      () => "g-" + crypto.randomUUID(),
    );
    pendingExcel = { ...report, fileName: file.name };
  } catch (err) {
    toast("ورود اکسل انجام نشد: " + err.message);
  } finally {
    excelBusy = false;
    if (tab === "excel") render();
  }
}
function commitExcel() {
  if (!pendingExcel) return;
  if (state.active)
    return toast("ابتدا فعالیت در حال اجرا را پایان بده؛ سپس فایل را وارد کن.");
  const result = window.RavalExcel.applyReport(state, pendingExcel, {
    overwrite: $("#excel-overwrite").checked,
    setStart: !!$("#excel-start")?.checked,
  });
  state = result.state;
  const dates = pendingExcel.plans.map((r) => r.date);
  pendingExcel = null;
  selected = dates.includes(todayKey()) ? todayKey() : dates[0] || todayKey();
  calendar = E.persian(selected);
  save();
  tab = "today";
  render();
  toast(
    `${fa(result.plans)} روز و ${fa(result.tasks)} کار وارد شد؛ ${fa(result.skipped)} مورد موجود حفظ شد.`,
  );
}
async function exportExcel(fullYear, layout = "track") {
  try {
    const ExcelJS = await loadExcelJS(),
      workbook = window.RavalExcel.buildWorkbook(ExcelJS, state, {
        year: calendar.y,
        month: fullYear ? null : calendar.m,
        layout,
      });
    const data = await workbook.xlsx.writeBuffer();
    exportFile(
      data,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      `raval-${calendar.y}${fullYear ? "" : "-" + calendar.m}.xlsx`,
    );
  } catch (err) {
    toast("ساخت فایل اکسل ناموفق بود: " + err.message);
  }
}
