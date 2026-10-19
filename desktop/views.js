/* View layer for the Excel-led workflow. Values come from local state, never demo data. */
const V = {
  colors: [
    "#087f69",
    "#39b594",
    "#4c91d8",
    "#8bbce2",
    "#edba56",
    "#788fbd",
    "#a1b980",
  ],
  paths: {
    today: "M3 5h18v16H3z M7 2v6 M17 2v6 M3 10h18",
    planner: "M3 4h18v17H3z M3 10h18 M9 4v17 M15 4v17",
    projects: "M3 6h7l2 3h9v12H3z",
    reports: "M4 20V12 M10 20V4 M16 20V8 M22 20V2",
    settings:
      "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2",
    excel: "M4 2h11l5 5v15H4z M14 2v6h6 M7 12l7 6 M14 12l-7 6",
    clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v6l4 2",
    book: "M12 5Q7 2 2 5v15q5-3 10 0 5-3 10 0V5q-5-3-10 0v15",
    walk: "M14 3a1 1 0 1 0 .1 0 M9 21l3-8 3 3v5 M6 12l5-5 4 4h5 M12 8l-1 5",
    check: "M4 12l5 5L20 5",
    pause: "M8 5v14 M16 5v14",
    play: "M8 4l12 8-12 8z",
    phone: "M5 3l4 4-2 3q3 5 7 7l3-2 4 4q-2 5-7 2Q3 17 2 7z",
    rest: "M4 8h13v10H4z M17 9h3q3 6-3 6 M3 22h16 M7 2v3 M12 2v3",
    home: "M2 11l10-9 10 9 M5 9v12h14V9 M10 21v-7h4v7",
    archive: "M3 4h18v5H3z M5 9v13h14V9 M9 13h6",
    more: "M4 12h1 M11 12h1 M18 12h1",
  },
  icon(name, cls = "") {
    return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${V.paths[name] || V.paths.reports}"/></svg>`;
  },
  heading(title, sub = "") {
    return `<div class="page-heading"><div><h1>${title}</h1>${sub ? `<p class="muted">${sub}</p>` : ""}</div></div>`;
  },
  activityIcon(a) {
    return a.id === "walk" ? "walk" : a.id === "book" ? "book" : "reports";
  },
  minute(n) {
    n = Math.round(n);
    return n >= 60
      ? fa(Math.floor(n / 60)) +
          " ساعت" +
          (n % 60 ? " و " + fa(n % 60) + " دقیقه" : "")
      : fa(n) + " دقیقه";
  },
  kpi(title, value, sub, icon = "clock", cls = "") {
    return `<article class="kpi ${cls}"><span class="icon-tile">${V.icon(icon)}</span><div><span class="muted">${title}</span><div class="kpi-value">${value}</div><small>${sub || ""}</small></div></article>`;
  },
  today() {
    const p = E.plan(state, selected),
      bs = E.blocks(state, selected),
      s = E.stats(state, selected, selected),
      due = E.pendingReview(state),
      a = state.active;
    let html =
      V.heading(
        selected === todayKey()
          ? "برنامهٔ امروز"
          : "برنامهٔ " + label(selected),
        "یک فعالیت را شروع کن؛ باقی زمان را روال ثبت می‌کند.",
      ) + dayControl();
    html += `<div class="summary-grid">${V.kpi("زمان مفید", `<span id="live-useful">${V.minute(s.actual)}</span>`, "زمان واقعی ثبت‌شدهٔ این روز", "clock")}${V.kpi("پیشرفت برنامه", s.planned ? fa(s.percent) + "٪" : "—", s.count ? fa(s.done) + " از " + fa(s.count) + " بخش انجام شده" : p.unassigned ? "هنوز از اکسل برنامه‌ای ندارد" : p.off ? "استراحت کامل" : "بدون هدف جدید؛ فرصت جبران", "check")}${V.kpi("بیدارباش", p.wake ? `<span class="numeric">${p.wake}</span>` : "—", state.woke && E.key(new Date(state.woke)) === selected ? "بیداری واقعی: " + time(state.woke) : "ساعت برنامهٔ این روز", "today")}</div>`;
    if (selected !== todayKey())
      html +=
        '<div class="notice blue">این برنامه برای تاریخ انتخاب‌شده است. انجام دادن الان، تیک را برای همان تاریخ و زمان واقعی را برای امروز ثبت می‌کند.</div>';
    if (due.length)
      html += `<div class="review-banner"><div>${V.icon("clock")} <b>${fa(due.length)} کار ناتمام نیاز به تعیین تکلیف دارد</b><small>انجام شد؟ بخشی انجام شد؟ یا به روز دیگری منتقل شود؟</small></div>${button("مرور کارهای ناتمام", "openReview", "", "primary")}</div>`;
    html +=
      '<div class="today-layout"><div class="today-main"><section class="panel activity-panel"><div class="section-heading"><h2>فعالیت‌های امروز</h2>' +
      button("ورود برنامه از اکسل", "nav", "excel", "text-button") +
      "</div>";
    if (p.unassigned)
      html +=
        '<div class="empty-state">' +
        V.icon("excel") +
        "<h3>برای این روز برنامه‌ای از اکسل وارد نشده</h3><p>برنامهٔ فرضی برای این تاریخ ساخته نمی‌شود. فایل اکسل را وارد کن.</p>" +
        button("انتخاب فایل اکسل", "nav", "excel", "primary") +
        "</div>";
    else if (p.off)
      html +=
        '<div class="empty-state">' +
        V.icon("rest") +
        "<h3>استراحت کامل</h3><p>کارهای پروژه‌ای این روز همچنان پایین صفحه دیده می‌شوند.</p></div>";
    else
      for (const [special, title] of [
        [false, "روزمره"],
        [true, "کارهای تخصصی"],
      ]) {
        const activities = planActivities().filter(
          (x) => !!x.special === special,
        );
        if (!activities.length) continue;
        html += `<h3 class="group-heading">${V.icon(special ? "reports" : "today")}${title}</h3>`;
        for (const activity of activities) {
          const list = bs.filter((b) => b.id === activity.id);
          if (!list.length) {
            html += V.graceRow(activity);
            continue;
          }
          const sum = list.reduce((n, b) => n + b.minutes, 0),
            next = list.find((b) => !state.completions[b.key]),
            running = list.some((b) => a?.block === b.key);
          html += `<article class="activity-row ${running ? "running" : ""}"><span class="activity-icon">${V.icon(V.activityIcon(activity))}</span><div class="activity-name"><b>${esc(activity.name)}</b><small>${fa(sum)} دقیقه</small></div><div class="parts">${list.map((b) => `<label class="part ${state.completions[b.key] ? "checked" : ""} ${a?.block === b.key ? "current" : ""}"><input type="checkbox" data-complete="${esc(b.key)}" ${state.completions[b.key] ? "checked" : ""} aria-label="تکمیل ${esc(activity.name)} بخش ${fa(b.index + 1)}"><span>${fa(b.minutes)}</span></label>`).join("")}</div><div class="row-actions">${next ? button(V.icon(running ? "clock" : "play") + (running ? "در حال انجام" : "شروع"), "block", next.key, running ? "soft" : "secondary") : '<span class="done-badge">' + V.icon("check") + "انجام شد</span>"}${next ? `<details class="mini-menu"><summary aria-label="گزینه‌های جلسه">${V.icon("more")}</summary><div>${button("کار / استراحت", "series", activity.id, "small")}</div></details>` : ""}</div></article>`;
        }
      }
    html +=
      '</section><section class="panel"><div class="section-heading"><h2>کارهای این روز</h2>' +
      button("＋ کار جدید", "addTodayTask", "", "text-button") +
      "</div>";
    const tasks = state.tasks
      .filter((t) => !t.archived && t.date === selected)
      .sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
    html += tasks.length
      ? tasks.map(taskRow).join("")
      : '<div class="empty"><p>هنوز کاری برای این تاریخ تعیین نشده.</p>' +
        button("انتخاب کار از پروژه‌ها", "nav", "projects", "text-button") +
        "</div>";
    html +=
      '</section><details class="panel timeline-details"><summary>' +
      V.icon("clock") +
      "خط زمانی این روز</summary>" +
      timeline(selected) +
      '</details></div><aside class="focus-column">' +
      V.focusPanel() +
      "</aside></div>";
    $("#view").innerHTML = html;
  },
  graceRow(activity) {
    const pending = E.backlog(state, selected, activity.id),
      visible = graceExpanded.has(activity.id) ? pending : pending.slice(0, 4);
    return `<article class="grace-card"><details><summary><span class="activity-icon">${V.icon(V.activityIcon(activity))}</span><b>${esc(activity.name)}</b><span class="badge grace-badge">ارفاقی</span><small>${pending.length ? fa(pending.length) + " بخش برای جبران" : "بدون هدف زمانی جدید"}</small><span class="text-link">دیدن عقب‌ماندگی‌ها ‹</span></summary><div class="grace-body"><p class="muted">خالی بودن این گروه، فقط همین فعالیت را ارفاقی می‌کند.</p>${visible.map((b) => `<div class="backlog-row"><label><input type="checkbox" data-complete="${esc(b.key)}" aria-label="جبران ${esc(activity.name)} ${label(b.date)}"> ${fa(b.minutes)} دقیقه • ${label(b.date)}</label>${button("شروع جبران", "block", b.key, "small")}</div>`).join("") || '<p class="muted">عقب‌ماندگی‌ای برای این گروه ثبت نشده.</p>'}${pending.length > 4 ? button(graceExpanded.has(activity.id) ? "نمایش کمتر" : "همهٔ عقب‌ماندگی‌ها", "graceExpand", activity.id, "text-button") : ""}${button("شروع آزاد " + esc(activity.name), "quick", activity.id, "small")}</div></details></article>`;
  },
  focusPanel() {
    const a = state.active || state.paused,
      isPaused = !state.active && !!state.paused,
      b = a?.block
        ? E.blocks(state, a.planDate).filter((x) => x.id === a.activity)
        : [],
      position = a?.block ? b.findIndex((x) => x.key === a.block) + 1 : 0;
    return `<section class="panel focus-panel"><div class="section-heading"><h2>${isPaused ? "متوقف شده" : a ? "در حال انجام" : "آمادهٔ شروع"}</h2><span class="status-dot ${a && !isPaused ? "on" : ""}"></span></div><h3>${a ? esc(a.name) : "یک قدم کوچک برای امروز"}</h3><small>${position ? "بخش " + fa(position) + " از " + fa(b.length) : a ? "ثبت زمان واقعی" : "فعالیتی از برنامه یا یک کار دلخواه انتخاب کن"}</small><div class="timer-ring" id="timer-ring"><div><div id="clock" class="timer-value">۰۰:۰۰:۰۰</div><small>${a?.deadline ? "زمان باقی‌مانده" : "زمان فعالیت"}</small></div></div><div class="focus-buttons">${state.active ? button(V.icon("pause") + "توقف موقت", "pause", "", "primary") : state.paused ? button(V.icon("play") + "ادامه", "resume", "", "primary") : button(V.icon("play") + "شروع فعالیت", "activityDialog", "", "primary")}${a ? button(V.icon("check") + "پایان و ثبت", "finishFocus", "", "secondary") : ""}</div><div class="quick-section"><h4>تعویض سریع فعالیت</h4><div class="quick-three">${button(V.icon("rest") + "استراحت", "quick", "rest")}${button(V.icon("phone") + "تماس", "quick", "phone")}${button(V.icon("home") + "خانواده", "quick", "family")}</div>${button("••• بیشتر", "activityDialog", "", "wide text-button")}</div>${state.paused && state.active ? '<div class="notice blue">کار قبلی متوقف شده. ' + button("ادامهٔ " + esc(state.paused.name), "resume", "", "small") + "</div>" : ""}${state.series ? "<small>استراحت بین بخش‌ها: " + fa(state.series.restMinutes) + " دقیقه</small>" : ""}</section><section class="panel quick-capture"><h3>الان چه کاری انجام می‌دهی؟</h3><div class="capture-field"><input id="quick-activity" list="quick-options" placeholder="فعالیت را بنویس یا انتخاب کن…" maxlength="80" aria-label="نام فعالیت"><datalist id="quick-options">${state.activities.map((a) => `<option value="${esc(a.name)}">`).join("")}</datalist>${button("＋", "quickTyped", "", "primary square")}</div>${button(V.icon("clock") + "ثبت زمان گذشته", "since", "", "text-button")}${button("☀ الان بیدار شدم", "wake", "", "text-button")}</section>`;
  },
  planner() {
    const from =
        plannerSpan === "week"
          ? E.add(selected, -((E.date(selected).getDay() + 1) % 7))
          : E.fromPersian(calendar.y, calendar.m, 1),
      to =
        plannerSpan === "week"
          ? E.add(from, 6)
          : E.fromPersian(
              calendar.y,
              calendar.m,
              E.monthLength(calendar.y, calendar.m),
            ),
      keys = E.range(from, to),
      activities = planActivities();
    const columns = activities.map((a) => ({
      ...a,
      width: Math.max(
        1,
        ...keys.map((k) => (E.plan(state, k).blocks[a.id] || []).length),
      ),
    }));
    let html =
      V.heading(
        "برنامهٔ کلی",
        "نمای جدول اکسل؛ هر بخش که انجام شود، خانه‌اش خودکار سبز می‌شود.",
      ) +
      `<div class="toolbar panel"><div class="segmented">${button("هفتگی", "plannerSpan", "week", plannerSpan === "week" ? "on" : "")}${button("ماهانه", "plannerSpan", "month", plannerSpan === "month" ? "on" : "")}</div><div class="actions">${plannerSpan === "week" ? button("هفتهٔ قبل", "plannerShift", "-7") + `<span>${label(from)} تا ${label(to)}</span>` + button("هفتهٔ بعد", "plannerShift", "7") : `<label class="compact-label">سال<input id="planner-year" type="number" min="1300" max="1599" value="${calendar.y}"></label><label class="compact-label">ماه<select id="planner-month">${months.map((n, i) => `<option value="${i + 1}" ${calendar.m === i + 1 ? "selected" : ""}>${n}</option>`).join("")}</select></label>${button("نمایش", "chooseMonth")}${button("‹", "shiftMonth", "-1")}${button("›", "shiftMonth", "1")}`}</div>${button(V.icon("excel") + "ورود اکسل", "nav", "excel", "primary")}</div><div class="matrix-legend"><span><i class="dot complete-dot"></i>انجام‌شده</span><span><i class="dot running-dot"></i>در حال انجام</span><span><i class="dot pending-dot"></i>باقی‌مانده</span><span><i class="dot grace-dot"></i>ارفاقی همان فعالیت</span><span>خاکستری: بدون برنامهٔ ورودی</span></div>`;
    html += `<div class="matrix-wrap"><table class="matrix" style="min-width:${240 + columns.reduce((n, c) => n + c.width * 27, 0)}px"><thead><tr><th rowspan="2" class="date-col">شماره / روز / تاریخ</th><th rowspan="2">بیدارباش</th><th rowspan="2">هدف<br><small>دقیقه</small></th><th rowspan="2">واقعی<br><small>دقیقه</small></th>${columns.map((a) => `<th colspan="${a.width}">${esc(a.name)}</th>`).join("")}</tr><tr>${columns.map((a) => Array.from({ length: a.width }, (_, i) => `<th class="part-index">${fa(i + 1)}</th>`).join("")).join("")}</tr></thead><tbody>`;
    for (const k of keys) {
      const p = E.plan(state, k),
        bs = E.blocks(state, k),
        total = bs.reduce((n, b) => n + b.minutes, 0);
      html += `<tr class="${k === todayKey() ? "today-row" : ""} ${p.unassigned ? "no-plan" : ""}"><th class="date-col">${button((!p.unassigned && k >= state.startDate ? fa(Math.round((E.date(k) - E.date(state.startDate)) / 86400000) + 1) + " • " : "") + week[E.date(k).getDay()] + "<br><small>" + label(k) + "</small>", "openDay", k, "date-link")}</th><td class="numeric">${p.wake || "—"}</td><td>${p.unassigned ? "—" : fa(total)}</td><td>${fa(Math.round(E.minutes(state, k)))}</td>`;
      for (const c of columns) {
        const list = bs.filter((b) => b.id === c.id);
        if (!list.length) {
          html += `<td colspan="${c.width}" class="${p.unassigned ? "empty-cell" : p.off ? "off-cell" : "grace-cell"}">${p.unassigned ? "—" : p.off ? "استراحت" : "ارفاقی"}</td>`;
          continue;
        }
        for (let i = 0; i < c.width; i++) {
          const b = list[i];
          html += b
            ? `<td class="time-cell">${button((state.completions[b.key] ? "✓ " : "") + fa(b.minutes), "matrixToggle", b.key, "matrix-part " + (state.completions[b.key] ? "is-complete" : state.active?.block === b.key ? "is-running" : "is-pending"))}</td>`
            : '<td class="unused-cell"></td>';
        }
      }
      html += "</tr>";
    }
    html +=
      '</tbody></table></div><p class="muted helper">برای بازکردن برنامهٔ روز، تاریخ آن را بزن. زدن خانهٔ زمان، تیک همان بخش را تغییر می‌دهد؛ زمان واقعی فقط با ثبت فعالیت محاسبه می‌شود.</p>';
    $("#view").innerHTML = html;
  },
  taskRow(t) {
    return `<div class="task ${t.done ? "done" : ""} ${t.archived ? "archived" : ""}"><input type="checkbox" data-task="${esc(t.id)}" ${t.done ? "checked" : ""} ${t.archived ? "disabled" : ""} aria-label="تکمیل ${esc(t.title)}"><div class="content"><b class="title">${esc(t.title)}</b><div class="task-meta"><span class="project-tag">${V.icon("projects")}${esc(t.project)}</span>${t.date ? "<span>" + V.icon("today") + label(t.date) + "</span>" : ""}${t.time ? '<span class="numeric">' + V.icon("clock") + esc(t.time) + "</span>" : ""}${t.tags ? "<small>" + esc(t.tags) + "</small>" : ""}</div>${t.progress > 0 && !t.done ? '<div class="partial-progress"><span style="width:' + t.progress + '%"></span></div><small>' + fa(t.progress) + "٪ انجام شده • باقی‌مانده: " + esc(t.remaining) + "</small>" : ""}</div><div class="task-buttons">${t.archived ? button("بازگرداندن", "restoreTask", t.id, "small") : button(t.date ? "تغییر روز" : "تعیین روز", "schedule", t.id, "small") + button("چی شد؟", "reviewTask", t.id, "small")}${button("ویرایش", "editTask", t.id, "small")}${button("سابقه", "taskHistory", t.id, "small")}</div></div>`;
  },
  projects() {
    let html =
      V.heading(
        showArchived ? "بایگانی کارها" : "پروژه‌ها و کارها",
        "همان موقع ساخت کار یا بعداً، برای انجامش تاریخ و ساعت تعیین کن.",
      ) +
      `<div class="toolbar"><div class="actions">${button("＋ کار جدید", "addTask", "", "primary")}${button("＋ پروژه", "addProject")}${button(showArchived ? "کارهای فعال" : V.icon("archive") + "بایگانی", "toggleArchive", "", "secondary")}</div><div class="search-field"><input id="search" placeholder="عنوان، پروژه، شهر یا برچسب…" value="${esc(filter)}">${button("جست‌وجو", "search", "", "secondary")}</div></div><div class="project-grid">`;
    for (const p of state.projects) {
      const tasks = state.tasks.filter(
          (t) =>
            t.project === p &&
            !!t.archived === showArchived &&
            (p + " " + t.title + " " + t.tags).includes(filter),
        ),
        done = tasks.filter((t) => t.done).length;
      html += card(
        V.icon("projects") + esc(p),
        `<div class="row"><small>${fa(done)} از ${fa(tasks.length)} انجام‌شده</small><span class="badge">${fa(tasks.length)} کار</span></div><progress value="${done}" max="${tasks.length || 1}"></progress>${tasks.map(taskRow).join("") || '<p class="empty">هنوز کاری در این بخش نیست.</p>'}`,
        "project-panel",
      );
    }
    $("#view").innerHTML = html + "</div>";
  },
  reports() {
    const [from, to] = reportRange(),
      s = E.stats(state, from, to),
      keys = E.range(from, to),
      previous = E.stats(state, E.add(from, -keys.length), E.add(from, -1));
    const actualByActivity = state.activities
        .filter((a) => a.useful)
        .map((a) => ({
          ...a,
          minutes: keys.reduce((n, k) => n + E.minutes(state, k, a.id), 0),
        })),
      positive = actualByActivity
        .filter((a) => a.minutes > 0)
        .sort((a, b) => b.minutes - a.minutes),
      activeDays = keys.filter((k) => E.minutes(state, k) > 0).length;
    const trend =
      previous.actual > 0
        ? (s.actual >= previous.actual ? "↑ " : "↓ ") +
          fa(
            Math.abs(
              Math.round(
                ((s.actual - previous.actual) / previous.actual) * 100,
              ),
            ),
          ) +
          "٪ نسبت به بازهٔ قبل"
        : s.actual
          ? "اولین بازهٔ ثبت‌شده"
          : "هنوز زمان واقعی ثبت نشده";
    let html =
      V.heading("گزارش عملکرد", "ببین وقتت کجا رفته و چقدر جلو رفته‌ای.") +
      `<div class="report-toolbar"><div class="segmented">${[
        ["day", "روز"],
        ["week", "هفته"],
        ["month", "ماه"],
        ["year", "سال"],
      ]
        .map(([id, n]) =>
          button(n, "reportPeriod", id, reportPeriod === id ? "on" : ""),
        )
        .join(
          "",
        )}</div>${dayControl()}</div><p class="period-label">${label(from)} تا ${label(to)}</p>`;
    html += `<div class="report-kpis">${V.kpi("زمان مفید", V.minute(s.actual), trend, "clock")}${V.kpi("انجام برنامه", s.planned ? fa(s.percent) + "٪" : "—", s.count ? fa(s.done) + " از " + fa(s.count) + " بخش تکمیل شده" : "در این بازه برنامه‌ای ثبت نشده", "check")}${V.kpi("کارهای پروژه‌ای", s.tasks ? fa(s.tasksDone) + " از " + fa(s.tasks) : "—", s.tasks ? "کار تکمیل‌شده" : "کاری برای این بازه نیست", "projects")}${V.kpi("روزهای فعال", fa(activeDays) + " از " + fa(keys.length), "روز دارای زمان مفید ثبت‌شده", "today")}</div>`;
    let buckets =
      reportPeriod === "year"
        ? months.map((n, i) => ({
            name: n,
            from: E.fromPersian(E.persian(selected).y, i + 1, 1),
            to: E.fromPersian(
              E.persian(selected).y,
              i + 1,
              E.monthLength(E.persian(selected).y, i + 1),
            ),
          }))
        : keys.map((k) => ({
            name:
              reportPeriod === "week"
                ? week[E.date(k).getDay()]
                : reportPeriod === "day"
                  ? "این روز"
                  : fa(E.persian(k).d),
            from: k,
            to: k,
          }));
    const chart = buckets.map((b) => ({
        ...b,
        s: E.stats(state, b.from, b.to),
      })),
      max = Math.max(60, ...chart.flatMap((b) => [b.s.planned, b.s.actual])),
      axis = Math.ceil(max / 60),
      scale = axis * 60;
    const maxDay = keys.reduce(
      (best, k) => (E.minutes(state, k) > E.minutes(state, best) ? k : best),
      keys[0],
    );
    html +=
      '<div class="report-charts"><section class="panel"><div class="section-heading"><h2>برنامه و زمان واقعی</h2><span class="legend"><i class="dot target-dot"></i>هدف <i class="dot complete-dot"></i>زمان واقعی</span></div><small class="axis-caption">ساعت</small><div class="bar-chart"><div class="chart-axis">' +
      [axis, axis * 0.75, axis * 0.5, axis * 0.25, 0]
        .map((n) => "<span>" + fa(Math.round(n * 10) / 10) + "</span>")
        .join("") +
      '</div><div class="chart-columns">' +
      chart
        .map(
          (b) =>
            `<div class="chart-column" title="${b.name} • هدف ${V.minute(b.s.planned)} • واقعی ${V.minute(b.s.actual)}"><div class="bar-pair"><div class="chart-bar target" style="height:${(b.s.planned / scale) * 100}%" data-value="${fa(b.s.planned)}"></div><div class="chart-bar actual" style="height:${(b.s.actual / scale) * 100}%" data-value="${fa(Math.round(b.s.actual))}"></div></div><small>${b.name}</small></div>`,
        )
        .join("") +
      '</div></div><p class="chart-note">هدف و زمان واقعی جدا هستند؛ تیک دستی زمان واقعی ایجاد نمی‌کند.</p></section>';
    let stop = 0;
    const gradient = positive
      .map((a, i) => {
        const start = stop;
        stop += (a.minutes / Math.max(1, s.actual)) * 100;
        return `${V.colors[i % V.colors.length]} ${start}% ${stop}%`;
      })
      .join(",");
    html += `<section class="panel distribution"><h2>سهم فعالیت‌ها از زمان مفید</h2><div class="donut" style="background:${positive.length ? "conic-gradient(" + gradient + ")" : "#e8efec"}"><div><b>${s.actual ? V.minute(s.actual) : "ثبت نشده"}</b><small>زمان مفید این بازه</small></div></div><div class="donut-legend">${positive.map((a, i) => `<div><span><i class="dot" style="background:${V.colors[i % V.colors.length]}"></i>${esc(a.name)}</span><b>${fa(Math.round((a.minutes / s.actual) * 100))}٪</b></div>`).join("") || '<p class="muted">با ثبت اولین فعالیت، سهم زمان‌ها را اینجا می‌بینی.</p>'}</div></section></div>`;
    html += `<div class="insight">✦ ${positive.length ? "بیشترین زمان مفید این بازه برای «" + esc(positive[0].name) + "» بوده؛ " + label(maxDay) + " بیشترین زمان ثبت‌شده را داشته است." : "هنوز عملکرد واقعی ثبت نشده. برنامهٔ واردشده از اکسل، هدف است؛ برای گزارش عملکرد، فعالیت را شروع و پایان بده."}</div><div class="report-bottom"><section class="panel"><h2>پیشرفت هر فعالیت</h2><div class="activity-report-head"><span>فعالیت</span><span>زمان واقعی / هدف</span></div>`;
    for (const a of actualByActivity) {
      const goal = keys.reduce(
        (n, k) =>
          n +
          E.blocks(state, k)
            .filter((b) => b.id === a.id)
            .reduce((n, b) => n + b.minutes, 0),
        0,
      );
      if (!goal && !a.minutes) continue;
      html += `<div class="activity-report-row"><span>${V.icon(V.activityIcon(a))}${esc(a.name)}</span><div class="mini-progress"><span style="width:${Math.min(100, goal ? (a.minutes / goal) * 100 : 0)}%"></span></div><small>${fa(Math.round(a.minutes))} / ${goal ? fa(goal) : "ارفاقی"} دقیقه</small></div>`;
    }
    const graceDays = keys.filter(
        (k) => E.graceActivities(state, k).length,
      ).length,
      remainingTasks = state.tasks.filter(
        (t) =>
          !t.done && !t.archived && t.date && t.date >= from && t.date <= to,
      ).length;
    html += `</section><section class="panel remaining-panel"><h2>جبران و کارهای باقی‌مانده</h2><div class="blue-tile"><b>${fa(graceDays)} روز با فرصت جبران</b><small>برای یک یا چند گروه، بدون هدف زمانی جدید</small></div><div class="amber-tile"><b>${fa(remainingTasks)} کار پروژه‌ای تکمیل نشده</b>${button("دیدن کارها", "nav", "projects", "small")}</div><p class="muted">گروه ارفاقی به هدف برنامه چیزی اضافه نمی‌کند.</p></section></div><details class="panel"><summary>جزئیات زمان‌ها</summary>${
      state.activities
        .map((a) => {
          const n = keys.reduce((v, k) => v + E.minutes(state, k, a.id), 0);
          return n
            ? '<div class="row"><span>' +
                esc(a.name) +
                "</span><b>" +
                V.minute(n) +
                "</b></div>"
            : "";
        })
        .join("") || "<p>زمانی ثبت نشده.</p>"
    }</details><div class="actions">${button("کپی گزارش", "copyReport")}${button("خروجی برای تحلیل", "analysis")}</div>`;
    $("#view").innerHTML = html;
  },
  settings() {
    const permitted =
      "Notification" in window ? Notification.permission : "unsupported";
    $("#view").innerHTML =
      V.heading("تنظیمات", "مدیریت اطلاعات و یادآوری‌های همین دستگاه.") +
      `<div class="settings-grid">${card("ذخیره و بازیابی اطلاعات", `<p class="muted">برنامهٔ اکسل، پروژه‌ها، تیک‌ها، زمان‌های واقعی و تنظیمات در یک فایل ذخیره می‌شوند.</p><div class="backup-actions">${button(V.icon("archive") + "ذخیرهٔ همهٔ اطلاعات", "backup", "", "primary")}<label class="file-button secondary">${V.icon("projects")}بازیابی اطلاعات<input id="restore" type="file" accept=".json,application/json" hidden></label></div><small>بازیابی پس از تأیید، دادهٔ فعلی را جایگزین می‌کند.</small><details id="analysis-details" class="analysis-details"><summary>خروجی برای تحلیل</summary><div class="actions">${button("CSV زمان‌ها", "csv")}${button("CSV جدول برنامه", "planCsv")}</div></details>`, "backup-panel")}${card("یادآوری و پایان روز", `<p>اعلان مرورگر: <b>${{ granted: "مجاز", denied: "مسدود", default: "در انتظار اجازه", unsupported: "پشتیبانی نمی‌شود" }[permitted]}</b></p>${button("فعال‌کردن اعلان‌ها", "notifications", "", "secondary")}<label class="review-clock">زمان مرور کارهای ناتمام<input id="review-time" type="time" value="${state.reviewTime || "21:00"}"></label>${button("ذخیرهٔ زمان مرور", "reviewClock", "", "small")}<p class="muted">اگر آخر روز برنامه بسته باشد، کارهای ناتمام دفعهٔ بعد که آن را باز کنی برای مرور می‌آیند. اعلان وب به بازبودن صفحه و فعال‌بودن مرورگر نیاز دارد.</p>`)}</div>` +
      card(
        "برنامه از اکسل",
        `<div class="row"><div><p>برای تاریخ‌های بدون ورودی، برنامهٔ فرضی ساخته نمی‌شود.</p><small>مبدأ شماره‌روز از اکسل: ${label(state.startDate)}</small>${state.importMeta ? '<p class="muted">آخرین فایل: ' + esc(state.importMeta.name) + " • " + fa(state.importMeta.count) + " روز</p>" : ""}</div>${button(V.icon("excel") + "ورود یا دریافت قالب", "nav", "excel", "secondary")}</div>`,
      ) +
      card(
        "گروه‌ها و فعالیت‌ها",
        `<div class="settings-activities">${planActivities()
          .map(
            (a) =>
              '<span class="badge">' +
              esc(a.name) +
              (a.special ? " • تخصصی" : "") +
              "</span>",
          )
          .join(
            "",
          )}</div>${button("＋ فعالیت جدید", "addGroup", "", "text-button")}`,
      );
  },
};
