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
  excelFileName = "",
  excelError = "",
  excelLoader = null;
let state,
  tab = "today",
  selected = todayKey(),
  calendar = E.persian(selected),
  reportPeriod = "week",
  plannerSpan = "month",
  showArchived = false,
  lastReviewCheck = 0,
  filter = "",
  storageFailed = false,
  reminderChecking = false,
  dialogSubmit = null;
let source = null;
try {
  source = localStorage.getItem(storageKey);
  state = source ? E.migrate(JSON.parse(source)) : E.fresh();
  mobileSeed();
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
    mobileSync();
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
    .map(([id, name]) =>
      button(
        V.icon(id) + "<span>" + name + "</span>",
        "nav",
        id,
        tab === id ? "on" : "",
      ),
    )
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
  mobileDecorate();
  updateClock();
}
function dayControl() {
  return `<div class="day-control">${button("روز قبل", "shiftDay", "-1", "small")}<label class="sr-only" for="selected-date">تاریخ شمسی</label><input id="selected-date" inputmode="numeric" value="${label(selected)}" aria-label="تاریخ شمسی">${button("برو", "chooseDay")}${button("روز بعد", "shiftDay", "1", "small")}${button("امروز", "goToday", "", selected === todayKey() ? "primary" : "")}<span class="muted">${week[E.date(selected).getDay()]}</span></div>`;
}
function renderToday() {
  V.today();
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
  V.planner();
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
  return V.taskRow(t);
}
function renderProjects() {
  V.projects();
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
function editTask(id, presetDate = "") {
  const t = state.tasks.find((t) => t.id === id);
  modal(
    t ? "ویرایش کار" : "کار یا ایدهٔ جدید",
    `<label>عنوان<input name="title" class="field" required maxlength="200" value="${esc(t?.title || "")}"></label><label>پروژه<select class="field" name="project">${state.projects.map((p) => `<option ${t?.project === p ? "selected" : ""}>${esc(p)}</option>`).join("")}</select></label><label>شهر / برچسب (اختیاری)<input class="field" name="tags" placeholder="اصفهان، اداری" value="${esc(t?.tags || "")}" maxlength="200"></label><div class="split"><label>تاریخ شمسی (اختیاری)${dateInput("date", t?.date || presetDate, false)}</label><label>ساعت (اختیاری)<input class="field" name="time" type="time" value="${esc(t?.time || "")}"></label></div><label>یادآوری<select name="lead" class="field"><option value="-1" ${t?.reminder !== true ? "selected" : ""}>بدون یادآوری</option>${[0, 5, 10, 15, 30, 60].map((n) => `<option value="${n}" ${t?.reminder === true && t.lead === n ? "selected" : ""}>${n ? fa(n) + " دقیقه قبل" : "سر ساعت"}</option>`).join("")}</select></label>`,
    (f) => {
      const title = f.get("title").trim();
      if (!title) throw Error("عنوان را بنویس");
      const date = f.get("date").trim() ? E.parsePersian(f.get("date")) : "",
        time = f.get("time");
      if (time && !date) throw Error("برای ساعت، تاریخ را هم مشخص کن");
      if (+f.get("lead") >= 0 && (!date || !time))
        throw Error("یادآوری نیاز به تاریخ و ساعت دارد");
      const fields = {
        title,
        project: f.get("project"),
        tags: f.get("tags"),
        date,
        time,
        lead: Math.max(0, +f.get("lead")),
        reminder: +f.get("lead") >= 0,
      };
      if (t) {
        E.changeTask(state, t.id, fields);
        delete state.delivered[t.id];
      } else
        state.tasks.push({
          id: crypto.randomUUID(),
          ...fields,
          done: false,
          progress: 0,
          archived: false,
          remaining: "",
          history: [],
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
      const unscheduled = f.has("unschedule"),
        date = unscheduled ? "" : E.parsePersian(f.get("date")),
        clock = unscheduled ? "" : f.get("time"),
        lead = +f.get("lead");
      if (!unscheduled && lead >= 0 && !clock)
        throw Error("برای یادآوری، ساعت را هم تعیین کن");
      E.changeTask(state, id, {
        date,
        time: clock,
        lead: Math.max(0, lead),
        reminder: !unscheduled && lead >= 0,
      });
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
  V.reports();
}
function renderSettings() {
  V.settings();
}
function exportFile(content, type, name) {
  AndroidNative.saveFile(name,type,content);
}
function webExportFile(content, type, name) {
  const url = URL.createObjectURL(new Blob([content], { type })),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function backup() {
  const copy = structuredClone(state);
  if (copy.active) E.settle(copy, Date.now());
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
  const a = state.active || state.paused,
    c = $("#clock");
  if (c) {
    const now = Date.now(),
      paused = !state.active;
    const ms = !a
      ? 0
      : a.deadline
        ? paused
          ? a.block
            ? Math.max(0, a.target - (state.progress[a.block] || 0))
            : a.remaining
          : Math.max(0, a.deadline - now)
        : paused
          ? a.carry || 0
          : (a.carry || 0) + now - a.start;
    c.textContent = duration(ms);
    const ring = $("#timer-ring");
    if (ring) {
      const done = a?.target ? 1 - ms / a.target : 0;
      ring.style.setProperty(
        "--progress",
        Math.max(0, Math.min(100, done * 100)) + "%",
      );
    }
  }
  const live = $("#live-useful");
  if (live) {
    let n = E.minutes(state, selected);
    if (state.active && E.activity(state, state.active.activity)?.useful) {
      const [lo, hi] = E.interval(selected),
        end = Math.min(Date.now(), state.active.deadline || Infinity, hi);
      n += Math.max(0, end - Math.max(lo, state.active.start)) / 60000;
    }
    live.textContent = V.minute(n);
  }
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
        t.archived ||
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
  return mobileTick();
}
function webTick() {
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
  if (Date.now() - lastReviewCheck > 60000) {
    lastReviewCheck = Date.now();
    maybeReview();
  }
}
function seriesDialog(id) {
  modal(
    "کار و استراحت • " + esc(groupName(id)),
    `<p>بخش‌های انجام‌نشدهٔ این روز به ترتیب اجرا می‌شوند.</p><label>استراحت بین بخش‌ها (دقیقه)<input class="field" name="rest" type="number" min="0" max="180" value="10" required></label>`,
    (f) => {
      state.mobileRestMinutes=+f.get("rest"); const next=E.blocks(state,selected).find(b=>b.id===id&&!state.completions[b.key]);if(next)E.startBlock(state,next);
      save();
      closeModal();
      render();
    },
  );
}
const actions = {
  plannerSpan: (span) => {
    plannerSpan = span;
    render();
  },
  plannerShift: (n) => {
    selected = E.add(selected, +n);
    calendar = E.persian(selected);
    render();
  },
  matrixToggle: (key) => complete(key, !state.completions[key]),
  pause: () => {
    E.pause(state);
    save();
    render();
  },
  finishFocus: () => {
    E.settle(state, Date.now());
    state.paused = null;
    state.series = null;
    save();
    render();
  },
  quickTyped: () => {
    const name = $("#quick-activity").value.trim(),
      a = E.findActivity(state, name);
    if (a) {
      E.interrupt(state, a.id);
      save();
      render();
    } else {
      activityDialog();
      $("#activity-name").value = name;
      updateActivityMatches();
    }
  },
  addTodayTask: () => editTask("", selected),
  toggleArchive: () => {
    showArchived = !showArchived;
    render();
  },
  restoreTask: (id) => {
    E.resolveTask(state, id, "restore");
    save();
    render();
  },
  openReview: () => openReview(),
  reviewTask: (id) => openReview(id),
  reviewAction: (arg) => {
    const p = JSON.parse(arg);
    resolveReview(p.id, p.action);
  },
  taskHistory: (id) => showTaskHistory(id),
  reviewClock: () => {
    const value = $("#review-time").value;
    if (!value) throw Error("ساعت را مشخص کن");
    state.reviewTime = value;
    save();
    toast("زمان مرور ذخیره شد");
  },
  analysis: () => {
    tab = "settings";
    render();
    $("#analysis-details").open = true;
    $("#analysis-details").scrollIntoView({ behavior: "smooth" });
  },

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
      E.resolveTask(state, id, "archive");
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
      E.resolveTask(state, t.id, el.checked ? "done" : "reopen");
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
    const timer = setTimeout(
      () =>
        fail(
          "دریافت ابزار اکسل طول کشید؛ اتصال اینترنت را بررسی کن و فایل را دوباره انتخاب کن.",
        ),
      20000,
    );
    function fail(message) {
      clearTimeout(timer);
      script.remove();
      excelLoader = null;
      reject(Error(message));
    }
    script.src = "vendor/exceljs.min.js?v=4.4.0";
    script.onload = () => {
      clearTimeout(timer);
      if (!window.ExcelJS)
        return fail("ابزار اکسل کامل دریافت نشد؛ فایل را دوباره انتخاب کن.");
      resolve(window.ExcelJS);
    };
    script.onerror = () =>
      fail(
        "ابزار اکسل دریافت نشد؛ اتصال اینترنت را بررسی کن و فایل را دوباره انتخاب کن.",
      );
    document.head.append(script);
  });
  return excelLoader;
}
function renderExcel() {
  let html =
    V.heading("اکسل", "مرجع برنامهٔ کلی تو، فایل اکسل است.") +
    card(
      "برنامه و کارها را از اکسل وارد کن",
      `<p>فایل TRACK.xlsx و قالب خود روال پشتیبانی می‌شوند. برنامهٔ روزانه، گروه‌ها و کارهای پروژه هرکدام در بخش مربوط وارد می‌شوند.</p><label>انتخاب فایل Excel (.xlsx)<input class="field" id="excel-file" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ${excelBusy ? "disabled" : ""}></label>${excelFileName ? `<p role="status">فایل انتخاب‌شده: <b>${esc(excelFileName)}</b>${excelBusy ? " — در حال خواندن…" : pendingExcel ? " — خوانده شد؛ ورود اطلاعات را تأیید کن." : ""}</p>` : ""}${excelError ? `<div class="notice" role="alert"><b>فایل وارد نشد</b><p>${esc(excelError)}</p><p>فایل را دوباره انتخاب کن. اطلاعات فعلی تغییری نکرده است.</p></div>` : ""}<div class="notice">فایل فقط در مرورگر خودت خوانده می‌شود. قبل از ورود، پیش‌نمایش را ببین؛ ورود اکسل، زمان واقعی یا تیک انجام فعالیت‌ها ایجاد نمی‌کند.</div>`,
    );
  const templateCard = card(
    "قالب ورودی برنامه و کارها",
    `<p class="muted">قالب به سبک فایل خودت است؛ برنامهٔ روزانه، گروه‌ها و کارهای پروژه را در اکسل وارد کن و همین‌جا بارگذاری کن.</p><a class="button primary" href="raval-template.xlsx?v=3.0.0" download>${V.icon("excel")}دانلود قالب خام برنامه و کارها</a>`,
  );
  if (pendingExcel) {
    const p = pendingExcel,
      existing = p.plans.filter((r) => state.plans[r.date]).length;
    const activePlans = p.plans.filter(
        (r) =>
          !r.plan.off && Object.values(r.plan.blocks).some((a) => a.length),
      ),
      previewPlans = activePlans.length ? activePlans : p.plans;
    html += card(
      "پیش‌نمایش " + esc(p.fileName),
      `<div id="excel-preview" tabindex="-1"><p><b>مرحلهٔ آخر: برای اضافه‌شدن برنامه‌ها، دکمهٔ زیر را بزن.</b></p><div class="actions">${p.plans.length || p.tasks.length || p.groups.length ? button("واردکردن برنامه‌ها", "excelCommit", "", "primary") : "هیچ برنامه یا کار معتبری پیدا نشد؛ پیام‌های زیر را بررسی کن."}</div></div><div class="grid"><div><b>${fa(p.plans.length)}</b> روز معتبر • ${fa(activePlans.length)} روز دارای فعالیت</div><div><b>${fa(p.tasks.length)}</b> کار پروژه‌ای</div><div><b>${fa(p.groups.length)}</b> گروه جدید</div></div><p>خطا: ${fa(p.errors.length)} ردیف • خانهٔ ستاره‌دار ارفاقی: ${fa(p.stars)}</p>${p.stars ? '<div class="notice">خانه‌های خالی یا * برای همان فعالیت ارفاقی‌اند؛ دقیقه یا انجام‌شده حساب نمی‌شوند و کل روز را تعطیل نمی‌کنند.</div>' : ""}${p.warnings.map((w) => '<p class="notice">' + esc(w) + "</p>").join("")}${
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
      }<div class="table-wrap"><table><thead><tr><th>تاریخ شمسی</th><th>بیدارباش</th><th>برنامهٔ بخش‌ها (دقیقه)</th></tr></thead><tbody>${previewPlans
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
        )}</tbody></table></div><p class="muted">نمایش اولین روزهای دارای فعالیت؛ همهٔ روزهای معتبر با تأیید وارد می‌شوند.</p><label><input id="excel-overwrite" type="checkbox" checked> برنامه‌ها و کارهای موجود با اطلاعات فایل جایگزین شوند</label><small>${fa(existing)} روز در حال حاضر برنامهٔ اختصاصی دارند؛ بدون این انتخاب حفظ می‌شوند. ثبت‌های زمانی و بقیهٔ تاریخ‌ها حذف نمی‌شوند.</small><label class="notice"><input id="excel-replace" type="checkbox"> این فایل مرجع کامل برنامه است؛ برنامه‌های قبلی که در فایل نیستند حذف شوند. زمان‌های واقعی، تیک‌ها و کارهای پروژه حفظ می‌شوند.</label>${p.startDate ? '<label><input id="excel-start" type="checkbox" checked> شروع شماره‌روز از ' + label(p.startDate) + "، مطابق جدول اکسل</label>" : ""}<div class="actions" style="margin-top:16px">${button(p.errors.length ? "ورود ردیف‌های معتبر" : "تأیید و ورود اطلاعات", "excelCommit", "", "primary")}${button("انصراف", "excelClear")}</div>`,
    );
  }
  $("#view").innerHTML = html + templateCard;
}
async function importExcel(file) {
  if (!file || excelBusy) return;
  if (!/\.xlsx$/i.test(file.name))
    return toast("فایل را با پسوند xlsx ذخیره کن.");
  if (file.size > 8 * 1024 * 1024)
    return toast("حداکثر اندازهٔ فایل ۸ مگابایت است.");
  excelFileName = file.name;
  excelError = "";
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
    excelError =
      err.message || "فایل خوانده نشد؛ آن را در اکسل با فرمت xlsx ذخیره کن.";
    toast("ورود اکسل انجام نشد: " + excelError);
  } finally {
    excelBusy = false;
    if (tab === "excel") {
      render();
      if (pendingExcel) {
        $("#excel-preview")?.scrollIntoView({ block: "center" });
        $("#excel-preview")?.focus({ preventScroll: true });
      }
    }
  }
}
function commitExcel() {
  if (!pendingExcel) return;
  if (
    !pendingExcel.plans.length &&
    !pendingExcel.tasks.length &&
    !pendingExcel.groups.length
  )
    return toast(
      "هیچ دادهٔ معتبری برای ورود پیدا نشد؛ پیام‌های فایل را بررسی کن.",
    );
  if (state.active)
    return toast("ابتدا فعالیت در حال اجرا را پایان بده؛ سپس فایل را وارد کن.");
  const result = window.RavalExcel.applyReport(state, pendingExcel, {
    overwrite: $("#excel-overwrite").checked,
    setStart: !!$("#excel-start")?.checked,
  });
  if ($("#excel-replace")?.checked && pendingExcel.plans.length) {
    const dates = new Set(pendingExcel.plans.map((p) => p.date));
    for (const k of Object.keys(result.state.plans))
      if (!dates.has(k)) delete result.state.plans[k];
  }
  state = E.upgrade(result.state);
  state.importMeta = {
    name: pendingExcel.fileName,
    at: Date.now(),
    count: pendingExcel.plans.length,
  };
  const dates = pendingExcel.plans.map((r) => r.date);
  pendingExcel = null;
  const workingDates = dates.filter((k) => E.blocks(state, k).length);
  selected = workingDates.includes(todayKey())
    ? todayKey()
    : workingDates.find((k) => k >= todayKey()) ||
      workingDates[0] ||
      dates[0] ||
      todayKey();
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

function openReview(id = "") {
  const due = E.pendingReview(state),
    t = id ? state.tasks.find((t) => t.id === id) : due[0];
  if (!t) {
    toast("کار ناتمامِ نیازمند مرور نداری.");
    return;
  }
  if (!id) {
    state.reviewPromptedOn = todayKey();
    save();
  }
  modal(
    "این کار چی شد؟",
    `<div class="review-task"><h3>${esc(t.title)}</h3><p>${esc(t.project)} ${t.date ? "• " + label(t.date) : ""}</p>${t.progress ? "<p>" + fa(t.progress) + "٪ انجام شده • " + esc(t.remaining) + "</p>" : ""}</div><p class="muted">وضعیت را مشخص کن؛ سابقهٔ قبلی حفظ می‌شود.</p><div class="review-choices">${[
      ["done", "✓ انجام شد"],
      ["partial", "بخشی انجام شد"],
      ["move", "انتقال به روز دیگر"],
      ["archive", "بایگانی"],
    ]
      .map(([action, title]) =>
        button(
          title,
          "reviewAction",
          JSON.stringify({ id: t.id, action }),
          action === "done" ? "primary" : "secondary",
        ),
      )
      .join("")}</div>`,
    () => {},
  );
  $("#form button[type=submit]").hidden = true;
}
function resolveReview(id, action) {
  if (action === "done" || action === "archive") {
    E.resolveTask(state, id, action);
    save();
    closeModal();
    render();
    openReview();
    return;
  }
  const t = state.tasks.find((t) => t.id === id);
  modal(
    action === "partial" ? "اصلاح کار نیمه‌تمام" : "انتقال کار",
    `<b>${esc(t.title)}</b>${action === "partial" ? `<label>درصد انجام‌شده<input class="field" name="progress" type="number" min="1" max="99" value="${t.progress || 50}" required></label><label>چه چیزی باقی مانده؟<textarea class="field" name="remaining" rows="3" maxlength="1000" required>${esc(t.remaining)}</textarea></label>` : ""}<div class="split"><label>تاریخ انجام باقی‌مانده${dateInput("date", E.add(todayKey(), 1))}</label><label>ساعت (اختیاری)<input class="field" name="time" type="time" value="${esc(t.time)}"></label></div>`,
    (f) => {
      E.resolveTask(state, id, action, {
        date: E.parsePersian(f.get("date")),
        time: f.get("time"),
        progress: f.get("progress"),
        remaining: f.get("remaining"),
      });
      save();
      closeModal();
      render();
      openReview();
    },
  );
}
function maybeReview() {
  if (
    document.visibilityState !== "visible" ||
    $("#dialog").open ||
    state.reviewPromptedOn === todayKey()
  )
    return;
  if (E.pendingReview(state).length) openReview();
}
function showTaskHistory(id) {
  const t = state.tasks.find((t) => t.id === id),
    names = {
      edit: "ویرایش",
      schedule: "تعیین زمان",
      done: "انجام شد",
      reopen: "بازگشایی",
      archive: "بایگانی",
      restore: "بازگرداندن",
      move: "انتقال",
      partial: "بخشی انجام شد",
    };
  modal(
    "سابقهٔ " + esc(t.title),
    `<div class="history-list">${
      (t.history || [])
        .slice()
        .reverse()
        .map(
          (h) =>
            "<article><b>" +
            esc(names[h.action] || h.action) +
            "</b><small>" +
            label(E.key(new Date(h.at))) +
            " • " +
            time(h.at) +
            "</small><p>" +
            (h.before.date ? label(h.before.date) : "بدون تاریخ") +
            " ← " +
            (h.after.date ? label(h.after.date) : "بدون تاریخ") +
            "</p>" +
            (h.after.progress
              ? "<p>انجام‌شده: " + fa(h.after.progress) + "٪</p>"
              : "") +
            (h.after.remaining
              ? "<p>باقی‌مانده: " + esc(h.after.remaining) + "</p>"
              : "") +
            "</article>",
        )
        .join("") || "<p>هنوز تغییری ثبت نشده.</p>"
    }</div>`,
    closeModal,
  );
  $("#form button[type=submit]").hidden = true;
}
