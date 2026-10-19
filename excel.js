/* XLSX mapping only: worksheet text is data, never executable instructions. */
(function (root) {
  "use strict";
  const E = typeof module !== "undefined" ? require("./engine.js") : root.Raval;
  const norm = (s) => E.normalizeName(s).replace(/[\s/\\_\-‌]/g, "");
  const monthNames = [
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
  ];
  function raw(c) {
    const v = c.value;
    if (v === null || v === undefined) return "";
    if (v instanceof Date) return v;
    if (typeof v === "object") {
      if (v.richText) return v.richText.map((x) => x.text).join("");
      if ("result" in v) return v.result ?? "";
      if (v.text) return v.text;
      return "";
    }
    return v;
  }
  function colNumber(s) {
    return [...s.toUpperCase()].reduce(
      (n, c) => n * 26 + c.charCodeAt(0) - 64,
      0,
    );
  }
  function wakeTime(v) {
    if (v instanceof Date)
      return `${String(v.getUTCHours()).padStart(2, "0")}:${String(v.getUTCMinutes()).padStart(2, "0")}`;
    const str = E.digits(v).trim();
    if (!str) return "07:00";
    if (/^([01]?\d|2[0-3]):[0-5]\d$/.test(str)) {
      const [h, m] = str.split(":");
      return h.padStart(2, "0") + ":" + m;
    }
    const n = Number(str);
    if (!Number.isFinite(n) || n < 0 || n >= 24)
      throw Error("ساعت بیداری نامعتبر است");
    let h, m;
    if (n > 0 && n < 1) {
      const mins = Math.round(n * 1440);
      h = Math.floor(mins / 60);
      m = mins % 60;
    } else {
      h = Math.floor(n);
      const fraction = Math.round((n - h) * 100);
      m = fraction === 50 ? 30 : fraction;
    }
    if (h > 23 || m > 59)
      throw Error("ساعت نامعتبر است؛ ساعت را مثل 08:30 بنویس");
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  function headers(sheet) {
    for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
      const row = sheet.getRow(r),
        map = new Map();
      for (let c = 1; c <= Math.min(500, sheet.columnCount); c++) {
        const n = norm(raw(row.getCell(c)));
        if (n) map.set(n, c);
      }
      const get = (...keys) =>
        keys
          .map(norm)
          .map((k) => map.get(k))
          .find(Boolean);
      if (get("سال") && get("ماه") && get("تاریخ", "روز ماه"))
        return { r, map, get, type: "plans" };
      if (get("پروژه", "نام پروژه") && get("عنوان", "عنوان کار", "کار"))
        return { r, map, get, type: "tasks" };
      if (get("نام فعالیت") && get("تخصصی"))
        return { r, map, get, type: "groups" };
    }
    return null;
  }
  function activityFor(s, name, idFactory) {
    const n = norm(name.replace(/^جمع\s*/, ""));
    const aliases = {
      walk: ["پیاده روی/ ورزش", "پیاده روی", "ورزش"],
      book: ["کتاب"],
      technical: ["تکنیکال", "مطالعه تکنیکال", "جمع مطالعه تکنیکال"],
      platform: ["پلتفرم"],
      chart: ["تحلیل چارت"],
    };
    for (const [id, variants] of Object.entries(aliases))
      if (variants.some((x) => norm(x) === n)) return E.activity(s, id);
    const old = E.findActivity(s, name.replace(/^جمع\s*/, ""));
    if (old) return old;
    const a = E.ensureActivity(
      s,
      name.replace(/^جمع\s*/, ""),
      idFactory(),
      true,
    );
    a.special = true;
    return a;
  }
  function parts(cell, report, location) {
    const v = raw(cell);
    if (
      cell.value &&
      typeof cell.value === "object" &&
      cell.value.formula &&
      !("result" in cell.value)
    )
      throw Error(
        location + ": فرمول بدون نتیجهٔ ذخیره‌شده؛ فایل را در اکسل ذخیره کن",
      );
    if (v === "" || v === null || v === 0 || String(v).trim() === "0")
      return [];
    if (String(v).trim() === "*") {
      report.stars++;
      return [];
    }
    try {
      return E.parseParts(String(v));
    } catch (err) {
      throw Error(location + ": " + err.message);
    }
  }
  function truth(v) {
    if (typeof v === "boolean") return v;
    const n = norm(v);
    if (["بله", "true", "1", "yes", "انجامشد", "✓"].includes(n)) return true;
    if (["", "خیر", "نه", "false", "0", "no", "انجامنشده"].includes(n))
      return false;
    throw Error("وضعیت انجام کار باید بله یا خیر باشد");
  }
  function readWorkbook(workbook, state, idFactory) {
    const draft = structuredClone(state),
      report = {
        draft,
        plans: [],
        tasks: [],
        groups: [],
        warnings: [],
        errors: [],
        stars: 0,
        sheets: [],
        startDate: null,
      },
      before = new Set(draft.activities.map((a) => a.id)),
      dateSeen = new Set();
    let origin = null;
    for (const sheet of workbook.worksheets) {
      const h = headers(sheet);
      if (!h || h.type !== "groups") continue;
      for (let r = h.r + 1; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r),
          name = String(raw(row.getCell(h.get("نام فعالیت")))).trim();
        if (!name) continue;
        try {
          const existing = E.findActivity(draft, name),
            a = activityFor(draft, name, idFactory);
          if (!existing) {
            a.special = truth(raw(row.getCell(h.get("تخصصی"))));
            a.useful = h.get("زمان مفید")
              ? truth(raw(row.getCell(h.get("زمان مفید"))))
              : true;
          }
        } catch (err) {
          report.errors.push({
            sheet: sheet.name,
            row: r,
            message: err.message,
          });
        }
      }
    }
    for (const sheet of workbook.worksheets) {
      const h = headers(sheet);
      if (!h) {
        if (sheet.name !== "راهنما")
          report.warnings.push(
            `شیت «${sheet.name}» ساختار برنامه یا کارها ندارد و وارد نمی‌شود.`,
          );
        continue;
      }
      report.sheets.push(sheet.name);
      if (sheet.rowCount > 5000 || sheet.columnCount > 500)
        throw Error("هر شیت حداکثر ۵۰۰۰ ردیف و ۵۰۰ ستون می‌تواند داشته باشد");
      if (h.type === "groups") continue;
      if (h.type === "tasks") {
        for (let r = h.r + 1; r <= sheet.rowCount; r++) {
          const row = sheet.getRow(r),
            get = (...names) => {
              const c = h.get(...names);
              return c ? raw(row.getCell(c)) : "";
            },
            title = String(get("عنوان", "عنوان کار", "کار")).trim();
          if (!title) continue;
          try {
            const project =
                String(get("پروژه", "نام پروژه")).trim() || "ورودی اکسل",
              tags = String(get("برچسب", "شهر / برچسب", "برچسب‌ها")),
              dateString = get("تاریخ شمسی", "تاریخ"),
              k = dateString ? E.parsePersian(String(dateString)) : "",
              timeValue = get("ساعت"),
              time = timeValue !== "" ? wakeTime(timeValue) : "",
              leadRaw = get("یادآوری (دقیقه قبل)", "دقایق یادآوری", "یادآوری"),
              lead = leadRaw === "" ? 0 : Number(E.digits(leadRaw));
            if (time && !k)
              throw Error("برای ساعت کار، تاریخ شمسی هم لازم است");
            if (![0, 5, 10, 15, 30, 60].includes(lead))
              throw Error("یادآوری باید ۰،۵،۱۰،۱۵،۳۰ یا ۶۰ دقیقه باشد");
            report.tasks.push({
              id: idFactory(),
              title,
              project,
              tags,
              date: k,
              time,
              lead,
              reminder: !!(k && time),
              done: truth(get("انجام شد", "انجام شده")),
              completedAt: null,
              sheet: sheet.name,
              row: r,
            });
          } catch (err) {
            report.errors.push({
              sheet: sheet.name,
              row: r,
              message: err.message,
            });
          }
        }
        continue;
      }
      const meta = new Set(
          [
            "شماه روز",
            "شماره روز",
            "روز",
            "تاریخ",
            "روز ماه",
            "ماه",
            "سال",
            "مفید",
            "جمع مفید",
            "ساعت مفید",
            "بیدار باش",
            "بیدارباش",
            "روز خالی",
          ].map(norm),
        ),
        reserved = new Set(),
        groups = [],
        rowHeader = sheet.getRow(h.r);
      // Prefer a named total's SUM range over a repeated merged label (as in TRACK.xlsx).
      for (let c = 1; c <= sheet.columnCount; c++) {
        const name = String(raw(rowHeader.getCell(c))).trim();
        if (!name || meta.has(norm(name))) continue;
        let match = null;
        for (let r = h.r + 1; r <= Math.min(sheet.rowCount, h.r + 12); r++) {
          const formula = sheet.getRow(r).getCell(c).value?.formula;
          if (formula) {
            match = String(formula)
              .replace(/^=/, "")
              .match(/^SUM\(\$?([A-Z]+)\$?\d+:\$?([A-Z]+)\$?\d+\)$/i);
            if (match) break;
          }
        }
        if (match) {
          const start = colNumber(match[1]),
            end = colNumber(match[2]);
          if (end < start || end - start >= 100)
            throw Error("محدودهٔ بخش‌ها در اکسل معتبر نیست");
          const a = activityFor(draft, name, idFactory);
          groups.push({ id: a.id, start, end });
          reserved.add(c);
          for (let j = start; j <= end; j++) reserved.add(j);
        }
      }
      for (const merge of sheet.model.merges || []) {
        const match = merge.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
        if (!match || +match[2] !== h.r || +match[4] !== h.r) continue;
        const start = colNumber(match[1]),
          end = colNumber(match[3]);
        if (reserved.has(start)) continue;
        const name = String(raw(rowHeader.getCell(start))).trim();
        if (!name || meta.has(norm(name))) continue;
        const a = activityFor(draft, name, idFactory);
        groups.push({ id: a.id, start, end });
        for (let j = start; j <= end; j++) reserved.add(j);
      }
      for (let c = 1; c <= sheet.columnCount; c++) {
        const name = String(raw(rowHeader.getCell(c))).trim();
        if (!name || meta.has(norm(name)) || reserved.has(c)) continue;
        const a = activityFor(draft, name, idFactory);
        groups.push({ id: a.id, start: c, end: c });
      }
      for (let r = h.r + 1; r <= sheet.rowCount; r++) {
        const row = sheet.getRow(r),
          value = (...keys) => {
            const c = h.get(...keys);
            return c ? raw(row.getCell(c)) : "";
          },
          y0 = value("سال"),
          m0 = value("ماه"),
          d0 = value("تاریخ", "روز ماه");
        if (y0 === "" && m0 === "" && d0 === "") continue;
        try {
          const y = Number(E.digits(y0)),
            monthIndex = monthNames.findIndex((n) => norm(n) === norm(m0)),
            m = monthIndex >= 0 ? monthIndex + 1 : Number(E.digits(m0)),
            d = Number(E.digits(d0)),
            k = E.fromPersian(y, m, d);
          if (dateSeen.has(k))
            throw Error("تاریخ تکراری در فایل: " + E.label(k));
          const p = {
            wake: wakeTime(value("بیدار باش", "بیدارباش")),
            off: false,
            blocks: {},
          };
          for (const g of groups) {
            const list = [];
            for (let c = g.start; c <= g.end; c++)
              list.push(...parts(row.getCell(c), report, `${sheet.name}!${r}`));
            if (list.length > 100)
              throw Error("بیشتر از ۱۰۰ بخش برای یک فعالیت");
            if (p.blocks[g.id]) p.blocks[g.id].push(...list);
            else p.blocks[g.id] = list;
          }
          p.off = h.get("روز خالی")
            ? truth(value("روز خالی"))
            : Object.values(p.blocks).every((p) => !p.length);
          const probe = { ...draft, plans: {} };
          E.setPlan(probe, k, p);
          dateSeen.add(k);
          report.plans.push({ date: k, plan: p, sheet: sheet.name, row: r });
          const num = Number(E.digits(value("شماره روز", "شماه روز")));
          if (Number.isInteger(num) && num > 0) {
            const candidate = E.add(k, 1 - num);
            if (!origin) origin = candidate;
            else if (
              origin !== candidate &&
              !report.warnings.some((x) => x.includes("روزشماری"))
            )
              report.warnings.push(
                "شماره‌های روز با فاصلهٔ تقویمی همهٔ تاریخ‌ها سازگار نیست؛ مبنای روزشماری از اولین ردیف معتبر گرفته می‌شود.",
              );
          }
        } catch (err) {
          report.errors.push({
            sheet: sheet.name,
            row: r,
            message: err.message,
          });
        }
      }
    }
    report.startDate = origin;
    report.groups = draft.activities.filter((a) => !before.has(a.id));
    if (!report.plans.length && !report.tasks.length && !report.groups.length)
      throw Error(
        "برنامه یا کار معتبری برای ورود پیدا نشد. شیت برنامه باید سال، ماه و تاریخ داشته باشد.",
      );
    return report;
  }
  function applyReport(
    state,
    report,
    { overwrite = false, setStart = false } = {},
  ) {
    const next = structuredClone(state);
    let plans = 0,
      tasks = 0,
      skipped = 0;
    for (const group of report.groups)
      if (!E.findActivity(next, group.name)) next.activities.push({ ...group });
    const map = new Map(
      report.draft.activities.map((a) => [
        a.id,
        E.findActivity(next, a.name)?.id || a.id,
      ]),
    );
    for (const row of report.plans) {
      if (next.plans[row.date] && !overwrite) {
        skipped++;
        continue;
      }
      const p = {
        ...row.plan,
        blocks: Object.fromEntries(
          Object.entries(row.plan.blocks).map(([id, v]) => [
            map.get(id) || id,
            v,
          ]),
        ),
      };
      E.setPlan(next, row.date, p);
      plans++;
    }
    for (const task of report.tasks) {
      const old = next.tasks.find(
        (t) =>
          norm(t.project) === norm(task.project) &&
          norm(t.title) === norm(task.title),
      );
      if (old && !overwrite) {
        skipped++;
        continue;
      }
      if (!next.projects.includes(task.project))
        next.projects.push(task.project);
      const { sheet, row, ...clean } = task;
      if (old) {
        Object.assign(old, clean, { id: old.id });
        delete next.delivered[old.id];
      } else next.tasks.push(clean);
      tasks++;
    }
    if (setStart && report.startDate) next.startDate = report.startDate;
    E.validate(next);
    return { state: next, plans, tasks, skipped };
  }
  function buildWorkbook(ExcelJS, state, { year, month = null }) {
    const w = new ExcelJS.Workbook();
    w.creator = "Raval";
    const s = w.addWorksheet("برنامه روزانه", {
        views: [{ rightToLeft: true, state: "frozen", ySplit: 2, xSplit: 2 }],
      }),
      activities = state.activities.filter(
        (a) =>
          a.custom ||
          ["walk", "book", "platform", "technical", "chart"].includes(a.id),
      ),
      keys = month
        ? E.range(
            E.fromPersian(year, month, 1),
            E.fromPersian(year, month, E.monthLength(year, month)),
          )
        : E.range(E.first(year), E.add(E.first(year + 1), -1));
    const names = [
      "شماره روز",
      "روز",
      "تاریخ",
      "ماه",
      "سال",
      "بیدار باش",
      "روز خالی",
    ];
    names.forEach((n, i) => (s.getCell(1, i + 1).value = n));
    const columns = [];
    let c = 8;
    for (const a of activities) {
      const max = Math.max(
        a.special ? (a.id === "chart" ? 16 : 12) : 1,
        ...keys.map((k) => (E.plan(state, k).blocks[a.id] || []).length),
      );
      s.getCell(1, c).value = a.name;
      if (max > 1) s.mergeCells(1, c, 1, c + max - 1);
      for (let j = 0; j < max; j++)
        s.getCell(2, c + j).value = "بخش " + (j + 1);
      columns.push({ id: a.id, start: c, width: max });
      c += max;
    }
    s.getCell(1, c).value = "جمع مفید";
    keys.forEach((k, i) => {
      const r = i + 3,
        p = E.plan(state, k),
        j = E.persian(k),
        num = Math.round((E.date(k) - E.date(state.startDate)) / 86400000) + 1;
      [
        num,
        ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"][
          E.date(k).getDay()
        ],
        j.d,
        monthNames[j.m - 1],
        j.y,
        p.wake,
        p.off ? "بله" : "خیر",
      ].forEach((v, n) => (s.getCell(r, n + 1).value = v));
      for (const g of columns) {
        const list = p.blocks[g.id] || [];
        list.forEach((n, index) => (s.getCell(r, g.start + index).value = n));
      }
      s.getCell(r, c).value = E.blocks(state, k)
        .filter((b) => E.activity(state, b.id).useful)
        .reduce((n, b) => n + b.minutes, 0);
      if (p.off)
        s.getRow(r).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFFFEDB5" },
        };
    });
    for (let n = 1; n <= c; n++) s.getColumn(n).width = n <= 7 ? 15 : 10;
    const tasks = w.addWorksheet("کارها", {
      views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
    });
    tasks.addRow([
      "پروژه",
      "عنوان کار",
      "شهر / برچسب",
      "تاریخ شمسی",
      "ساعت",
      "یادآوری (دقیقه قبل)",
      "انجام شد",
    ]);
    for (const t of state.tasks)
      tasks.addRow([
        t.project,
        t.title,
        t.tags,
        t.date ? E.label(t.date) : "",
        t.time,
        t.lead,
        t.done ? "بله" : "خیر",
      ]);
    tasks.columns.forEach((c, i) => (c.width = i === 1 ? 40 : 22));
    const groups = w.addWorksheet("گروه‌ها", {
      views: [{ rightToLeft: true }],
    });
    groups.addRow(["نام فعالیت", "تخصصی", "زمان مفید"]);
    for (const a of activities)
      groups.addRow([
        a.name,
        a.special ? "بله" : "خیر",
        a.useful ? "بله" : "خیر",
      ]);
    groups.columns.forEach((c) => (c.width = 25));
    const guide = w.addWorksheet("راهنما", { views: [{ rightToLeft: true }] });
    [
      "این فایل قالب ورودی روال است. برنامه روزانه، کارها و گروه‌ها به بخش خودشان وارد می‌شوند.",
      "هر ردیف برنامه یک روز شمسی است؛ مقدار هر بخش دقیقه است. برای چند بخش، خانه‌های زیر همان گروه را پر کن.",
      "ساعت را به شکل 08:30 وارد کن. در فایل قدیمی 8.5 به معنی 08:30 و 8.45 به معنی 08:45 است.",
      "علامت * زمان مشخص ندارد و وارد بخش‌های برنامه نمی‌شود.",
      "ستون جمع مفید خروجی محاسبات است و هنگام ورود دوباره شمرده نمی‌شود.",
      "شیت کارها: پروژه و عنوان کار لازم است؛ تاریخ شمسی و ساعت برای یادآوری اختیاری‌اند.",
      "برای ورود، فایل را با پسوند xlsx ذخیره کن و در برنامه ابتدا پیش‌نمایش را بررسی کن.",
      "ورود اکسل برنامه و کار می‌سازد؛ زمان واقعی انجام یا تیک‌های انجام را از اعداد برنامه جعل نمی‌کند.",
    ].forEach((x) => guide.addRow([x]));
    guide.getColumn(1).width = 110;
    for (const sheet of w.worksheets) {
      const max = sheet === s ? 2 : 1;
      for (let r = 1; r <= max; r++) {
        const row = sheet.getRow(r);
        row.font = { bold: true, color: { argb: "FFFFFFFF" } };
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF087F69" },
        };
        row.alignment = { horizontal: "right", vertical: "middle" };
        row.height = 28;
      }
    }
    return w;
  }
  const api = { wakeTime, readWorkbook, applyReport, buildWorkbook, raw };
  if (typeof module !== "undefined") module.exports = api;
  else root.RavalExcel = api;
})(typeof window === "undefined" ? globalThis : window);
