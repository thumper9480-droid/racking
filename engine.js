/* Calendar, planning and time accounting. No browser dependencies. */
(function (root) {
  "use strict";
  const fmt = new Intl.DateTimeFormat("en-US-u-ca-persian", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
  const key = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const date = (k) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) throw Error("تاریخ نامعتبر است");
    const d = new Date(k + "T12:00:00");
    if (!Number.isFinite(+d) || key(d) !== k) throw Error("تاریخ نامعتبر است");
    return d;
  };
  const add = (k, n) => {
    const d = date(k);
    d.setDate(d.getDate() + n);
    return key(d);
  };
  const persian = (k) => {
    const p = Object.fromEntries(
      fmt
        .formatToParts(date(k))
        .filter((p) => ["year", "month", "day"].includes(p.type))
        .map((p) => [p.type, +p.value]),
    );
    return { y: p.year, m: p.month, d: p.day };
  };
  const first = (y) => {
    if (!Number.isInteger(y) || y < 1300 || y > 1600)
      throw Error("سال باید بین ۱۳۰۰ و ۱۶۰۰ باشد");
    for (let day = 19; day <= 23; day++) {
      const k = key(new Date(y + 621, 2, day, 12));
      const p = persian(k);
      if (p.y === y && p.m === 1 && p.d === 1) return k;
    }
    throw Error("سال نامعتبر است");
  };
  const monthLength = (y, m) =>
    m <= 6
      ? 31
      : m <= 11
        ? 30
        : Math.round((date(first(y + 1)) - date(first(y))) / 86400000) === 366
          ? 30
          : 29;
  function fromPersian(y, m, d) {
    if (
      !Number.isInteger(m) ||
      m < 1 ||
      m > 12 ||
      !Number.isInteger(d) ||
      d < 1 ||
      d > monthLength(y, m)
    )
      throw Error("روز یا ماه شمسی نامعتبر است");
    return add(first(y), (m <= 7 ? (m - 1) * 31 : 186 + (m - 7) * 30) + d - 1);
  }
  const digits = (s) =>
    String(s)
      .replace(/[۰-۹]/g, (c) => "۰۱۲۳۴۵۶۷۸۹".indexOf(c))
      .replace(/[٠-٩]/g, (c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c));
  function parsePersian(s) {
    const p = digits(s)
      .trim()
      .split(/[\/\-\.]/)
      .map(Number);
    if (p.length !== 3) throw Error("تاریخ را مثل ۱۴۰۵/۰۸/۰۱ وارد کن");
    return fromPersian(...p);
  }
  const label = (k) => {
    const p = persian(k);
    return `${p.y}/${String(p.m).padStart(2, "0")}/${String(p.d).padStart(2, "0")}`;
  };
  function parseParts(s) {
    s = digits(s).trim();
    if (!s || s === "-") return [];
    const p = s
      .split(/[ ,،+\n]+/)
      .filter(Boolean)
      .flatMap((x) => {
        const match = x.match(/^(\d+)[x×*](\d+)$/i);
        if (match) {
          const count = +match[1];
          if (count > 100) throw Error("حداکثر ۱۰۰ بخش در هر فعالیت");
          return Array(count).fill(+match[2]);
        }
        return [+x];
      });
    if (
      p.length > 100 ||
      p.some((n) => !Number.isInteger(n) || n < 1 || n > 720)
    )
      throw Error("هر بخش باید ۱ تا ۷۲۰ دقیقه باشد؛ مثلاً ۵ ۵ ۵");
    return p;
  }
  const ids = ["walk", "book", "platform", "technical", "chart"];
  const defaults = [20, 30, 15, 15, 35];
  const oldNames = [
    "پیاده‌روی / ورزش",
    "کتاب",
    "پلتفرم",
    "مطالعه تکنیکال",
    "تحلیل چارت",
    "استراحت",
    "خارج از برنامه",
  ];
  function fresh() {
    const activities = [
      ["walk", "پیاده‌روی / ورزش", true, false],
      ["book", "کتاب", true, false],
      ["platform", "پلتفرم", true, true],
      ["technical", "تکنیکال", true, true],
      ["chart", "تحلیل چارت", true, true],
      ["rest", "استراحت", false, false],
      ["instagram", "اینستا", false, false],
      ["wc", "دستشویی", false, false],
      ["family", "خانواده", false, false],
      ["idle", "علافی", false, false],
      ["sleep", "خواب", false, false],
      ["phone", "تماس تلفنی", false, false],
      ["outside", "خارج از برنامه", true, false],
    ].map(([id, name, useful, special]) => ({ id, name, useful, special }));
    const blocks = {
      walk: [20],
      book: [30],
      platform: [5, 5, 5],
      technical: [5, 5, 5],
      chart: [5, 5, 5, 5, 5, 5, 5],
    };
    return {
      version: 2,
      activities,
      templates: Array.from({ length: 7 }, () => ({
        wake: "07:00",
        off: false,
        blocks: JSON.parse(JSON.stringify(blocks)),
      })),
      plans: {},
      completions: {},
      progress: {},
      entries: [],
      tasks: [],
      projects: [
        "خانه بالا",
        "خانه پایین",
        "پشت‌بام",
        "دفتر",
        "پروژه‌های حاشیه‌ای",
        "خرید",
      ],
      active: null,
      paused: null,
      series: null,
      woke: 0,
      startDate: key(new Date()),
      delivered: {},
    };
  }
  function migrate(old) {
    if (old.version === 2) {
      validate(old);
      return old;
    }
    if (
      old.version !== 1 ||
      !Array.isArray(old.entries) ||
      !Array.isArray(old.tasks) ||
      !Array.isArray(old.projects) ||
      !Array.isArray(old.goals)
    )
      throw Error("نسخه پشتیبان پشتیبانی نمی‌شود");
    const s = fresh();
    s.projects = old.projects;
    s.tasks = old.tasks.map((t, i) => ({
      ...t,
      id: "legacy-" + i,
      date: "",
      time: "",
      lead: 0,
      completedAt: t.done ? Date.now() : null,
    }));
    s.entries = old.entries.map((e) => ({
      ...e,
      activity:
        ids[oldNames.indexOf(e.name)] ||
        { استراحت: "rest", "خارج از برنامه": "outside" }[e.name] ||
        "outside",
    }));
    for (const t of s.templates) {
      t.wake = old.wake || "07:00";
      ids.forEach((id, i) => {
        const n = old.goals[i];
        if (!Number.isFinite(n) || n < 0 || n > 1440)
          throw Error("هدف قبلی نامعتبر است");
        t.blocks[id] = n
          ? i >= 2 && n % 5 === 0 && n <= 500
            ? Array(n / 5).fill(5)
            : n > 720
              ? [720, n - 720]
              : [n]
          : [];
      });
    }
    s.woke = old.woke || 0;
    if (old.active) {
      s.active = {
        ...old.active,
        activity:
          ids[oldNames.indexOf(old.active.name)] ||
          { استراحت: "rest", "خارج از برنامه": "outside" }[old.active.name] ||
          "outside",
      };
    }
    validate(s);
    return s;
  }
  const activity = (s, id) => s.activities.find((a) => a.id === id);
  const plan = (s, k) => s.plans[k] || s.templates[date(k).getDay()];
  const blockKey = (k, id, index, n) => `${k}|${id}|${index}|${n}`;
  function blocks(s, k) {
    const p = plan(s, k);
    if (p.off) return [];
    return Object.entries(p.blocks).flatMap(([id, parts]) =>
      parts.map((minutes, index) => ({
        date: k,
        id,
        index,
        minutes,
        key: blockKey(k, id, index, minutes),
      })),
    );
  }
  function setPlan(s, k, p) {
    date(k);
    checkPlan(p, new Set(s.activities.map((a) => a.id)));
    s.plans[k] = JSON.parse(JSON.stringify(p));
  }
  function range(start, end) {
    date(start);
    date(end);
    if (end < start) throw Error("پایان بازه قبل از شروع است");
    const result = [];
    for (let k = start; k <= end; k = add(k, 1)) {
      result.push(k);
      if (result.length > 370) throw Error("بازه بیشتر از یک سال است");
    }
    return result;
  }
  function checkPlan(p, known) {
    if (
      !p ||
      typeof p.off !== "boolean" ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.wake) ||
      !p.blocks ||
      Array.isArray(p.blocks)
    )
      throw Error("برنامه نامعتبر است");
    for (const [id, list] of Object.entries(p.blocks)) {
      if (
        !known.has(id) ||
        !Array.isArray(list) ||
        list.length > 100 ||
        list.some((n) => !Number.isInteger(n) || n < 1 || n > 720)
      )
        throw Error("بخش زمانی نامعتبر است");
    }
    if (
      Object.values(p.blocks)
        .flat()
        .reduce((n, v) => n + v, 0) > 1440
    )
      throw Error("مجموع برنامهٔ یک روز نباید بیشتر از ۲۴ ساعت باشد");
  }
  function validate(s) {
    const fail = () => {
      throw Error("ساختار فایل پشتیبان معتبر نیست");
    };
    if (
      !s ||
      s.version !== 2 ||
      !Array.isArray(s.activities) ||
      !s.activities.length ||
      !Array.isArray(s.templates) ||
      s.templates.length !== 7 ||
      !Array.isArray(s.entries) ||
      !Array.isArray(s.tasks) ||
      !Array.isArray(s.projects) ||
      !s.projects.length ||
      !s.projects.every((p) => typeof p === "string") ||
      s.entries.length > 100000 ||
      s.tasks.length > 100000
    )
      fail();
    const known = new Set();
    for (const a of s.activities) {
      if (
        !/^[a-zA-Z0-9_-]{1,80}$/.test(a.id) ||
        known.has(a.id) ||
        typeof a.name !== "string" ||
        typeof a.useful !== "boolean" ||
        typeof a.special !== "boolean"
      )
        fail();
      known.add(a.id);
    }
    for (const id of [
      "rest",
      "instagram",
      "wc",
      "family",
      "idle",
      "sleep",
      "phone",
      "outside",
    ])
      if (!known.has(id)) fail();
    for (const p of s.templates) checkPlan(p, known);
    for (const prop of ["plans", "completions", "progress", "delivered"])
      if (!s[prop] || typeof s[prop] !== "object" || Array.isArray(s[prop]))
        fail();
    for (const [k, p] of Object.entries(s.plans)) {
      date(k);
      checkPlan(p, known);
    }
    for (const n of Object.values(s.progress))
      if (!Number.isFinite(n) || n < 0) fail();
    for (const b of Object.values(s.completions))
      if (typeof b !== "boolean") fail();
    for (const e of s.entries)
      if (
        !known.has(e.activity) ||
        !Number.isFinite(e.start) ||
        !Number.isFinite(e.end) ||
        e.end <= e.start ||
        typeof e.name !== "string" ||
        typeof e.note !== "string"
      )
        fail();
    const taskIds = new Set();
    for (const t of s.tasks) {
      if (
        typeof t.id !== "string" ||
        taskIds.has(t.id) ||
        typeof t.title !== "string" ||
        !s.projects.includes(t.project) ||
        typeof t.tags !== "string" ||
        typeof t.done !== "boolean"
      )
        fail();
      taskIds.add(t.id);
      if (t.date) date(t.date);
      if (t.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t.time)) fail();
      if (![0, 5, 10, 15, 30, 60].includes(t.lead)) fail();
    }
    date(s.startDate);
    for (const timer of [s.active, s.paused])
      if (timer) {
        if (
          !known.has(timer.activity) ||
          !Number.isFinite(timer.start) ||
          typeof timer.name !== "string" ||
          (timer.deadline !== undefined && !Number.isFinite(timer.deadline)) ||
          (timer.target !== undefined &&
            (!Number.isFinite(timer.target) || timer.target < 0))
        )
          fail();
        if (timer.planDate) date(timer.planDate);
      }
    if (s.series) {
      const q = s.series;
      if (
        !known.has(q.id) ||
        !Array.isArray(q.queue) ||
        !q.queue.length ||
        q.queue.length > 100 ||
        !Number.isInteger(q.position) ||
        q.position < 0 ||
        q.position >= q.queue.length ||
        !Number.isInteger(q.restMinutes) ||
        q.restMinutes < 0 ||
        q.restMinutes > 180 ||
        !["work", "rest"].includes(q.stage) ||
        typeof q.paused !== "boolean"
      )
        fail();
      date(q.date);
      for (const b of q.queue)
        if (
          b.id !== q.id ||
          b.date !== q.date ||
          !Number.isInteger(b.minutes) ||
          b.minutes < 1 ||
          b.minutes > 720 ||
          b.key !== blockKey(b.date, b.id, b.index, b.minutes)
        )
          fail();
    }
    return s;
  }
  function interval(k) {
    const d = date(k);
    d.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setDate(end.getDate() + 1);
    return [+d, +end];
  }
  function minutes(s, k, id = null) {
    const [lo, hi] = interval(k);
    return s.entries.reduce(
      (n, e) =>
        n +
        ((id ? e.activity === id : activity(s, e.activity)?.useful)
          ? Math.max(0, Math.min(hi, e.end) - Math.max(lo, e.start)) / 60000
          : 0),
      0,
    );
  }
  function stats(s, start, end) {
    const ks = range(start, end);
    let planned = 0,
      completed = 0,
      count = 0,
      done = 0,
      actual = 0;
    for (const k of ks) {
      for (const b of blocks(s, k)) {
        planned += b.minutes;
        count++;
        if (s.completions[b.key]) {
          completed += b.minutes;
          done++;
        }
      }
      actual += minutes(s, k);
    }
    const tasks = s.tasks.filter((t) => t.date >= start && t.date <= end);
    return {
      planned,
      completed,
      count,
      done,
      actual,
      tasks: tasks.length,
      tasksDone: tasks.filter((t) => t.done).length,
      percent: planned ? Math.round((100 * completed) / planned) : 0,
    };
  }
  function settle(s, now) {
    const a = s.active;
    if (!a) return;
    const end = a.deadline ? Math.min(now, a.deadline) : now;
    if (end > a.start) {
      s.entries.push({
        activity: a.activity,
        name: a.name,
        note: a.note || "",
        start: a.start,
        end,
        block: a.block || null,
        planDate: a.planDate || null,
      });
      if (a.block)
        s.progress[a.block] = (s.progress[a.block] || 0) + (end - a.start);
    }
    if (a.block && a.target && s.progress[a.block] >= a.target)
      s.completions[a.block] = true;
    s.active = null;
  }
  function startBlock(s, b, now = Date.now()) {
    settle(s, now);
    if (s.completions[b.key]) return;
    const target = b.minutes * 60000,
      remaining = Math.max(0, target - (s.progress[b.key] || 0));
    if (!remaining) {
      s.completions[b.key] = true;
      return;
    }
    const a = activity(s, b.id);
    s.active = {
      activity: b.id,
      name: a.name,
      start: now,
      block: b.key,
      planDate: b.date,
      target,
      deadline: now + remaining,
      note: "بخش برنامهٔ " + label(b.date),
    };
    s.paused = null;
  }
  function interrupt(s, id, now = Date.now(), note = "") {
    if (s.active?.block || s.active?.series) {
      const a = { ...s.active };
      a.remaining = Math.max(0, (a.deadline || now) - now);
      settle(s, now);
      if (!a.block || !s.completions[a.block]) s.paused = a;
      if (s.series) {
        if (s.paused) s.series.paused = true;
        else s.series = null;
      }
    } else settle(s, now);
    const a = activity(s, id);
    if (!a) throw Error("فعالیت پیدا نشد");
    s.active = { activity: id, name: a.name, start: now, note };
  }
  function resume(s, now = Date.now()) {
    if (!s.paused) return;
    settle(s, now);
    const a = s.paused;
    s.paused = null;
    if (s.completions[a.block]) return;
    const remaining =
      a.series && !a.block
        ? a.remaining
        : Math.max(0, a.target - (s.progress[a.block] || 0));
    if (!remaining) {
      if (a.block) s.completions[a.block] = true;
      return;
    }
    s.active = { ...a, start: now, deadline: now + remaining };
    if (s.series) s.series.paused = false;
  }
  function startSeries(s, k, id, restMinutes, now = Date.now()) {
    if (!Number.isInteger(restMinutes) || restMinutes < 0 || restMinutes > 180)
      throw Error("استراحت باید بین صفر تا ۱۸۰ دقیقه باشد");
    const queue = blocks(s, k).filter(
      (b) => b.id === id && !s.completions[b.key],
    );
    if (!queue.length) throw Error("بخش انجام‌نشده‌ای باقی نمانده");
    startBlock(s, queue[0], now);
    s.series = {
      date: k,
      id,
      restMinutes,
      queue,
      position: 0,
      stage: "work",
      paused: false,
    };
  }
  function advanceSeries(s, now = Date.now()) {
    const series = s.series;
    if (!series || series.paused) return;
    settle(s, now);
    if (series.stage === "work") {
      let next = series.position + 1;
      while (
        next < series.queue.length &&
        s.completions[series.queue[next].key]
      )
        next++;
      if (next >= series.queue.length) {
        s.series = null;
        return;
      }
      series.position = next;
      if (series.restMinutes > 0) {
        series.stage = "rest";
        s.active = {
          activity: "rest",
          name: activity(s, "rest").name,
          start: now,
          deadline: now + series.restMinutes * 60000,
          series: true,
          note: "استراحت بین بخش‌ها",
        };
        return;
      }
    }
    series.stage = "work";
    startBlock(s, series.queue[series.position], now);
  }

  function reminderTime(t) {
    return t.date && t.time
      ? +new Date(t.date + "T" + t.time + ":00") - t.lead * 60000
      : null;
  }
  const api = {
    key,
    date,
    add,
    persian,
    first,
    monthLength,
    fromPersian,
    parsePersian,
    label,
    digits,
    parseParts,
    fresh,
    migrate,
    validate,
    activity,
    plan,
    blocks,
    blockKey,
    setPlan,
    range,
    minutes,
    stats,
    settle,
    startBlock,
    interrupt,
    resume,
    startSeries,
    advanceSeries,
    reminderTime,
    interval,
  };
  if (typeof module !== "undefined") module.exports = api;
  else root.Raval = api;
})(typeof window === "undefined" ? globalThis : window);
