/* ============================================================
   Milo — training logic.

   Turns the log into what the four tabs show: calendar weeks,
   hard sets per muscle group, the weekly target for each group
   and how far along it is (Today's bars, the Body radar and its
   cards), the pace an even week needs by today and Body's
   sentence built on it, "this point last week", the week strip
   and the month calendar with their group dots, workouts and the
   week streak (History), what counted for a group this week,
   which skills feed it, and the one nudge. And the gym: the
   exercises (the catalogue plus your own), which sets were
   warm-ups, e1RM, one exercise's history and best set, and the
   double-progression suggestion for its next session. And
   progress: records, each exercise's chart, each muscle group's
   gym exercises, whether they got harder this week and the
   group's strength trend, body weight, and the axis a line chart
   is drawn on. Data only: the words the app shows are app.js's.

   Pure functions over plain values: no DOM, no storage, and no
   clock — whoever needs "this week" passes the time in — so
   tests/training-test.js runs them in Node. Every function takes
   any log (sanitized v5 entries of every kind, an empty log, or
   junk) without throwing.

   ONE piece of module state: the exercises registered with
   useExercises(state.exercises) — custom exercises and tweaks to
   built-in ones. Every gym lookup (exercise(), and through it what a
   gym entry counts for) reads it. The app calls useExercises()
   whenever its state changes; until then only the built-in
   exercises exist. Tests that register exercises must call it, and
   call useExercises([]) when they are done.

   Reads the tables in data.js (AREAS, GROUP_INFO, AREA_GROUPS,
   VARIATION_GROUPS, QUICK_GROUPS, GYM_EXERCISES, GYM_RETIRED) and the
   calendar-day helpers and sanitizeExercise in model.js, so it
   loads after both and before app.js.

   Dates: a week is Monday 00:00 to Sunday 23:59, local time. A
   day is the calendar day of an entry's ts (MODEL.dateStr), never
   its stored `date`. Days are stepped with MODEL.startOfDay /
   addDays and counted with dayDelta only — never by adding
   86400000 ms, which goes wrong in daylight-saving weeks (they
   are 167 or 169 hours long). Months are moved by the calendar
   (new Date(year, month + n, 1)), then days by addDays.

   Numbers: every weight is 1, ½ or ¼, so weekly totals are exact
   multiples of ¼ (floating point adds those without error). Zones
   are decided on the exact total; fmtSets() shows it as "9¾".
   Stored kg are multiples of 0.25 too, so the warm-up test and the
   suggestions compare exact values (see score()).
   ============================================================ */

var TRAINING = (function () {
  "use strict";

  var BUILD = "milo-v26";

  var GROUPS = MODEL.GROUPS;
  var startOfDay = MODEL.startOfDay;
  var addDays = MODEL.addDays;
  var dayDelta = MODEL.dayDelta;
  var dateStr = MODEL.dateStr;
  var isTraining = MODEL.isTraining;

  // Captured once: if data.js is from an older release these are
  // missing, this file fails to load, and app.js's build check shows
  // "finishing an update" instead of wrong numbers.
  var AREA_LIST = AREAS;
  var INFO = GROUP_INFO;
  var BY_AREA = AREA_GROUPS;
  var BY_VARIATION = VARIATION_GROUPS;
  var BY_QUICK = QUICK_GROUPS;
  var CATALOGUE = GYM_EXERCISES;
  var RETIRED_IDS = GYM_RETIRED;

  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December"];

  var ZONES = ["none", "low", "building", "on", "above"];
  var ZONE_LABELS = { none: "Not trained", low: "Low", building: "Building", on: "On target", above: "Above target" };

  /* ---------- Thresholds the tabs use ---------- */
  // Named so the explanations in the app and the tests use the same numbers.

  // A group gets its dot on a day, and counts as trained that day, once
  // that day's entries add up to 1 hard set for it. (A quick log's ¼ for
  // the helper groups alone isn't one.)
  var DOT_SETS = 1;
  // A week keeps the week streak going with this many workouts (days).
  var STREAK_WORKOUTS = 2;
  // weekHistory() gives this many weeks unless asked for another number,
  // and never more than MAX_HISTORY_WEEKS.
  var HISTORY_WEEKS = 8;
  var MAX_HISTORY_WEEKS = 104;
  // Nudge "untrained": a group with no hard set for this many days.
  var UNTRAINED_DAYS = 8;
  // …and a group never trained at all is only mentioned from this many
  // workouts on, so a new log isn't nagged about what it hasn't reached.
  var NEWCOMER_WORKOUTS = 3;
  // Nudge "behind": from Thursday (Monday = 0), a group below this share
  // of the bottom of its target range.
  var BEHIND_FROM_DAY = 3;
  var BEHIND_SHARE = 0.5;
  // Zones: "building" from this share of the bottom of the range (below
  // it, "low"). For the ⓘ's zone table: Low below lo × BUILDING_SHARE.
  var BUILDING_SHARE = 0.5;
  // The Body radar: each axis is sets ÷ the top of that group's range,
  // drawn up to this far. 1: the outer ring is the top of the target, and
  // more than that sits on it.
  var RADAR_MAX = 1;

  // The gym (see "The gym" below).
  // What kg means for an exercise (data.js, GYM_EXERCISES `load`).
  var LOADS = ["ext", "added", "assist", "bw"];
  // One hard set of an exercise counts 1 for its group and this for each
  // group it helps.
  var HELPER_WEIGHT = 0.5;
  // Warm-ups: a set of a loaded exercise is a working set when its e1RM is
  // at least this share of the entry's best set (compared exactly, as
  // 5 × e1RM ≥ 4 × best).
  var WARMUP_SHARE = 0.8;
  // Epley counts reps up to this many.
  var EPLEY_MAX_REPS = 20;
  // Double progression: more than this many calendar days since the last
  // session starts lighter ("return").
  var RETURN_DAYS = 42;
  // "return" and "deload" go to this share of the weight (rounded down to
  // the step), or add the other 10 % of help on an assisted machine.
  var BACKOFF = 0.9;
  // A step up bigger than this share of the weight aims BIG_JUMP_REPS
  // lower than the bottom of the range. Not for added weight (pull-ups,
  // dips): what you lift there is your body plus the kg, so 2.5 → 5 kg is
  // a few per cent, not double — and the app doesn't know your body weight.
  var BIG_JUMP = 0.1;
  var BIG_JUMP_REPS = 2;
  // Sets a suggestion asks for: the last session's working sets, this
  // many the first time, never more than MAX_SETS.
  var DEFAULT_SETS = 3;
  var MAX_SETS = 10;

  // The largest ms a Date can hold.
  var MAX_TIME = 8.64e15;

  /* ---------- Small helpers ---------- */

  // Names in the log are checked by format only, so a variant called
  // "constructor" is possible: look things up by own keys only.
  function own(obj, key) {
    return !!obj && typeof obj === "object" && Object.prototype.hasOwnProperty.call(obj, key);
  }

  // A fresh { group: weight } in GROUPS order, keeping only real groups
  // with a positive weight. Callers can change it freely: data.js's
  // tables are never handed out.
  function cleanWeights(map) {
    var out = {};
    GROUPS.forEach(function (g) {
      var w = own(map, g) ? Number(map[g]) : 0;
      if (isFinite(w) && w > 0) out[g] = w;
    });
    return out;
  }

  // Adds n × weights into acc (both { group: number }).
  function addInto(acc, weights, n) {
    GROUPS.forEach(function (g) {
      if (own(weights, g)) acc[g] = (acc[g] || 0) + weights[g] * n;
    });
    return acc;
  }

  function zeros() {
    var o = {};
    GROUPS.forEach(function (g) { o[g] = 0; });
    return o;
  }

  // Nearest ¼. Totals are exact already; this only guards the output
  // against a future weight that isn't a quarter.
  function quarter(x) { return Math.round(x * 4) / 4; }

  // One of the six group names (never an inherited name like "constructor").
  function isGroup(g) { return GROUPS.indexOf(g) !== -1; }

  // A lookup table keyed by data: no inherited keys at all.
  function dict() { return Object.create(null); }

  // A time a Date can hold (a number, or a Date).
  function validTime(ts) {
    if (ts === null || ts === undefined || ts === "") return false;
    var t = Number(ts);
    return isFinite(t) && Math.abs(t) <= MAX_TIME;
  }

  // An entry's ts, or NaN when it isn't an entry with a usable time.
  function timeOf(e) {
    if (!e || typeof e !== "object") return NaN;
    var t = Number(e.ts);
    return (t > 0 && t <= MAX_TIME) ? t : NaN;
  }

  // Local midnight starting the day containing ts, and the next one, as ms.
  function dayStart(ts) { return startOfDay(ts).getTime(); }
  function nextDay(ts) { return addDays(startOfDay(ts), 1).getTime(); }

  // The entries with from ≤ ts < to, in log order.
  function between(log, from, to) {
    if (!Array.isArray(log)) return [];
    return log.filter(function (e) {
      var t = timeOf(e);
      return t >= from && t < to;
    });
  }

  // Hard sets per group that some entries add up to: all six keys.
  function totals(entries) {
    var acc = zeros();
    entries.forEach(function (e) { addInto(acc, groupWeights(e), 1); });
    GROUPS.forEach(function (g) { acc[g] = quarter(acc[g]); });
    return acc;
  }

  // The groups those entries give at least DOT_SETS hard sets, in GROUPS order.
  function dotted(entries) {
    var acc = totals(entries);
    return GROUPS.filter(function (g) { return acc[g] >= DOT_SETS; });
  }

  // Of those, the groups trained DIRECTLY: the ones whose direct credit
  // alone (directWeights) reaches DOT_SETS, in GROUPS order. Always a
  // subset of dotted(entries): direct credit is part of the total.
  function directDots(entries) {
    var acc = zeros();
    entries.forEach(function (e) { addInto(acc, directWeights(e), 1); });
    return GROUPS.filter(function (g) { return quarter(acc[g]) >= DOT_SETS; });
  }

  /* ---------- Weeks ---------- */

  // Monday 00:00 local time of the week containing ts, as ms.
  function weekStart(ts) {
    var d = startOfDay(ts);
    return addDays(d, -((d.getDay() + 6) % 7)).getTime();
  }

  // Monday 00:00 of the week n weeks after (before, if negative) the one containing ts.
  function addWeeks(ts, n) {
    return addDays(new Date(weekStart(ts)), 7 * n).getTime();
  }

  // "21–27 Sep", "28 Sep – 4 Oct", "28 Dec 2026 – 3 Jan 2027". Plain text.
  // short: leave the years out even across New Year ("28 Dec – 3 Jan"),
  // for places too narrow for the full form.
  function weekLabel(ts, short) {
    var a = new Date(weekStart(ts));
    var b = addDays(a, 6);
    var am = MONTHS[a.getMonth()], bm = MONTHS[b.getMonth()];
    if (a.getFullYear() !== b.getFullYear() && !short) {
      return a.getDate() + " " + am + " " + a.getFullYear() + " \u2013 " + b.getDate() + " " + bm + " " + b.getFullYear();
    }
    if (a.getMonth() !== b.getMonth()) return a.getDate() + " " + am + " \u2013 " + b.getDate() + " " + bm;
    return a.getDate() + "\u2013" + b.getDate() + " " + am;
  }

  // The entries logged in the week containing ts, in log order.
  function inWeek(log, ts) {
    if (!Array.isArray(log)) return [];
    var from = weekStart(ts), to = addWeeks(from, 1);
    return log.filter(function (e) {
      if (!e || typeof e !== "object") return false;
      var t = Number(e.ts);
      return t >= from && t < to;
    });
  }

  /* ---------- What one entry counts for ---------- */

  // What one hard set of a ladder exercise counts for: the variation's
  // own map if it has one, else the step's override, else the area's.
  // Unknown areas count for nothing; unknown variations count as the step.
  function setWeights(areaId, step, variant) {
    if (!own(BY_AREA, areaId)) return {};
    var area = BY_AREA[areaId];
    var vars = own(BY_VARIATION, areaId) ? BY_VARIATION[areaId] : null;
    if (typeof variant === "string" && variant && own(vars, variant) && vars[variant] !== "step") {
      return cleanWeights(vars[variant]);
    }
    var s = Math.round(Number(step));
    if (own(area.step, String(s))) return cleanWeights(area.step[s]);
    return cleanWeights(area.all);
  }

  // Hard sets in a ladder entry: every set or hold with a value above 0.
  // (The app only saves positive values; a 0 in an old or restored
  // entry is a failed attempt and counts for nothing.)
  // In a gym entry: its working sets (workingSets(): warm-ups and sets of
  // 0 reps left out).
  function hardSets(e) {
    if (!e || !Array.isArray(e.sets)) return 0;
    if (e.kind === "gym") return workingSets(e).filter(Boolean).length;
    var n = 0;
    e.sets.forEach(function (x) { var v = Number(x); if (isFinite(v) && v > 0) n++; });
    return n;
  }

  // The lines of a quick log that count, in GROUPS order: one per group it
  // lists with a whole number of sets above 0.
  //   [{ group, sets, weights }]   weights: QUICK_GROUPS[group], cleaned
  // groupWeights() adds these up and breakdown() lists them, so the two
  // can't disagree.
  function quickLines(e) {
    var out = [];
    if (!e || typeof e !== "object" || e.kind !== "quick" || !e.groups || typeof e.groups !== "object") return out;
    GROUPS.forEach(function (g) {
      if (!own(e.groups, g) || !own(BY_QUICK, g)) return;
      var sets = Math.round(Number(e.groups[g]));
      if (isFinite(sets) && sets > 0) out.push({ group: g, sets: sets, weights: cleanWeights(BY_QUICK[g]) });
    });
    return out;
  }

  // What a gym entry counts for: { sets, weights } — its working sets, and
  // one set's worth per group (exWeights) — or null when it counts for
  // nothing: not a gym entry, an exercise nobody knows (it can't be
  // counted), or no working set. groupWeights() adds it up and
  // breakdown() lists it, so the two can't disagree.
  function gymLine(e) {
    if (!e || typeof e !== "object" || e.kind !== "gym") return null;
    var ex = exRec(e.exId);
    if (!ex) return null;
    var n = hardSets(e);
    return n ? { sets: n, weights: exWeights(ex) } : null;
  }

  // What one log entry adds to the week, in hard sets per group:
  // { group: sets }, groups in GROUPS order, zeros left out.
  //   ladder  hardSets × setWeights(area, step, variant)
  //   quick   n sets of a group → n × QUICK_GROUPS[group]
  //   gym     working sets × { its group: 1, each group it helps: ½ }
  //           (warm-ups and 0-rep sets left out); an exercise nobody
  //           knows (not built in, not registered) counts for nothing.
  //           A deleted exercise of your own still counts.
  //   body    a weigh-in: nothing, ever
  function groupWeights(e) {
    if (!e || typeof e !== "object") return {};
    var acc = {};
    if (e.kind === undefined) {
      var n = hardSets(e);
      if (n) addInto(acc, setWeights(e.areaId, e.step, e.variant), n);
    } else if (e.kind === "gym") {
      var g = gymLine(e);
      if (g) addInto(acc, g.weights, g.sets);
    } else {
      quickLines(e).forEach(function (q) { addInto(acc, q.weights, q.sets); });
    }
    return cleanWeights(acc);
  }

  // The group(s) one skill set is FOR: those with the highest weight in
  // what it counts for, in GROUPS order. One group as a rule; two when
  // they tie (wall headstands: shoulders ½, abs ½); none for {}.
  function topGroups(weights) {
    var top = 0;
    GROUPS.forEach(function (g) { if (own(weights, g) && weights[g] > top) top = weights[g]; });
    return GROUPS.filter(function (g) { return top > 0 && own(weights, g) && weights[g] === top; });
  }

  // The part of groupWeights(e) that is DIRECT work, { group: sets }:
  //   ladder  hardSets × the weight of the group(s) the set is for
  //           (topGroups): chest for pushups; shoulders AND abs, ½ each,
  //           for the two balance holds at the foot of the handstand ladder
  //   gym     working sets × 1 for the exercise's own group (p); the groups
  //           it helps (s) never — also when this version doesn't know p
  //   quick   n × 1 for each group the log lists; their ¼ helpers never
  // What it leaves out is the help. Never more than groupWeights(e) for
  // any group, so a bright dot is always a dot.
  function directWeights(e) {
    if (!e || typeof e !== "object") return {};
    var acc = {};
    if (e.kind === undefined) {
      var n = hardSets(e), w = setWeights(e.areaId, e.step, e.variant);
      if (n) topGroups(w).forEach(function (g) { acc[g] = n * w[g]; });
    } else if (e.kind === "gym") {
      var line = gymLine(e), ex = line ? exRec(e.exId) : null;
      if (ex && isGroup(ex.p) && own(line.weights, ex.p)) acc[ex.p] = line.sets * line.weights[ex.p];
    } else {
      quickLines(e).forEach(function (q) {
        if (own(q.weights, q.group)) acc[q.group] = (acc[q.group] || 0) + q.sets * q.weights[q.group];
      });
    }
    return cleanWeights(acc);
  }

  /* ---------- A week's volume ---------- */

  // Hard sets per group for the week containing ts (any moment of it):
  // { chest, back, shoulders, arms, abs, legs }, all six keys, exact to ¼.
  function weekVolume(log, ts) {
    var acc = zeros();
    inWeek(log, ts).forEach(function (e) { addInto(acc, groupWeights(e), 1); });
    GROUPS.forEach(function (g) { acc[g] = quarter(acc[g]); });
    return acc;
  }

  // The same, but only from the week's Monday 00:00 up to the end of the
  // calendar day containing ts (the rest of the week left out). All six
  // keys, exact to ¼; six zeros for a ts that isn't a time.
  function weekVolumeUntil(log, ts) {
    if (!validTime(ts)) return zeros();
    return totals(between(log, weekStart(ts), nextDay(ts)));
  }

  // "This point last week": last week from its Monday 00:00 to the end of
  // the same weekday as now (a Wednesday is compared with a Wednesday,
  // whatever the hour). For "+2 vs this point last week" (this week's
  // weekVolume minus this) and the Body radar's dashed shape. The day is
  // found by the calendar, 7 days back, so a daylight-saving week (167 or
  // 169 hours) moves nothing.
  function lastWeekToDate(log, now) {
    if (!validTime(now)) return zeros();
    return weekVolumeUntil(log, addDays(startOfDay(now), -7).getTime());
  }

  /* ---------- Targets and zones ---------- */

  // The base weekly range from settings, or the default if it isn't one.
  function baseVol(vol) {
    if (Array.isArray(vol) && vol.length === 2) {
      var lo = Number(vol[0]), hi = Number(vol[1]);
      if (isFinite(lo) && isFinite(hi) && lo >= 1 && lo <= hi) return [lo, hi];
    }
    return MODEL.defaultSettings().vol;
  }

  function scaleOf(g) {
    var s = own(INFO, g) ? Number(INFO[g].scale) : 1;
    return (isFinite(s) && s > 0) ? s : 1;
  }

  // { group: [lo, hi] } — the base range (state.settings.vol) times each
  // group's scale: [10, 20] gives arms and legs [20, 40].
  function targets(vol) {
    var b = baseVol(vol), out = {};
    GROUPS.forEach(function (g) { var s = scaleOf(g); out[g] = [b[0] * s, b[1] * s]; });
    return out;
  }

  // Where n hard sets stand against the range lo–hi:
  //   "none"      0 (or nothing readable)
  //   "low"       above 0, below lo/2 (lo × BUILDING_SHARE)
  //   "building"  lo/2 up to, not including, lo
  //   "on"        lo to hi, both included
  //   "above"     above hi
  function zone(n, lo, hi) {
    n = Number(n);
    if (!(n > 0)) return "none";
    if (n < lo * BUILDING_SHARE) return "low";
    if (n < lo) return "building";
    if (n <= hi) return "on";
    return "above";
  }

  /* ---------- Pace ---------- */

  // Which day of its week now is: Monday 1 … Sunday 7 ("day 3 of 7").
  // 0 for a time that isn't one.
  function dayOfWeek(now) {
    if (!validTime(now)) return 0;
    var d = dayDelta(weekStart(now), now) + 1;
    return d >= 1 && d <= 7 ? d : 0;
  }

  // The sets an even pace needs by the end of today: lo × dayOfWeek(now) ÷ 7,
  // not rounded (Wednesday, lo 10: 4.2857…; the ▴ sits there). 0 for a
  // time or lo that isn't one.
  function pace(lo, now) {
    var l = Number(lo);
    if (!(l > 0) || !isFinite(l)) return 0;
    return l * dayOfWeek(now) / 7;
  }

  // Where n sets stand this week, with the pace:
  //   "none"    0 (or nothing readable)    "None this week"
  //   "behind"  above 0, below pace()      "… · behind pace"
  //   "onpace"  pace() or more, below lo   "… · on pace"
  //   "on"      lo to hi                   "On target"
  //   "above"   above hi                   "Above target"
  // "none", "on" and "above" are exactly zone()'s; "behind" and "onpace"
  // split its "low" and "building". Pace is never 0 (today counts: Monday
  // already expects lo/7), so for pace "none" is behind too; verdict()
  // lists it there. Compared as n × 7 ≥ lo × day, exactly: sets are
  // quarters and lo a whole number, so there is no rounding at the edge.
  function paceZone(sets, lo, hi, now) {
    var n = Number(sets), z = zone(n, lo, hi);
    if (z === "none" || z === "on" || z === "above") return z;
    return n * 7 >= Number(lo) * dayOfWeek(now) ? "onpace" : "behind";
  }

  // Everything the six weekly bars need, one row per group in GROUPS order.
  function weekSummary(log, ts, vol) {
    var sets = weekVolume(log, ts), t = targets(vol);
    return GROUPS.map(function (g) {
      return { group: g, sets: sets[g], lo: t[g][0], hi: t[g][1], zone: zone(sets[g], t[g][0], t[g][1]) };
    });
  }

  // Body's one sentence ("On target: Back. On pace: Chest, Shoulders.
  // Behind: Legs, Abs, Arms."): the six groups of the week containing now,
  // by paceZone():
  //   on      "on" and "above": on target, or past it (GROUPS order)
  //   onPace  "onpace" (GROUPS order)
  //   behind  "behind" and "none", furthest behind first: by sets ÷ lo,
  //           lowest first, ties in GROUPS order
  //   above   the groups of `on` that are past the top ("above"), GROUPS
  //           order: a subset of `on`, for anyone who wants to say so
  // Every group is in exactly one of on, onPace and behind. The sets are
  // the whole week's (weekVolume, the bars' numbers). All four empty for a
  // time that isn't one.
  function verdict(log, now, vol) {
    var out = { on: [], onPace: [], behind: [], above: [] };
    if (!validTime(now)) return out;
    var sets = weekVolume(log, now), t = targets(vol);
    GROUPS.forEach(function (g) {
      var z = paceZone(sets[g], t[g][0], t[g][1], now);
      if (z === "on" || z === "above") out.on.push(g);
      if (z === "above") out.above.push(g);
      if (z === "onpace") out.onPace.push(g);
      if (z === "behind" || z === "none") out.behind.push(g);
    });
    out.behind.sort(function (a, b) {
      return (sets[a] / t[a][0] - sets[b] / t[b][0]) || (GROUPS.indexOf(a) - GROUPS.indexOf(b));
    });
    return out;
  }

  // The weekly sets of the last n weeks, oldest first, this week last:
  //   [{ start: Monday 00:00 (ms), label: weekLabel(start, true), sets: weekVolume }]
  // The same numbers as the bars for each week (a whole week each, as
  // weekVolume counts it). For the group sheet's 8-week bars. (The Body
  // radar's ghost is lastWeekToDate(), not a whole week.)
  // n: 1–MAX_HISTORY_WEEKS; anything that isn't a number gives HISTORY_WEEKS.
  function weekHistory(log, now, n) {
    if (!validTime(now)) return [];
    var k = (n === null || n === undefined || n === "") ? NaN : Math.round(Number(n));
    if (!isFinite(k)) k = HISTORY_WEEKS;
    k = Math.max(1, Math.min(MAX_HISTORY_WEEKS, k));
    var cur = weekStart(now), out = [];
    for (var i = k - 1; i >= 0; i--) {
      var s = addWeeks(cur, -i);
      out.push({ start: s, label: weekLabel(s, true), sets: weekVolume(log, s) });
    }
    return out;
  }

  /* ---------- One group ---------- */

  // Hard sets entry e adds to one group: groupWeights(e)[group], exact
  // to ¼, 0 when it adds nothing or the group isn't one of the six.
  function contribution(e, group) {
    if (!isGroup(group)) return 0;
    var w = groupWeights(e);
    return own(w, group) ? w[group] : 0;
  }

  // "What counted" for a group in the week containing now: one row per
  // source, newest first.
  //   [{ entry, sets, weight, own, listed, logged }]
  //   entry   the log's own object (don't change it)
  //   sets    what the row adds to the group: logged × weight. All rows
  //           together add up exactly to the group's bar (weekVolume).
  //   weight  what one set of it counts here: 1 or ½ for a skill set
  //           (setWeights, the variation's own map when it has one) or a
  //           gym exercise (1 for its group, ½ for a group it helps), 1 or
  //           ¼ for a quick log's line
  //   own     true when the sets were for this group itself (weight 1: the
  //           group the exercise is for, or the quick log's line for it);
  //           false when they only helped ("6 chest sets, helping")
  //   listed  a quick log's line: the group it was logged for ("chest");
  //           null for a skill or gym entry
  //   logged  the sets that were logged: a skill entry's hard sets, a gym
  //           entry's working sets (warm-ups left out), or the number on
  //           the quick log's line
  // A skill or gym entry is one row. A quick log is one row per group it
  // lists that counts here (NOTES "Notes for building P3" 2): one listing
  // chest 6 and shoulders 4 gives Shoulders two rows, 4 at 1 and 6 at ¼.
  // Rows of one quick log come own line first, then GROUPS order. Newest
  // first by ts; entries at the same ts, the later in the log first. Whole
  // week, like weekVolume; entries that add nothing (weigh-ins, gym
  // exercises nobody knows or with no working set) aren't listed.
  function breakdown(log, now, group) {
    if (!isGroup(group)) return [];
    var rows = [];
    inWeek(log, now).forEach(function (e, i) {
      if (e.kind === undefined) {
        var n = hardSets(e), w = setWeights(e.areaId, e.step, e.variant);
        if (n && own(w, group)) rows.push({ entry: e, sets: n * w[group], weight: w[group], own: w[group] >= 1, listed: null, logged: n, i: i, k: 0 });
        return;
      }
      if (e.kind === "gym") {
        var g = gymLine(e);
        if (g && own(g.weights, group)) {
          rows.push({ entry: e, sets: g.sets * g.weights[group], weight: g.weights[group], own: g.weights[group] >= 1, listed: null, logged: g.sets, i: i, k: 0 });
        }
        return;
      }
      quickLines(e).forEach(function (q) {
        if (!own(q.weights, group)) return;
        rows.push({
          entry: e, sets: q.sets * q.weights[group], weight: q.weights[group], own: q.group === group,
          listed: q.group, logged: q.sets, i: i, k: q.group === group ? 0 : 1 + GROUPS.indexOf(q.group)
        });
      });
    });
    rows.sort(function (a, b) { return (Number(b.entry.ts) - Number(a.entry.ts)) || (b.i - a.i) || (a.k - b.k); });
    return rows.map(function (r) {
      return { entry: r.entry, sets: r.sets, weight: r.weight, own: r.own, listed: r.listed, logged: r.logged };
    });
  }

  function areaById(id) {
    for (var i = 0; i < AREA_LIST.length; i++) if (AREA_LIST[i] && AREA_LIST[i].id === id) return AREA_LIST[i];
    return null;
  }
  function stepCount(a) { return (a && Array.isArray(a.steps)) ? a.steps.length : 0; }

  // The skill areas that train a group at one step or more (without a
  // variation), in AREAS order: feeders("shoulders") → pushup, bridge, hspu.
  function feeders(group) {
    if (!isGroup(group)) return [];
    return AREA_LIST.filter(function (a) {
      for (var s = 1; s <= stepCount(a); s++) if (own(setWeights(a.id, s, ""), group)) return true;
      return false;
    }).map(function (a) { return a.id; });
  }

  // Whether a group is an area's main job: its whole-area map counts a set
  // 1 for it (AREA_GROUPS[area].all[group] ≥ 1), whatever a step override
  // says. Bridges' step 1 gives legs 1, but legs isn't bridges' main job.
  function isMain(areaId, group) {
    if (!isGroup(group) || !own(BY_AREA, areaId)) return false;
    var all = BY_AREA[areaId].all;
    return own(all, group) && Number(all[group]) >= 1;
  }

  // The feeders whose main job is the group, in AREAS order: chest →
  // pushup; back → pullup, bridge; shoulders → hspu; arms → none (the
  // Body row then says "Helped by …": feedersAt()'s rows with a weight);
  // abs → legraise; legs → squat.
  function mainFeeders(group) {
    return feeders(group).filter(function (id) { return isMain(id, group); });
  }

  // The step an area is on, from { areaId: step } or state.areas
  // ({ areaId: { step } }); a missing or impossible step is step 1.
  function stepOf(stepsByArea, id) {
    var v = own(stepsByArea, id) ? stepsByArea[id] : null;
    if (v && typeof v === "object") v = own(v, "step") ? v.step : null;
    var s = (v === null || v === undefined || typeof v === "boolean") ? NaN : Math.round(Number(v));
    return (s >= 1 && s <= stepCount(areaById(id))) ? s : 1;
  }

  // One set's worth for a group at an area's step (no variation): 1, ½ or 0.
  function weightAt(id, step, group) {
    var w = setWeights(id, step, "");
    return own(w, group) ? w[group] : 0;
  }

  // The feeders at the steps they're on now:
  //   [{ areaId, step, weight, main, fromStep, fromWeight }]
  //   weight      one set's worth for the group at that step: 1, ½, or 0
  //               when that step doesn't train it (bridges step 2 for
  //               shoulders; handstands step 5 for abs)
  //   main        the group is the area's main job (see isMain)
  //   fromStep    the first later step at which one set counts for more
  //               than now ("from step 3"; for a 0, the step it starts
  //               counting at), and fromWeight what it counts there; both
  //               null when no later step counts more (handstands for abs
  //               past step 3: it never will again)
  // Main job first, then heaviest at the current step, then AREAS order.
  // stepsByArea as for stepOf(). Every feeder is listed, 0s included.
  function feedersAt(group, stepsByArea) {
    return feeders(group).map(function (id, i) {
      var s = stepOf(stepsByArea, id), wt = weightAt(id, s, group), next = null;
      for (var k = s + 1; k <= stepCount(areaById(id)) && !next; k++) {
        var w2 = weightAt(id, k, group);
        if (w2 > wt) next = { step: k, weight: w2 };
      }
      return { areaId: id, step: s, weight: wt, main: isMain(id, group), next: next, i: i };
    }).sort(function (x, y) { return (y.main - x.main) || (y.weight - x.weight) || (x.i - y.i); })
      .map(function (r) {
        return {
          areaId: r.areaId, step: r.step, weight: r.weight, main: r.main,
          fromStep: r.next ? r.next.step : null, fromWeight: r.next ? r.next.weight : null
        };
      });
  }

  // For the nudge's last sentence ("Today's session starts with squats" /
  // "includes …"): the first area of a session (area ids in session order,
  // e.g. app.js's todaysMovements()) whose set counts 1 for the group at
  // its step, and its place in the session — { areaId, index }, index 0
  // meaning the session starts with it — or null when none does.
  // stepsByArea as for stepOf(). Whether the session is done is the app's.
  function sessionFeeder(group, areaIds, stepsByArea) {
    if (!isGroup(group) || !Array.isArray(areaIds)) return null;
    for (var i = 0; i < areaIds.length; i++) {
      var id = areaIds[i];
      if (typeof id !== "string" || !areaById(id)) continue;
      if (weightAt(id, stepOf(stepsByArea, id), group) >= 1) return { areaId: id, index: i };
    }
    return null;
  }

  // For each group, the ts of the last time it was trained, at or before
  // now: the latest day whose entries (at or before now) add up to
  // DOT_SETS hard sets for it — the day its dot shows — and on that day
  // the latest entry that added to it. 0 when never.
  function lastTrainedAll(log, now) {
    var out = {}, days = dict(), end = validTime(now) ? Number(now) : NaN;
    GROUPS.forEach(function (g) { out[g] = 0; });
    if (!Array.isArray(log)) return out;
    log.forEach(function (e) {
      var t = timeOf(e);
      if (!(t <= end)) return;
      var w = groupWeights(e), key = null;
      GROUPS.forEach(function (g) {
        if (!own(w, g)) return;
        key = key || dateStr(t);
        var d = days[g + " " + key] || (days[g + " " + key] = { g: g, sets: 0, last: 0 });
        d.sets += w[g];
        if (t > d.last) d.last = t;
      });
    });
    Object.keys(days).forEach(function (k) {
      var d = days[k];
      if (quarter(d.sets) >= DOT_SETS && d.last > out[d.g]) out[d.g] = d.last;
    });
    return out;
  }
  function lastTrained(log, group, now) {
    return isGroup(group) ? lastTrainedAll(log, now)[group] : 0;
  }

  // Whole calendar days from ts to now: 0 today (or for a later ts),
  // 1 yesterday. null when there's no ts (never).
  function daysSince(ts, now) {
    var t = Number(ts);
    if (!(t > 0 && t <= MAX_TIME) || !validTime(now)) return null;
    return Math.max(0, dayDelta(t, now));
  }

  /* ---------- Days: the week strip and dots ---------- */

  // The groups that got at least DOT_SETS hard sets on the calendar day
  // containing ts (all of that day's entries together), in GROUPS order.
  // A quick log of 2 chest sets gives chest; its ½ for arms and shoulders
  // doesn't, unless something else that day adds the other ½.
  function dayGroups(log, ts) {
    if (!validTime(ts)) return [];
    return dotted(between(log, dayStart(ts), nextDay(ts)));
  }

  // Of dayGroups(log, ts), the groups trained directly that day (bright
  // dots); the rest only got there with help (faded dots).
  function dayDirect(log, ts) {
    if (!validTime(ts)) return [];
    return directDots(between(log, dayStart(ts), nextDay(ts)));
  }

  // Both at once, { groups, direct }, reading the day's entries one time
  // (the month calendar asks for every day it shows).
  function dayDots(log, ts) {
    if (!validTime(ts)) return { groups: [], direct: [] };
    var day = between(log, dayStart(ts), nextDay(ts));
    return { groups: dotted(day), direct: directDots(day) };
  }

  // The seven days, Monday first, of the week containing now:
  //   [{ key "YYYY-MM-DD", ts (local midnight), dow 0–6 (Monday 0),
  //      groups (dayGroups), trained, today, future }]
  // trained: the day is a workout (see below). A day after today
  // (future) shows nothing even if something is logged on it; today
  // shows everything logged on it.
  function weekStrip(log, now) {
    if (!validTime(now)) return [];
    var mon = new Date(weekStart(now)), today = dayStart(now);
    var week = between(log, mon.getTime(), addWeeks(mon.getTime(), 1));
    var out = [];
    for (var i = 0; i < 7; i++) {
      var t = addDays(mon, i).getTime();
      var that = t > today ? [] : between(week, t, addDays(mon, i + 1).getTime());
      out.push({
        key: dateStr(t), ts: t, dow: i,
        groups: dotted(that),
        direct: directDots(that),
        trained: that.some(isTraining),
        today: t === today,
        future: t > today
      });
    }
    return out;
  }

  /* ---------- Workouts and the week streak ---------- */

  // A workout is a calendar day with at least one training entry
  // (MODEL.isTraining: a skill session, a gym exercise or a quick log —
  // a weigh-in isn't training). Two sessions on one day: one workout.

  // { "YYYY-MM-DD": that day's midnight } for the workout days before
  // `until` (ms; left out: every day).
  function workoutDayMap(log, until) {
    var days = dict(), end = until === undefined ? Infinity : Number(until);
    if (!Array.isArray(log)) return days;
    log.forEach(function (e) {
      var t = timeOf(e);
      if (!(t < end) || !isTraining(e)) return;
      var k = dateStr(t);
      if (!(k in days)) days[k] = dayStart(t);
    });
    return days;
  }

  // Every workout day in the log, oldest first, as "YYYY-MM-DD".
  function workoutDays(log) {
    var days = workoutDayMap(log);
    return Object.keys(days).sort(function (a, b) { return days[a] - days[b]; });
  }

  // Workouts in the week containing now, up to and including today.
  function workoutsInWeek(log, now) {
    if (!validTime(now)) return 0;
    var from = weekStart(now), days = workoutDayMap(log, nextDay(now));
    return Object.keys(days).filter(function (k) { return days[k] >= from; }).length;
  }

  // Every workout in the log (days after today included: they are logged).
  function totalWorkouts(log) {
    return Object.keys(workoutDayMap(log)).length;
  }

  // Weeks in a row (Monday–Sunday) with at least STREAK_WORKOUTS workouts,
  // ending with this week. This week counts once it has them; until then
  // it doesn't break the streak, which is counted from last week. Days
  // after today don't count.
  function weekStreak(log, now) {
    if (!validTime(now)) return 0;
    var days = workoutDayMap(log, nextDay(now)), perWeek = dict();
    Object.keys(days).forEach(function (k) {
      var w = weekStart(days[k]);
      perWeek[w] = (perWeek[w] || 0) + 1;
    });
    var w = weekStart(now), n = 0;
    if (!((perWeek[w] || 0) >= STREAK_WORKOUTS)) w = addWeeks(w, -1);
    // Each step goes back one week; weeks without enough workouts end it.
    while ((perWeek[w] || 0) >= STREAK_WORKOUTS) { n++; w = addWeeks(w, -1); }
    return n;
  }

  /* ---------- Months: the History calendar ---------- */

  // Local midnight of the 1st of the month containing ts, as a Date.
  function firstOfMonth(ts) {
    var d = startOfDay(ts);
    return addDays(d, 1 - d.getDate());
  }

  // The month containing ts, as calendar rows of 7 days, Monday first,
  // with the days of the months before and after that complete the
  // first and last rows (4 to 6 rows):
  //   [[{ key "YYYY-MM-DD", ts (local midnight), day 1–31, inMonth }, …7], …]
  function monthGrid(ts) {
    if (!validTime(ts)) return [];
    var first = firstOfMonth(Number(ts)), month = first.getMonth();
    var start = addDays(first, -((first.getDay() + 6) % 7));
    var rows = [];
    for (var r = 0; r < 6; r++) {
      if (r && addDays(start, 7 * r).getMonth() !== month) break;
      var row = [];
      for (var c = 0; c < 7; c++) {
        var d = addDays(start, 7 * r + c);
        row.push({ key: dateStr(d.getTime()), ts: d.getTime(), day: d.getDate(), inMonth: d.getMonth() === month });
      }
      rows.push(row);
    }
    return rows;
  }

  // "September 2026". "" for a time that isn't one.
  function monthLabel(ts) {
    if (!validTime(ts)) return "";
    var d = new Date(Number(ts));
    return MONTH_NAMES[d.getMonth()] + " " + d.getFullYear();
  }

  // Local midnight of the same day n months later (earlier when n < 0),
  // the day clamped to the month's length: 31 Jan + 1 → 28 Feb (29 in a
  // leap year). n is rounded; NaN for a ts that isn't a time.
  function addMonths(ts, n) {
    if (!validTime(ts)) return NaN;
    var d = startOfDay(Number(ts)), k = Math.round(Number(n));
    if (!isFinite(k)) k = 0;
    var first = startOfDay(new Date(d.getFullYear(), d.getMonth() + k, 1).getTime());
    var len = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    return addDays(first, Math.min(d.getDate(), len) - 1).getTime();
  }

  /* ---------- The nudge ---------- */

  // At most one nudge about the muscle groups, or null:
  //   { group, kind: "untrained", days, sets, lo }
  //       a group with no hard set for UNTRAINED_DAYS days or more (see
  //       lastTrained); the longest wins. days is null for a group never
  //       trained, which outranks any number of days — and is only
  //       mentioned once the log has NEWCOMER_WORKOUTS workouts.
  //   { group, kind: "behind", sets, lo, daysLeft }
  //       otherwise, from Thursday: a group under BEHIND_SHARE of the
  //       bottom of its range this week; the lowest sets ÷ lo wins.
  //       daysLeft counts today (Thursday 4, Sunday 1).
  // sets and lo: the group's sets this week (weekVolume, the bar's
  // number) and the bottom of its range, for "x of lo sets so far this
  // week". Ties go to GROUPS order. Nothing before the first workout, and
  // nothing logged after now makes a group trained.
  function groupNudge(log, now, vol) {
    if (!validTime(now)) return null;
    var workouts = Object.keys(workoutDayMap(log, nextDay(now))).length;
    if (!workouts) return null;
    var last = lastTrainedAll(log, now), pick = null;
    var sets = weekVolume(log, now), t = targets(vol);
    GROUPS.forEach(function (g) {
      var d = daysSince(last[g], now);
      if (d === null ? workouts < NEWCOMER_WORKOUTS : d < UNTRAINED_DAYS) return;
      if (!pick || (pick.days !== null && (d === null || d > pick.days))) pick = { group: g, kind: "untrained", days: d, sets: sets[g], lo: t[g][0] };
    });
    if (pick) return pick;
    var dow = dayDelta(weekStart(now), now);
    if (!(dow >= BEHIND_FROM_DAY)) return null;
    var low = null;
    GROUPS.forEach(function (g) {
      var lo = t[g][0], share = sets[g] / lo;
      if (!(sets[g] < lo * BEHIND_SHARE)) return;
      if (!low || share < low.share) low = { group: g, share: share, sets: sets[g], lo: lo };
    });
    return low ? { group: low.group, kind: "behind", sets: low.sets, lo: low.lo, daysLeft: 7 - dow } : null;
  }

  /* ---------- The Body radar ---------- */

  // One axis: sets ÷ the top of the group's range, capped at RADAR_MAX (1:
  // the outer ring is the top of the target, and more sits on it); 0 for
  // nothing (or a range that isn't one). The band is [lo ÷ hi, 1]; the
  // dashed ghost is radarShare(lastWeekToDate(…)[g], hi).
  function radarShare(sets, hi) {
    var s = Number(sets), h = Number(hi);
    if (!(s > 0) || !(h > 0)) return 0;
    return Math.min(RADAR_MAX, s / h);
  }

  /* ---------- The gym: exercises ---------- */

  // The catalogue by id: permanent ids (data.js), looked up by own key.
  var BUILT_IN = dict();
  CATALOGUE.forEach(function (x) { if (x && typeof x.id === "string") BUILT_IN[x.id] = x; });

  // Built-in exercises taken out of the picker (data.js, GYM_RETIRED). They
  // still resolve, so sessions logged with them keep their name and count.
  var RETIRED = dict();
  RETIRED_IDS.forEach(function (id) { if (typeof id === "string") RETIRED[id] = true; });

  // THE ONE PIECE OF MODULE STATE: every exercise that resolves, by id —
  // the built-in ones merged with their tweaks, and your own. Replaced
  // whole by useExercises(); never changed in place.
  var resolved = dict();

  // A built-in exercise with its tweak (or null), as exercise() hands it out.
  function resolveBuiltIn(b, o) {
    var range = o && o.lo !== null && o.hi !== null;
    return {
      id: b.id, name: b.name, p: b.p, s: b.s.slice(), equip: b.equip,
      lo: range ? o.lo : b.lo, hi: range ? o.hi : b.hi,
      inc: o && o.inc !== null ? o.inc : b.inc,
      perHand: b.perHand, load: b.load, timed: b.timed,
      note: o ? o.note : "", custom: false, del: false, retired: own(RETIRED, b.id), known: LOADS.indexOf(b.load) !== -1
    };
  }

  // One of your own ("x_" ids), sanitized: `group` becomes p (null when it
  // isn't one of the six) and `sec` becomes s.
  function resolveCustom(r) {
    var p = isGroup(r.group) ? r.group : null;
    return {
      id: r.id, name: r.name, p: p, s: r.sec.filter(function (g) { return isGroup(g) && g !== p; }), equip: r.equip,
      lo: r.lo, hi: r.hi, inc: r.inc, perHand: r.perHand, load: r.load, timed: r.timed,
      note: r.note, custom: true, del: r.del, retired: false, known: LOADS.indexOf(r.load) !== -1
    };
  }

  // Registers state.exercises — your own exercises ("x_" ids) and tweaks
  // to built-in ones (rep range, weight step, setup note) — for every gym
  // lookup: exercise(), exerciseList(), and what a gym entry counts for.
  // The one piece of state this file keeps (see the top). Each record goes
  // through MODEL.sanitizeExercise, so anything is safe to pass; for one
  // id listed twice the newer mts wins. A tweak for an id that isn't built
  // in is ignored. Anything that isn't a list registers nothing: only the
  // built-in exercises, untweaked.
  function useExercises(list) {
    var recs = dict();
    (Array.isArray(list) ? list : []).forEach(function (r) {
      var c = MODEL.sanitizeExercise(r);
      if (c && !(recs[c.id] && recs[c.id].mts > c.mts)) recs[c.id] = c;
    });
    var out = dict();
    Object.keys(BUILT_IN).forEach(function (id) { out[id] = resolveBuiltIn(BUILT_IN[id], recs[id] || null); });
    Object.keys(recs).forEach(function (id) {
      if (id.indexOf("x_") === 0 && !own(BUILT_IN, id)) out[id] = resolveCustom(recs[id]);
    });
    resolved = out;
  }

  // The registered record itself (don't change it), or null.
  function exRec(exId) {
    return (typeof exId === "string" && Object.prototype.hasOwnProperty.call(resolved, exId)) ? resolved[exId] : null;
  }

  function copyEx(x) {
    var c = {};
    Object.keys(x).forEach(function (k) { c[k] = x[k]; });
    c.s = x.s.slice();
    return c;
  }

  // An exercise, ready to show and to progress:
  //   { id, name, p, s, equip, lo, hi, inc, perHand, load, timed, note,
  //     custom, del, retired, known }
  //   p        the group one hard set counts 1 for (null for one of your
  //            own whose group isn't one of the six)
  //   s        the groups it counts ½ for, in GROUPS order
  //   lo, hi   rep range (seconds when timed); inc the kg step. A tweak's
  //            values replace the catalogue's when they aren't null.
  //   note     the setup note ("" when none)
  //   custom   one of your own ("x_" id)
  //   del      one of your own that was removed from the list: it still
  //            resolves, so old entries keep their name and still count
  //   retired  a built-in one taken out of the picker (GYM_RETIRED): it
  //            still resolves too, for the same reason
  //   known    this version knows what its kg mean (load is ext, added,
  //            assist or bw); false for a load type from a newer version:
  //            then every set with reps counts, and it progresses by reps
  // null for an id that is neither built in nor registered (the app shows
  // "Unknown exercise"), including names every object inherits. A fresh
  // copy each time.
  function exercise(exId) {
    var x = exRec(exId);
    return x ? copyEx(x) : null;
  }

  // Every exercise that isn't deleted or retired, built-in and your own, grouped by p
  // in GROUPS order (one without a group last), each group by name (case
  // ignored), then id. Fresh copies.
  function exerciseList() {
    var rank = function (x) { var i = GROUPS.indexOf(x.p); return i === -1 ? GROUPS.length : i; };
    var low = function (s) { return String(s).toLowerCase(); };
    return Object.keys(resolved).map(function (id) { return resolved[id]; })
      .filter(function (x) { return !x.del && !x.retired; })
      .sort(function (a, b) {
        return (rank(a) - rank(b)) ||
          (low(a.name) < low(b.name) ? -1 : (low(a.name) > low(b.name) ? 1 : 0)) ||
          (a.id < b.id ? -1 : (a.id > b.id ? 1 : 0));
      })
      .map(copyEx);
  }

  // One hard set of an exercise per group: { p: 1, each of s: ½ }.
  function exWeights(ex) {
    var w = {};
    ex.s.forEach(function (g) { if (isGroup(g)) w[g] = HELPER_WEIGHT; });
    if (isGroup(ex.p)) w[ex.p] = 1;
    return cleanWeights(w);
  }

  /* ---------- The gym: sets ---------- */

  // A number from a stored set: reps (or seconds), or kg.
  function num(x) {
    if (x === null || x === undefined || x === "" || typeof x === "boolean") return 0;
    var n = Number(x);
    return isFinite(n) ? n : 0;
  }
  // The kg of set i of a gym entry: 0 when missing or unusable, and always
  // 0 for a bodyweight-only exercise.
  function kgAt(e, i, ex) {
    if (ex && ex.load === "bw") return 0;
    var k = Array.isArray(e.kg) ? num(e.kg[i]) : 0;
    return k > 0 ? k : 0;
  }

  // e1RM × 30, exactly: kg × (30 + reps) with reps up to EPLEY_MAX_REPS,
  // kg × 30 for a single; 0 without weight or reps. Stored kg are
  // multiples of 0.25, so these are exact and compare without rounding.
  function score(kg, reps) {
    var w = num(kg), r = num(reps);
    if (!(w > 0) || !(r > 0)) return 0;
    return r === 1 ? w * 30 : w * (30 + Math.min(r, EPLEY_MAX_REPS));
  }

  // Estimated one-rep max (Epley): kg × (1 + min(reps, 20) / 30); a single
  // is its own kg; 0 when kg or reps is 0 or less (or not a number). For a
  // dumbbell exercise kg is per hand, and so is this.
  function e1rm(kg, reps) {
    return score(kg, reps) / 30;
  }

  // Whether this exercise's warm-ups can be told from its weights: an
  // external weight that isn't held for time. Not added weight (dips,
  // weighted chin-ups): the load there is body weight + the added kg, and
  // without body weight (weigh-ins come later) comparing the added kg alone
  // would call real working sets warm-ups.
  function filtersWarmups(ex) {
    return !!ex && !ex.timed && ex.load === "ext";
  }

  // Whether a gym entry carries warm-up marks made by hand (data v6): a
  // list, even one of all 0 ("every set counts"). Without one (null: the
  // entry was last written by a version without the marks) the old weight
  // rule below decides, so sessions from before keep their numbers.
  function hasMarks(e) {
    return !!e && e.kind === "gym" && Array.isArray(e.warm);
  }

  // Which sets of an entry are working sets: [true|false] per set.
  //   gym WITH marks (e.warm): every set with reps above 0 that isn't
  //     marked as a warm-up. Nothing is guessed.
  //   gym without marks, load ext (not timed), some set with kg > 0: a set
  //     is working when its e1RM is at least WARMUP_SHARE (0.8) of the
  //     entry's best set's — lighter sets were warm-ups. 60 × 12, then
  //     100 × 8, 8, 7 → [false, true, true, true].
  //   gym without marks, anything else (added, assist, bw, timed, all at
  //     0 kg, an exercise nobody knows): every set with reps above 0
  //   a skill entry: every set above 0 (as hardSets counts them)
  // A set of 0 reps is never working. Takes a draft too
  // ({ kind: "gym", exId, sets, kg, warm }); [] for anything without sets.
  function workingSets(e) {
    if (!e || typeof e !== "object" || !Array.isArray(e.sets)) return [];
    var reps = e.sets.map(num);
    if (hasMarks(e)) return reps.map(function (r, i) { return r > 0 && e.warm[i] !== 1 && e.warm[i] !== true; });
    var ex = e.kind === "gym" ? exRec(e.exId) : null;
    if (!filtersWarmups(ex)) return reps.map(function (r) { return r > 0; });
    var scores = reps.map(function (r, i) { return score(kgAt(e, i, ex), r); });
    var best = Math.max.apply(null, [0].concat(scores));
    if (!(best > 0)) return reps.map(function (r) { return r > 0; });
    // s ≥ 0.8 × best, exactly (both sides are multiples of 0.25).
    return scores.map(function (s, i) { return reps[i] > 0 && s * 5 >= best * 4; });
  }

  // Which sets of a gym entry are warm-ups, [true|false] per set: the marks
  // when it has them, else what the old rule says (a set with reps that
  // isn't a working set). What the gym sheet shows when an entry is opened.
  function warmups(e) {
    if (!e || typeof e !== "object" || !Array.isArray(e.sets)) return [];
    if (hasMarks(e)) return e.sets.map(function (r, i) { return e.warm[i] === 1 || e.warm[i] === true; });
    var work = workingSets(e);
    return e.sets.map(function (r, i) { return num(r) > 0 && !work[i]; });
  }

  // kg to a multiple of inc: mode "down" (floor), "up" (ceiling), anything
  // else the nearest. roundTo(56.25, 2.5, "down") → 55. An inc that isn't
  // above 0 counts as 0.25; kg that isn't a number gives 0.
  function roundTo(kg, inc, mode) {
    var x = Number(kg), step = Number(inc);
    if (kg === null || kg === "" || typeof kg === "boolean" || !isFinite(x)) return 0;
    if (!(step > 0) || !isFinite(step)) step = 0.25;
    var q = x / step, k;
    // The 1e-9 keeps floating-point noise from moving a whole step:
    // 1.1 × 25 = 27.500000000000004 is 27.5 up to 2.5, not 30, and
    // (1 − 0.9) × 25 = 2.4999999999999996 is 2.5 down, not 0.
    if (mode === "down") k = Math.floor(q + 1e-9);
    else if (mode === "up") k = Math.ceil(q - 1e-9);
    else k = Math.round(q);
    return Math.round(k * step * 1e6) / 1e6 + 0;
  }

  /* ---------- The gym: one exercise's history ---------- */

  // That exercise's gym entries, newest first (same ts: the later in the
  // log first). The log's own objects: don't change them.
  //   opts.before   a time: only entries on calendar days before the one
  //                 containing it (a before that isn't a time gives [])
  //   opts.exclude  an entry id to leave out (the one being edited)
  // Entries of any exercise id, known or not; entries with no working set
  // are listed too.
  function sessionsFor(log, exId, opts) {
    if (!Array.isArray(log) || typeof exId !== "string") return [];
    var o = (opts && typeof opts === "object") ? opts : {};
    var until = Infinity;
    if (o.before !== undefined && o.before !== null) {
      if (!validTime(o.before)) return [];
      until = dayStart(Number(o.before));
    }
    var skip = typeof o.exclude === "string" ? o.exclude : null;
    var out = [];
    log.forEach(function (e, i) {
      if (!e || typeof e !== "object" || e.kind !== "gym" || e.exId !== exId || !Array.isArray(e.sets)) return;
      var t = timeOf(e);
      if (!(t < until) || (skip !== null && e.id === skip)) return;
      out.push({ e: e, t: t, i: i });
    });
    out.sort(function (a, b) { return (b.t - a.t) || (b.i - a.i); });
    return out.map(function (x) { return x.e; });
  }

  // The newest of sessionsFor(log, exId, opts), or null.
  function lastSession(log, exId, opts) {
    return sessionsFor(log, exId, opts)[0] || null;
  }

  // How best() and suggest() treat an exercise's weight:
  //   "load"    more kg is harder (ext, and added with weight on)
  //   "assist"  less kg is harder (an assisted machine)
  //   "reps"    kg doesn't make it harder here: bodyweight only, timed,
  //             or a load type this version doesn't know
  function weightMode(ex) {
    if (!ex.known || ex.timed || ex.load === "bw") return "reps";
    return ex.load === "assist" ? "assist" : "load";
  }

  // The best working set of an exercise ever (or among sessionsFor(log,
  // exId, opts)): { kg, reps, e1rm, ts, id }
  //   ext / added  the highest e1RM (then the heavier, then more reps);
  //                sets without weight rank by reps below any set with
  //   assist       the least help (kg), then the most reps
  //   bw, timed    the most reps (seconds), then the most kg
  // e1rm is e1rm(kg, reps) for ext and added (0 without weight), 0 for the
  // others. A tie keeps the earliest set. null when there is no working
  // set, or the exercise is unknown.
  function best(log, exId, opts) {
    var ex = exRec(exId);
    if (!ex) return null;
    var mode = weightMode(ex), list = sessionsFor(log, exId, opts), top = null;
    var better = function (a, b) {
      if (mode === "load") {
        var sa = score(a.kg, a.reps), sb = score(b.kg, b.reps);
        if (sa !== sb) return sa > sb;
        return a.kg !== b.kg ? a.kg > b.kg : a.reps > b.reps;
      }
      if (mode === "assist") return a.kg !== b.kg ? a.kg < b.kg : a.reps > b.reps;
      return a.reps !== b.reps ? a.reps > b.reps : a.kg > b.kg;
    };
    for (var k = list.length - 1; k >= 0; k--) {
      var e = list[k], flags = workingSets(e);
      for (var i = 0; i < e.sets.length; i++) {
        if (!flags[i]) continue;
        var c = { kg: kgAt(e, i, ex), reps: num(e.sets[i]), ts: timeOf(e), id: e.id };
        if (!top || better(c, top)) top = c;
      }
    }
    if (!top) return null;
    // An estimated max only for external weight: for added weight it would
    // be an estimate of the added kg alone, which means nothing.
    return { kg: top.kg, reps: top.reps, e1rm: mode === "load" && ex.load === "ext" ? e1rm(top.kg, top.reps) : 0, ts: top.ts, id: top.id };
  }

  /* ---------- The gym: the next session ---------- */

  // What a past session was, for the double progression, or null when it
  // has no working set:
  //   W      its top weight: the heaviest working set (the least help on
  //          an assisted machine; 0 for bodyweight only)
  //   at     the reps of its working sets at W, in order
  //   n      how many working sets it had (at W or not)
  // The weekly bars count every set that isn't marked a warm-up, but the
  // next session is planned from the sets NEAR THE TOP only: where the
  // weights tell (an external weight, not timed), a counted set whose e1RM
  // is under WARMUP_SHARE of the best counted one is a build-up set and is
  // left out here. Otherwise a pyramid (20, 30, 40 kg) would come back as
  // "3 sets at 40 kg". For an entry without marks this changes nothing: the
  // old rule already left those sets out.
  // Which sets of a session the next one is planned from, [true|false] per
  // set: the counted sets, minus the build-up ones (see above).
  function topBand(e, ex) {
    var band = workingSets(e);
    if (!filtersWarmups(ex)) return band;
    var scores = e.sets.map(function (x, i) { return band[i] ? score(kgAt(e, i, ex), num(x)) : 0; });
    var best = Math.max.apply(null, [0].concat(scores));
    if (!(best > 0)) return band;
    // s ≥ 0.8 × best, exactly (the same test workingSets uses).
    return band.map(function (b, i) { return b && scores[i] * 5 >= best * 4; });
  }

  function sessionTop(e, ex) {
    var band = topBand(e, ex), reps = [], kg = [];
    e.sets.forEach(function (x, i) { if (band[i]) { reps.push(num(x)); kg.push(kgAt(e, i, ex)); } });
    if (!reps.length) return null;
    var W = ex.load === "assist" && ex.known ? Math.min.apply(null, kg) : Math.max.apply(null, kg);
    return {
      id: e.id, ts: timeOf(e), W: W, n: reps.length,
      at: reps.filter(function (r, i) { return kg[i] === W; })
    };
  }

  // The sessions of one calendar day are one session (two entries of the same
  // exercise on a day, e.g. after changing the day of one): their sets in
  // time order, under the latest entry's id and time. Input and output are
  // newest first.
  // Warm-up marks go along. A day whose entries all lack marks stays
  // unmarked, so the old rule runs over the whole day as it always did; as
  // soon as one entry has marks, each entry's own warm-ups (its marks, or
  // the old rule over its own sets) become the day's marks.
  var SESSIONS_LOOKED_AT = 12;
  function mergeDays(list) {
    var out = [];
    var marks = function (e) { return warmups(e).map(function (w) { return w ? 1 : 0; }); };
    list.forEach(function (e) {
      var k = MODEL.dateStr(timeOf(e)), cur = out.length ? out[out.length - 1] : null;
      if (cur && cur.day === k) {
        if (cur.warm || hasMarks(e)) cur.warm = marks(e).concat(cur.warm || marks(cur));
        cur.sets = e.sets.concat(cur.sets);
        cur.kg = (Array.isArray(e.kg) ? e.kg : []).concat(cur.kg);
      } else {
        out.push({ day: k, id: e.id, ts: e.ts, kind: "gym", exId: e.exId, sets: e.sets.slice(), kg: Array.isArray(e.kg) ? e.kg.slice() : [],
          warm: hasMarks(e) ? marks(e) : null });
      }
    });
    return out;
  }

  function fill(x, n) { var out = []; for (var i = 0; i < n; i++) out.push(x); return out; }
  function sum(list) { return list.reduce(function (s, x) { return s + x; }, 0); }

  // n targets from the reps at W, each min(hi, r + step) — one more rep, or
  // for a timed hold TIMED_STEP more seconds (one second is no goal); sets
  // past the last one at W repeat its target.
  var TIMED_STEP = 5;
  function oneMore(at, n, hi, step) {
    var out = [];
    for (var i = 0; i < n; i++) out.push(Math.min(hi, at[Math.min(i, at.length - 1)] + (step || 1)));
    return out;
  }

  // The double-progression suggestion for the next session of an exercise,
  // from its sessions on days before now's (today's entries and
  // opts.exclude, the entry being edited, left out; sessions without a
  // working set skipped). Plain data:
  //   { kind, kg, sets, targets: [reps per set], from }
  //   from     { id, ts, kg: W, reps: [the working reps at W] } of the
  //            last session, or null when there is none
  //   sets     the last session's working sets, 1–10 (3 when none)
  //   targets  one per set (seconds when timed)
  // W is the last session's top weight (sessionTop). kind, checked in
  // this order:
  //   "first"   no earlier session, or ext with W = 0: kg null, 3 sets of
  //             hi ("pick a weight you could lift about hi + 2 times")
  //   "return"  more than 42 calendar days since the last session: 90 %
  //             of W rounded down to inc (never 0: then W); assisted: W +
  //             10 % rounded up to inc; reps mode: W. Targets lo.
  //   Reps mode (bw, timed, unknown load, and added or assist at W = 0):
  //   "harder"  every working set at W reached hi: kg W, targets hi (the
  //             app says: add weight for added, else a harder variation)
  //   "reps"    otherwise: kg W, targets min(hi, r + 1)
  //   Weight mode (ext; added and assist with W > 0):
  //   "up"      every working set at W reached hi: kg W + inc (assisted:
  //             W − inc, not below 0); targets lo, or lo − 2 (at least 1)
  //             when the change is more than 10 % of W (never for added
  //             weight: the body is most of the load)
  //   "deload"  the last two sessions both at W, both with a working set
  //             at W under lo, and the latest with no more reps at W in
  //             total than the one before: kg as for "return", targets lo
  //   "same"    otherwise: kg W, targets min(hi, r + 1)
  // lo, hi and inc are the exercise's own (tweaks included). null for an
  // exercise nobody knows, or a now that isn't a time.
  function suggest(exId, log, now, opts) {
    var ex = exRec(exId);
    if (!ex || !validTime(now)) return null;
    var o = (opts && typeof opts === "object") ? opts : {};
    var lo = ex.lo, hi = ex.hi, inc = ex.inc;
    var list = mergeDays(sessionsFor(log, exId, { before: Number(now), exclude: o.exclude }));
    var tops = [];
    for (var i = 0; i < list.length && tops.length < SESSIONS_LOOKED_AT; i++) {
      var t = sessionTop(list[i], ex);
      if (t) tops.push(t);
    }
    var last = tops[0];
    var make = function (kind, kg, n, targets) {
      return { kind: kind, kg: kg, sets: n, targets: targets, from: last ? { id: last.id, ts: last.ts, kg: last.W, reps: last.at.slice() } : null };
    };
    var mode = weightMode(ex);
    if (!last || (mode === "load" && ex.load === "ext" && !(last.W > 0))) return make("first", null, DEFAULT_SETS, fill(hi, DEFAULT_SETS));
    var W = last.W;
    if (!(W > 0)) mode = "reps";   // added or assisted with no weight on: bodyweight
    var n = Math.max(1, Math.min(MAX_SETS, last.n));
    var lighter = function () {
      if (mode === "reps") return W;
      if (mode === "assist") return roundTo(W * (2 - BACKOFF), inc, "up");
      var k = roundTo(W * BACKOFF, inc, "down");
      return k > 0 ? k : W;
    };
    if (dayDelta(last.ts, Number(now)) > RETURN_DAYS) return make("return", lighter(), n, fill(lo, n));
    var topped = last.at.every(function (r) { return r >= hi; });
    if (mode === "reps") return make(topped ? "harder" : "reps", W, n, oneMore(last.at, n, hi, ex.timed ? TIMED_STEP : 1));
    if (topped) {
      var kg = mode === "assist" ? Math.max(0, W - inc) : W + inc;
      // A change of exactly 10 % divides to exactly 0.1 (the double nearest
      // a tenth, as the constant is), so it isn't "more than".
      var big = ex.load !== "added" && Math.abs(kg - W) / W > BIG_JUMP;
      return make("up", kg, n, fill(big ? Math.max(1, lo - BIG_JUMP_REPS) : lo, n));
    }
    var prev = tops[1];
    // The floor is lo, or lo − 2 while you're still settling in after a big
    // step up to W (the targets "up" gave then): falling short of lo there
    // is expected, not a reason to go back down.
    var floor = lo;
    for (var j = 1; j < tops.length; j++) {
      if (tops[j].W === W) continue;
      var from = tops[j].W;
      var harder = mode === "assist" ? W < from : W > from;
      if (harder && from > 0 && ex.load !== "added" && Math.abs(W - from) / from > BIG_JUMP) floor = Math.max(1, lo - BIG_JUMP_REPS);
      break;
    }
    var short = function (s) { return s.at.some(function (r) { return r < floor; }); };
    if (prev && prev.W === W && short(last) && short(prev) && sum(last.at) <= sum(prev.at)) {
      return make("deload", lighter(), n, fill(lo, n));
    }
    return make("same", W, n, oneMore(last.at, n, hi));
  }

  // The rows a new session's sheet opens with: a copy of the session the
  // suggestion builds on, one row per set it had, in order —
  //   [{ kg, warm, reps }]
  //   kg    that set's weight; the sets at the old top weight get the
  //         suggested one (heavier after "up", lighter after a long break
  //         or a deload), and no other set is left heavier than that
  //   warm  it was a warm-up (its mark, or the old rule's guess)
  //   reps  the number to aim for: the suggestion's targets, in order, for
  //         the sets the plan is made from (topBand); for warm-ups and
  //         build-up sets, what was done last time
  // So a pyramid comes back as a pyramid, warm-ups included, and only its
  // top moves. Sets of 0 reps are left out. null when there is nothing to
  // copy (first time, an exercise nobody knows, a time that isn't one):
  // the sheet then opens with the suggestion's plain sets.
  function planRows(exId, log, now, opts) {
    var ex = exRec(exId), sg = suggest(exId, log, now, opts);
    if (!ex || !sg || !sg.from) return null;
    var o = (opts && typeof opts === "object") ? opts : {};
    var day = null;
    mergeDays(sessionsFor(log, exId, { before: Number(now), exclude: o.exclude })).forEach(function (s) {
      if (!day && s.id === sg.from.id) day = s;
    });
    if (!day) return null;
    var band = topBand(day, ex), marks = warmups(day), targets = sg.targets || [];
    var lighter = ex.load === "assist" && ex.known;      // less help is the harder way there
    var k = 0, rows = [];
    day.sets.forEach(function (x, i) {
      var r = num(x);
      if (!(r > 0)) return;
      var kg = kgAt(day, i, ex);
      if (band[i]) {
        if (kg === sg.from.kg) kg = sg.kg;
        rows.push({ kg: kg, warm: false, reps: targets.length ? targets[Math.min(k, targets.length - 1)] : r });
        k++;
      } else {
        rows.push({ kg: kg, warm: !!marks[i], reps: r });
      }
    });
    rows.forEach(function (row) {
      if (lighter ? row.kg < sg.kg : row.kg > sg.kg) row.kg = sg.kg;
    });
    return rows.length ? rows.slice(0, MODEL.CAPS ? MODEL.CAPS.setsPerEntry : 30) : null;
  }

  /* ---------- Progress: records, trends, main lifts ---------- */

  // How far back "records in the last 30 days" and a group's lifts (8 weeks)
  // look — calendar days, today included — and how many sessions a chart shows.
  var RECORD_DAYS = 30;
  var LIFT_DAYS = 56;
  var TREND_SESSIONS = 20;
  // An estimated 1-rep max says little above this many reps: an exercise
  // whose range goes higher is charted by its top weight instead.
  var E1RM_MAX_HI = 15;

  // Ids and names from stored data: anything that isn't a string counts as "".
  function cmpStr(a, b) {
    a = typeof a === "string" ? a : ""; b = typeof b === "string" ? b : "";
    return a < b ? -1 : (a > b ? 1 : 0);
  }

  // The catalogue's own order (data.js lists each group's big movement
  // first), for ties between lifts. Your own exercises come after.
  var CAT_ORDER = dict();
  CATALOGUE.forEach(function (x, i) { if (x && typeof x.id === "string") CAT_ORDER[x.id] = i; });

  /* A RECORD, in one sentence: a heavier weight than ever before, in a set
     no more than two reps short of the fewest the exercise aims for; with
     no weight on, more reps in one set than ever (a hold: the next 5
     seconds).

     Exactly, per exercise, day by day (a day = every entry of the exercise
     on one calendar day; counted sets only — each entry's own
     workingSets(), so a set History shows as a warm-up is never a record):

     Two marks are kept. The first day that has something to measure sets
     each one silently: it is what there is to beat, never a record.

       the WEIGHT mark (not for bodyweight-only or timed exercises)
         A set is in when it has weight on and at least recordFloor(ex)
         reps: lo − 2, the fewest suggest() ever asks for (after a big step up),
         so doing what the sheet says on the day the weight goes up always
         counts — and a heavy single in an 8–12 exercise never does. One
         floor for every set, whatever came before, so the same set can't
         count on one day and not on another. With added weight, bodyweight
         alone for that many reps is in as weight 0; on an assisted machine
         no help at all is in whatever the reps (the hardest there is). An
         external weight logged as 0 kg is out: there is nothing to compare.
         The day's hardest such set (heavier; assisted: less help) is a
         record when it is harder than the mark. More reps at the same
         weight is not: that would be a record nearly every session.

       the REPS mark (bodyweight-only and timed exercises; added weight and
       assisted sets done with no weight on)
         The day's most reps in such a set is a record when it beats the most
         reps of every earlier day's sets that were at least as hard. With
         added weight that includes the weighted ones: 10 reps with 5 kg on
         blocks a later 10 without — and it makes a first set without weight
         a record when it beats them, although no earlier set had none on.
         (So what such a set has to beat can be more than the mark `r`,
         which is the best set WITHOUT weight.) A hold has to reach the
         next TIMED_STEP seconds: 44 after 40 is not one, 45 is.

     A day has one record at most: the weight one when both happen. Sets
     under the floor are neither records nor in anyone's way. Everything
     is derived from the log every time — nothing is stored — so a session
     logged late for an earlier day, a W mark, or a changed rep range can
     move records, and every device works out the same ones. */

  // Everything the records, the charts and the lifts read, from ONE pass
  // over the log. app.js builds it once per refresh and hands it to the
  // functions below (each also takes a plain log and builds its own).
  //   { byEx, records, byEntry }
  //   byEx     { exId: { days, w, r, records } } for every exercise that
  //            resolves and has a counted set
  //     days     its session days, oldest first — a calendar day with at
  //              least one counted set:
  //              { day "YYYY-MM-DD", ts (its latest entry's), n (counted
  //                sets), top, e1, rec, w, r, at, load }
  //                top  the day's top set { kg, reps, id, i }: the hardest
  //                     weight, then the most reps (reps only where weight
  //                     doesn't count)
  //                e1   the day's best estimated 1-rep max
  //                     { kg, reps, value }, external weight only; else null
  //                rec  the day's record, or null
  //                w, r the two marks as they stood after that day
  //                at   the reps done at the top weight, most first
  //                load kg × reps over the sets with weight on
  //     w, r     the marks now: { kg, reps, ts, id, i } or null. w is the
  //              hardest weight (with the most reps done at it), r the most
  //              reps with no weight on.
  //     records  its records, oldest first
  //   records  every record, oldest first (same time: by exercise id):
  //            { exId, day, ts, id, i, kg, reps, by }
  //              id, i  the entry that holds the set, and the set's place in it
  //              by     "kg" (a weight record) or "reps"
  //   byEntry  { entry id: its record }, for marking a row in History
  // Entries of exercises nobody knows, with no usable time or no counted
  // set are left out. The same log in any order gives the same answer.
  // The indexes gymIndex() itself made: nothing else is taken for one.
  var MADE = new WeakSet();
  function gymIndex(log) {
    var byEx = dict(), byEntry = dict(), all = [];
    var out = { byEx: byEx, records: all, byEntry: byEntry };
    MADE.add(out);
    if (!Array.isArray(log)) return out;
    var buckets = dict();
    log.forEach(function (e) {
      if (!e || typeof e !== "object" || e.kind !== "gym" || !Array.isArray(e.sets)) return;
      var t = timeOf(e);
      if (!(t > 0) || !exRec(e.exId)) return;
      var b = buckets[e.exId] || (buckets[e.exId] = { list: [], sorted: true });
      var prev = b.list.length ? b.list[b.list.length - 1] : null;
      // A stored log is in order already (sortLog: time, then id).
      if (prev && (t < prev.t || (t === prev.t && cmpStr(e.id, prev.e.id) < 0))) b.sorted = false;
      b.list.push({ e: e, t: t });
    });
    Object.keys(buckets).forEach(function (exId) {
      var b = buckets[exId];
      if (!b.sorted) b.list.sort(function (x, y) { return (x.t - y.t) || cmpStr(x.e.id, y.e.id); });
      var rec = walkExercise(exRec(exId), b.list);
      if (!rec.days.length) return;
      byEx[exId] = rec;
      rec.records.forEach(function (r) { all.push(r); byEntry[r.id] = r; });
    });
    all.sort(function (a, b) { return (a.ts - b.ts) || cmpStr(a.exId, b.exId); });
    return out;
  }

  // The fewest reps a weighted set needs to count for a record: two under
  // the bottom of the exercise's range, 1 at least. 0 where weight doesn't
  // count (bodyweight only, timed) and for an exercise nobody knows.
  function recordFloor(ex) {
    if (!ex || weightMode(ex) === "reps") return 0;
    return Math.max(1, ex.lo - BIG_JUMP_REPS);
  }

  // One exercise's entries (in time order) as days, marks and records.
  function walkExercise(ex, list) {
    var mode = weightMode(ex), added = mode === "load" && ex.load === "added";
    var days = [], records = [];
    var w = null, r = null, bar = null, cur = null;
    var floor = recordFloor(ex);
    var harder = function (a, b) { return mode === "assist" ? a < b : a > b; };
    var mark = function (s) { return { kg: s.kg, reps: s.reps, ts: s.ts, id: s.id, i: s.i }; };
    var inWeight = function (s) {
      if (s.kg > 0) return s.reps >= floor;
      return added ? s.reps >= floor : mode === "assist";
    };
    var close = function () {
      var sets = cur.sets;
      if (!sets.length) return;                      // warm-ups only: not a session
      var top = null, e1 = null, bestW = null, bestR = null, most = 0, rec = null;
      sets.forEach(function (s) {
        if (!top || (mode === "reps" ? s.reps > top.reps : (harder(s.kg, top.kg) || (s.kg === top.kg && s.reps > top.reps)))) top = s;
        if (mode === "reps") {
          if (!bestR || s.reps > bestR.reps) bestR = s;
          if (s.reps > most) most = s.reps;
          return;
        }
        if (ex.load === "ext") {
          var sc = score(s.kg, s.reps);
          if (sc > 0 && (!e1 || sc > e1.sc)) e1 = { kg: s.kg, reps: s.reps, sc: sc };
        }
        if (inWeight(s) && (!bestW || harder(s.kg, bestW.kg) || (s.kg === bestW.kg && s.reps > bestW.reps))) bestW = s;
        if (ex.load !== "ext" && !(s.kg > 0) && (!bestR || s.reps > bestR.reps)) bestR = s;
        // What a later set without weight has to beat: with added weight
        // every set, on an assisted machine only the unassisted ones.
        if ((added || (mode === "assist" && !(s.kg > 0))) && s.reps > most) most = s.reps;
      });
      if (bestW) {
        if (w && harder(bestW.kg, w.kg)) rec = { set: bestW, by: bestW.kg > 0 ? "kg" : "reps" };
        if (!w || harder(bestW.kg, w.kg) || (bestW.kg === w.kg && bestW.reps > w.reps)) w = mark(bestW);
      }
      if (bestR) {
        var beats = bar !== null && (ex.timed ? Math.floor(bestR.reps / TIMED_STEP) > Math.floor(bar / TIMED_STEP) : bestR.reps > bar);
        if (beats && !rec) rec = { set: bestR, by: "reps" };
        if (!r || bestR.reps > r.reps) r = mark(bestR);
      }
      if (most > 0 && (bar === null || most > bar)) bar = most;
      var out = null;
      if (rec) {
        out = { exId: ex.id, day: cur.day, ts: rec.set.ts, id: rec.set.id, i: rec.set.i, kg: rec.set.kg, reps: rec.set.reps, by: rec.by };
        records.push(out);
      }
      // What one session is compared with the next by (see progress()): the
      // reps done at the day's top weight, most first — every counted set
      // where weight doesn't count. And the kg lifted that day: kg × reps
      // over the counted sets with weight on (doubled for a weight logged
      // per hand); nothing for bodyweight, holds and assisted machines.
      var at = [], load = 0;
      sets.forEach(function (s) {
        if (mode === "reps" || s.kg === top.kg) at.push(s.reps);
        if (mode === "load" && s.kg > 0) load += s.kg * s.reps;
      });
      at.sort(function (a, b) { return b - a; });
      if (ex.perHand) load *= 2;
      days.push({
        day: cur.day, ts: cur.ts, n: sets.length,
        top: { kg: top.kg, reps: top.reps, id: top.id, i: top.i },
        e1: e1 ? { kg: e1.kg, reps: e1.reps, value: e1.sc / 30 } : null,
        rec: out, w: w, r: r, at: at, load: load
      });
    };
    list.forEach(function (x) {
      var e = x.e, key = dateStr(x.t);
      if (!cur || cur.day !== key) {
        if (cur) close();
        cur = { day: key, ts: x.t, sets: [] };
      }
      cur.ts = x.t;
      var flags = workingSets(e);
      for (var i = 0; i < e.sets.length; i++) {
        if (flags[i]) cur.sets.push({ kg: kgAt(e, i, ex), reps: num(e.sets[i]), ts: x.t, id: e.id, i: i });
      }
    });
    if (cur) close();
    return { days: days, w: w, r: r, records: records };
  }

  // A log, or the index gymIndex() already built from it. Anything else —
  // an object that only looks like an index too — counts as an empty log.
  function asIndex(x) {
    return (x && typeof x === "object" && MADE.has(x)) ? x : gymIndex(x);
  }
  function exIndex(x, exId) {
    var idx = asIndex(x);
    return typeof exId === "string" && Object.prototype.hasOwnProperty.call(idx.byEx, exId) ? idx.byEx[exId] : null;
  }

  // Every record in a log (or an index), oldest first. See gymIndex().
  function records(x) { return asIndex(x).records; }

  // The records of the last `days` calendar days, today included (History's
  // "records in the last 30 days"), oldest first. Days after today don't
  // count. days: RECORD_DAYS unless given.
  function recordsIn(x, now, days) {
    if (!validTime(now)) return [];
    var n = (days === null || days === undefined) ? RECORD_DAYS : Math.round(Number(days));
    if (!(n >= 1)) return [];
    return records(x).filter(function (r) {
      var ago = dayDelta(r.ts, Number(now));
      return ago >= 0 && ago < n;
    });
  }

  // What there is to beat in an exercise: { w, r, show }
  //   w, r   the weight mark and the reps mark (see gymIndex), or null
  //   show   the one to put on screen: the weight mark when it has weight
  //          on, else the reps mark, else the weight mark; null when none
  // before (a time): as things stood before the calendar day containing it,
  // for a sheet that is logging that day. Without it: as they stand now.
  function standing(x, exId, before) {
    var rec = exIndex(x, exId), w = null, r = null;
    if (rec) {
      if (before === undefined || before === null) { w = rec.w; r = rec.r; }
      else if (validTime(before)) {
        var until = dayStart(Number(before));
        for (var k = rec.days.length - 1; k >= 0; k--) {
          if (rec.days[k].ts < until) { w = rec.days[k].w; r = rec.days[k].r; break; }
        }
      }
    }
    return { w: w, r: r, show: (w && w.kg > 0) ? w : (r || w) };
  }

  // An exercise's chart: its last `max` session days (TREND_SESSIONS unless
  // given), oldest first —
  //   { kind, points: [{ day, ts, value, kg, reps, record }] }
  //   kind   decided on the days shown:
  //          "secs"    a timed exercise: the longest hold of the day
  //          "reps"    weight doesn't count, or no set of those days had
  //                    weight on: the most reps in one set
  //          "e1rm"    external weight, range up to E1RM_MAX_HI reps: the
  //                    day's best estimated 1-rep max
  //          "kg"      external weight with a higher range, and added
  //                    weight: the day's top weight (0 = bodyweight alone)
  //          "assist"  an assisted machine: the least help of the day
  //   value  what is plotted; kg and reps are the set it comes from
  //   record that day has a record of the chart's kind (a weight record on
  //          the weight charts, a reps record on the other two; any record
  //          on the help chart)
  // Days without a weighted set are left out of "e1rm" (and of "kg" for
  // an external weight). An exercise nobody knows, or never logged:
  // { kind: null, points: [] }.
  function trend(x, exId, max) {
    var rec = exIndex(x, exId), ex = exRec(exId), out = { kind: null, points: [] };
    if (!rec || !ex) return out;
    var n = (max === null || max === undefined) ? TREND_SESSIONS : Math.round(Number(max));
    if (!(n >= 1)) n = TREND_SESSIONS;
    var mode = weightMode(ex), days = rec.days.slice(-n);
    var weighted = mode !== "reps" && days.some(function (d) { return d.top.kg > 0; });
    var kind = ex.timed ? "secs" : (!weighted ? "reps"
      : (mode === "assist" ? "assist" : (ex.load === "ext" && ex.hi <= E1RM_MAX_HI ? "e1rm" : "kg")));
    var byWeight = kind === "e1rm" || kind === "kg" || kind === "assist";
    days.forEach(function (d) {
      // (The first day with no help at all is a record "by reps": on the
      // help chart it is the biggest step there is.)
      var p = { day: d.day, ts: d.ts, value: 0, kg: d.top.kg, reps: d.top.reps, record: !!d.rec && (kind === "assist" || (d.rec.by === "kg") === byWeight) };
      if (kind === "e1rm") {
        if (!d.e1) return;
        p.value = d.e1.value; p.kg = d.e1.kg; p.reps = d.e1.reps;
      } else if (kind === "kg" || kind === "assist") {
        if (ex.load === "ext" && !(d.top.kg > 0)) return;
        p.value = d.top.kg;
      } else {
        p.value = d.top.reps;
      }
      out.points.push(p);
    });
    out.kind = kind;
    return out;
  }

  // The gym exercises each muscle group was trained with in the last
  // LIFT_DAYS calendar days (today included; later days ignored), the main
  // one first:
  //   { group: [{ exId, days, sets, ts, day, kg, reps, id, record }] }
  //   days, sets  its session days and counted sets in those weeks
  //   ts … id     its latest session there: the day's time and top set —
  //               or, when that session set a record, the record's set
  //   record      that session set a record
  // Order: the most session days; then the lower rep range (the heavier
  // movement: squats before calf raises; exercises without weight after
  // those with); then the most sets; then the catalogue's order, your own
  // exercises last by name. Every exercise
  // whose own group it is, deleted and retired ones too; never one nobody
  // knows. All six keys, each a list ([] when there is none).
  function lifts(x, now) {
    var out = {};
    GROUPS.forEach(function (g) { out[g] = []; });
    if (!validTime(now)) return out;
    var idx = asIndex(x), t = Number(now);
    Object.keys(idx.byEx).forEach(function (exId) {
      var ex = exRec(exId);
      if (!ex || !isGroup(ex.p)) return;
      var days = idx.byEx[exId].days, n = 0, sets = 0, last = null;
      for (var k = days.length - 1; k >= 0; k--) {
        var ago = dayDelta(days[k].ts, t);
        if (!(ago >= 0)) continue;
        if (ago >= LIFT_DAYS) break;
        n++; sets += days[k].n;
        if (!last) last = days[k];
      }
      if (!last) return;
      // On a record day the set shown is the record itself: the day's top
      // set can be a heavier one under the floor, which is no record.
      var shown = last.rec || last.top;
      out[ex.p].push({
        exId: exId, days: n, sets: sets, ts: last.ts, day: last.day,
        kg: shown.kg, reps: shown.reps, id: shown.id, record: !!last.rec
      });
    });
    var place = function (id) { return Object.prototype.hasOwnProperty.call(CAT_ORDER, id) ? CAT_ORDER[id] : Infinity; };
    // The bottom of the range, where it says how heavy a movement is: not
    // for bodyweight-only and timed exercises (20 seconds isn't 20 reps),
    // which come after the weighted ones on a tie.
    var heavy = function (ex) { return weightMode(ex) === "reps" ? Infinity : ex.lo; };
    var cmpNum = function (a, b) { return a === b ? 0 : (a < b ? -1 : 1); };
    GROUPS.forEach(function (g) {
      out[g].sort(function (a, b) {
        var xa = exRec(a.exId), xb = exRec(b.exId), pa = place(a.exId), pb = place(b.exId);
        return (b.days - a.days) || cmpNum(heavy(xa), heavy(xb)) || (b.sets - a.sets) ||
          (pa === pb ? 0 : (pa < pb ? -1 : 1)) ||
          cmpStr(String(xa.name).toLowerCase(), String(xb.name).toLowerCase()) || cmpStr(a.exId, b.exId);
      });
    });
    return out;
  }

  /* ---------- Progress: is it getting harder? ---------- */

  // Hard sets say how MUCH was done; this says whether it got HARDER — the
  // other half of progressive overload. It is judged exercise by exercise,
  // each against itself, because kilos can't be added up across exercises:
  // a leg press moves five times a squat's kilos for the same effort, and a
  // light set of 12 moves more than a heavy set of 6.

  // The strength trend looks back this many weeks unless asked otherwise.
  var STRENGTH_WEEKS = 8;
  // One exercise can move a week of the trend by this factor at most, either
  // way: the first weeks of a new exercise (finding the weight) would
  // otherwise pass for a leap in strength.
  var STRENGTH_SWING = 1.25;

  // One session of an exercise against an earlier one: 1 up, 0 the same,
  // −1 down — as the double progression works towards it (suggest()):
  //   a harder top weight (heavier; less help on an assisted machine) is up
  //   the same top weight: the reps done at it, set against set from the
  //     best down, over as many sets as both sessions have — more is up
  //   bodyweight only and holds: the reps (seconds) the same way
  // A set more or fewer changes nothing by itself: that is dose, and the
  // hard-set bars show it.
  function compareDays(ex, a, b) {
    var mode = weightMode(ex);
    if (mode !== "reps" && a.top.kg !== b.top.kg) {
      return (mode === "assist" ? a.top.kg < b.top.kg : a.top.kg > b.top.kg) ? 1 : -1;
    }
    var k = Math.min(a.at.length, b.at.length), sa = 0, sb = 0;
    for (var i = 0; i < k; i++) { sa += a.at[i]; sb += b.at[i]; }
    return sa > sb ? 1 : (sa < sb ? -1 : 0);
  }

  // This week, muscle group by muscle group: which of its gym exercises got
  // harder. For the week containing now, Monday up to the end of today:
  //   { group: { up, same, down, fresh, kg, kgBefore, list } }
  //   list      one row per exercise of the group (its own group, not the
  //             ones it only helps) trained this week, in the order trained:
  //             { exId, status, ts, day, kg, reps, prev }
  //               status  "up" | "same" | "down" (compareDays): its latest
  //                       session this week against its last session BEFORE
  //                       this week — or "new" when there is none, "back"
  //                       when that was more than RETURN_DAYS days earlier
  //                       (after a break lighter is the plan, not a step back)
  //               kg, reps  the top weight of this week's session and the
  //                       reps done at it, most first
  //               prev    { ts, kg, reps } of the session it is set against
  //   up, same, down      how many rows have each status
  //   fresh     the rows with nothing to compare ("new" and "back")
  //   kg        the kilos lifted this week so far: kg × reps over the counted
  //             sets with weight on of those exercises (a weight logged per
  //             hand counts twice; added weight counts as the kg added;
  //             bodyweight, holds and assisted machines add nothing)
  //   kgBefore  the same for the whole week before
  // Days after today are left out. All six groups, always.
  function progress(x, now) {
    var out = {};
    GROUPS.forEach(function (g) { out[g] = { up: 0, same: 0, down: 0, fresh: 0, kg: 0, kgBefore: 0, list: [] }; });
    if (!validTime(now)) return out;
    var idx = asIndex(x), t = Number(now), from = weekStart(t), to = nextDay(t), before = addWeeks(from, -1);
    Object.keys(idx.byEx).forEach(function (exId) {
      var ex = exRec(exId);
      if (!ex || !isGroup(ex.p)) return;
      var days = idx.byEx[exId].days, g = out[ex.p], cur = null, prev = null;
      for (var k = days.length - 1; k >= 0; k--) {
        var d = days[k];
        if (d.ts >= to) continue;
        if (d.ts >= from) { if (!cur) cur = d; g.kg += d.load; continue; }
        if (!prev) prev = d;
        if (d.ts < before) break;
        g.kgBefore += d.load;
      }
      if (!cur) return;
      var status = "new";
      if (prev) {
        var c = dayDelta(prev.ts, cur.ts) > RETURN_DAYS ? null : compareDays(ex, cur, prev);
        status = c === null ? "back" : (c > 0 ? "up" : (c < 0 ? "down" : "same"));
      }
      g[status === "new" || status === "back" ? "fresh" : status]++;
      g.list.push({
        exId: exId, status: status, ts: cur.ts, day: cur.day, kg: cur.top.kg, reps: cur.at.slice(),
        prev: prev ? { ts: prev.ts, kg: prev.top.kg, reps: prev.at.slice() } : null
      });
    });
    GROUPS.forEach(function (g) {
      out[g].list.sort(function (a, b) { return (a.ts - b.ts) || cmpStr(a.exId, b.exId); });
    });
    return out;
  }

  // A session as one number, to set against another session of the SAME
  // exercise: the best estimated 1-rep max for an external weight, the most
  // reps (seconds) where weight doesn't count, and for added weight or an
  // assisted machine the reps at the top weight — comparable only with a
  // session at that same weight (`k` says what the number is).
  function dayValue(ex, d) {
    if (weightMode(ex) === "reps") return { k: "r", v: d.top.reps };
    if (d.e1) return { k: "e", v: d.e1.value };
    return { k: "w" + d.top.kg, v: d.top.reps };
  }

  // A muscle group's strength over the last `weeks` weeks (STRENGTH_WEEKS
  // unless given; this week last, up to the end of today):
  //   [{ start, n, change, index }]   one per week, oldest first
  //   n       the group's exercises that week with something to compare:
  //           a session that week, and one before that week no more than
  //           RETURN_DAYS days earlier, measured the same way (dayValue)
  //   change  the average of their changes against that earlier session
  //           (0.02 = 2 % up), each exercise against itself and held within
  //           STRENGTH_SWING; null when n is 0
  //   index   100 before the first week, moved by every week's change: 104
  //           is 4 % up over the weeks shown. A week with nothing to
  //           compare leaves it where it was.
  // An average of percentages, not of kilos: that is what lets a squat, a
  // leg press and a set of push-ups share one line. [] for a group that
  // isn't one or a time that isn't one.
  function strength(x, group, now, weeks) {
    var out = [];
    if (!isGroup(group) || !validTime(now)) return out;
    var n = (weeks === null || weeks === undefined) ? STRENGTH_WEEKS : Math.round(Number(weeks));
    if (!(n >= 1)) n = STRENGTH_WEEKS;
    n = Math.min(MAX_HISTORY_WEEKS, n);
    var idx = asIndex(x), t = Number(now), cur = weekStart(t), end = nextDay(t), level = 100;
    var ids = Object.keys(idx.byEx).filter(function (id) { var ex = exRec(id); return !!ex && ex.p === group; });
    for (var i = n - 1; i >= 0; i--) {
      var from = addWeeks(cur, -i), to = Math.min(addWeeks(from, 1), end), sum = 0, k = 0;
      ids.forEach(function (id) {
        var ex = exRec(id), days = idx.byEx[id].days, a = null, b = null;
        for (var j = days.length - 1; j >= 0 && !b; j--) {
          if (days[j].ts >= to) continue;
          if (days[j].ts >= from) { if (!a) a = days[j]; } else b = days[j];
        }
        if (!a || !b || dayDelta(b.ts, a.ts) > RETURN_DAYS) return;
        var va = dayValue(ex, a), vb = dayValue(ex, b);
        if (va.k !== vb.k || !(va.v > 0) || !(vb.v > 0)) return;
        sum += Math.max(1 / STRENGTH_SWING, Math.min(STRENGTH_SWING, va.v / vb.v));
        k++;
      });
      var change = k ? sum / k - 1 : null;
      if (k) level *= 1 + change;
      out.push({ start: from, n: k, change: change, index: level });
    }
    return out;
  }

  /* ---------- Body weight ---------- */

  // What a weigh-in can hold (model.js, sanitizeBody).
  var WEIGH_MIN = 20, WEIGH_MAX = 300, WAIST_MIN = 30, WAIST_MAX = 250;
  // The chart shows from your first weigh-in to today: at least 4 weeks
  // wide, at most 12.
  var WEIGH_CHART_MIN = 28, WEIGH_CHART_MAX = 84;
  // "About a month": the weigh-in nearest 28 days before the latest one,
  // if there is one 21 to 35 days before it.
  var MONTH_DAYS = 28, MONTH_SLACK = 7;
  // "Since your first weigh-in" needs this many days between the two.
  var FIRST_DAYS = 14;
  // A 7-day average is only called one from this many weigh-in days.
  var AVG_DAYS = 3;
  // Waist: compared with the oldest measure of the 12 weeks before the
  // latest, if that is at least 2 weeks older.
  var WAIST_LOOKBACK = 84, WAIST_MIN_GAP = 14;

  // Nearest whole number, halves away from zero (so −0.35 and 0.35 round
  // alike: Math.round alone would give −0.3 and 0.4).
  function roundAway(x) { return x < 0 ? -Math.round(-x) : Math.round(x); }

  // The weigh-ins up to the end of today as ONE value per calendar day,
  // oldest first: the day's weigh-in that is last by time, then by id (two
  // devices can each save one for the same day; nothing is ever merged
  // away). [{ ts, id, kg, waist, tenths }]
  function weighDays(log, now) {
    var end = nextDay(now), by = dict(), out = [];
    if (!Array.isArray(log)) return out;
    log.forEach(function (e) {
      if (!e || typeof e !== "object" || e.kind !== "body") return;
      var t = timeOf(e), kg = num(e.kg);
      if (!(t < end) || !(kg >= WEIGH_MIN && kg <= WEIGH_MAX)) return;
      var k = dateStr(t), cur = by[k];
      if (cur && (t < cur.ts || (t === cur.ts && cmpStr(e.id, cur.id) <= 0))) return;
      var waist = num(e.waist);
      by[k] = { ts: t, id: e.id, kg: kg, waist: (waist >= WAIST_MIN && waist <= WAIST_MAX) ? waist : null, tenths: Math.round(kg * 10) };
    });
    Object.keys(by).forEach(function (k) { out.push(by[k]); });
    return out.sort(function (a, b) { return a.ts - b.ts; });
  }

  // Body weight, for the Body card, its sheet and the weigh-in form.
  // Every number hangs on the LATEST weigh-in, not on today, so nothing
  // changes on a day you didn't weigh yourself; `now` only says how long
  // ago that was, where the chart ends, and which weigh-ins haven't
  // happened yet (days after today are ignored).
  //   count      days with a weigh-in
  //   last       the latest { ts, id, kg, waist }; prev the day before it
  //              that has one; first the earliest. null when there is none.
  //   daysSince  whole calendar days from the latest to now
  //   change     last.kg − prev.kg (to 0.1), or null
  //   month      { change, ts, avg }: the level at the latest weigh-in
  //              against the level at the weigh-in nearest 28 days before
  //              it (21 to 35; a tie goes to the earlier), ts that
  //              weigh-in's. A "level" is the average of the weigh-ins of
  //              the 7 calendar days ending that day when there are 3 or
  //              more, else that day's own weigh-in — so for a weigh-in a
  //              week it is simply one reading against the other. avg: an
  //              average is on either side. null without such a day.
  //   sinceFirst { change, ts }: last against the first weigh-in, only
  //              while there is no month, the first is 14 days or more
  //              before the latest and isn't `prev`
  //   avg7       { kg, n }: the level at the latest weigh-in, only when its
  //              7 days hold 3 weigh-in days or more
  //   waist      { last, ref, change }: the latest waist { cm, ts }; ref the
  //              oldest one of the 12 weeks before it that is 2 weeks or
  //              more older; change last − ref to the nearest 0.5 cm
  //   chart      { days, from, points: [{ ts, kg, avg, n }], split }: the
  //              window (from your first weigh-in to today, 28 to 84 days
  //              ending today; `from` its first midnight) and the weigh-in
  //              days in it with each one's level (avg, over n days: it
  //              looks back before the window too). split: some level is a
  //              real average, so the line isn't just the dots.
  // Weights are added up in whole tenths, so 72.3 and 72.4 average 72.4
  // (72.35 rounded half up) and a difference is exact.
  function bodyWeight(log, now) {
    var out = {
      count: 0, last: null, prev: null, first: null, daysSince: null, change: null, month: null, sinceFirst: null, avg7: null,
      waist: { last: null, ref: null, change: null },
      chart: { days: WEIGH_CHART_MIN, from: NaN, points: [], split: false }
    };
    if (!validTime(now)) return out;
    var t = Number(now), days = weighDays(log, t), n = days.length;
    var pub = function (d) { return { ts: d.ts, id: d.id, kg: d.kg, waist: d.waist }; };
    // The level at day i, in tenths (not rounded), and how many days it
    // averages: the weigh-ins of the 7 calendar days ending that day when
    // there are AVG_DAYS of them or more — else that day's own weigh-in (n 1):
    // two readings are not an average, and a number worked out from them
    // couldn't be checked against anything on screen.
    var level = function (i) {
      var sum = 0, k = 0;
      for (var j = i; j >= 0 && dayDelta(days[j].ts, days[i].ts) <= 6; j--) { sum += days[j].tenths; k++; }
      return k >= AVG_DAYS ? { tenths: sum / k, n: k } : { tenths: days[i].tenths, n: 1 };
    };
    out.count = n;
    if (n) {
      var L = days[n - 1], lv = level(n - 1);
      out.last = pub(L);
      out.first = pub(days[0]);
      out.daysSince = Math.max(0, dayDelta(L.ts, t));
      if (n > 1) {
        out.prev = pub(days[n - 2]);
        out.change = (L.tenths - days[n - 2].tenths) / 10;
      }
      var pick = -1, off = Infinity;
      for (var i = n - 2; i >= 0; i--) {
        var ago = dayDelta(days[i].ts, L.ts);
        if (ago > MONTH_DAYS + MONTH_SLACK) break;
        if (ago < MONTH_DAYS - MONTH_SLACK) continue;
        if (Math.abs(ago - MONTH_DAYS) <= off) { off = Math.abs(ago - MONTH_DAYS); pick = i; }   // <=: a tie goes to the earlier
      }
      if (pick !== -1) {
        var then = level(pick);
        out.month = { change: roundAway(lv.tenths - then.tenths) / 10, ts: days[pick].ts, avg: lv.n > 1 || then.n > 1 };
      }
      else if (n > 2 && dayDelta(days[0].ts, L.ts) >= FIRST_DAYS) out.sinceFirst = { change: (L.tenths - days[0].tenths) / 10, ts: days[0].ts };
      if (lv.n > 1) out.avg7 = { kg: Math.round(lv.tenths) / 10, n: lv.n };

      var wi = -1;
      for (var a = n - 1; a >= 0 && wi === -1; a--) if (days[a].waist !== null) wi = a;
      if (wi !== -1) {
        out.waist.last = { cm: days[wi].waist, ts: days[wi].ts };
        for (var b = 0; b < wi; b++) {
          var gap = dayDelta(days[b].ts, days[wi].ts);
          if (days[b].waist === null || gap > WAIST_LOOKBACK) continue;
          if (gap < WAIST_MIN_GAP) break;
          out.waist.ref = { cm: days[b].waist, ts: days[b].ts };
          out.waist.change = roundAway((days[wi].waist - days[b].waist) * 2) / 2 + 0;
          break;
        }
      }
    }
    var span = n ? dayDelta(days[0].ts, t) + 1 : WEIGH_CHART_MIN;
    span = Math.max(WEIGH_CHART_MIN, Math.min(WEIGH_CHART_MAX, span));
    var from = addDays(startOfDay(t), -(span - 1)).getTime();
    out.chart.days = span;
    out.chart.from = from;
    days.forEach(function (d, i2) {
      if (d.ts < from) return;
      var l = level(i2);
      out.chart.points.push({ ts: d.ts, kg: d.kg, avg: Math.round(l.tenths) / 10, n: l.n });
      if (l.n > 1) out.chart.split = true;
    });
    return out;
  }

  /* ---------- Charts ---------- */

  // A y-axis for a line chart whose values run from min to max:
  //   { lo, hi, step, ticks }   2 to 4 whole-number ticks, lo ≥ 0, hi > lo
  // The axis does NOT start at zero (72 kg would be a flat line at the top)
  // and is never shorter than minSpan, so a 0.3 kg wobble isn't drawn as a
  // cliff: a narrower range is widened around its middle. Anything that
  // isn't a number gives a plain 0–2 axis rather than NaN.
  var CHART_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  function chartScale(min, max, minSpan) {
    var a = Number(min), b = Number(max), span = Number(minSpan);
    if (!isFinite(span) || !(span > 0)) span = 2;
    if (min === null || max === null || !isFinite(a) || !isFinite(b)) { a = 0; b = 0; }
    if (a > b) { var t = a; a = b; b = t; }
    if (b - a < span) {
      // Around the nearest whole number, so 72.1–72.6 with 4 to show reads
      // 70–74 rather than 70–76; never cutting the data off.
      var mid = Math.round((a + b) / 2);
      a = Math.min(a, mid - span / 2); b = Math.max(b, mid + span / 2);
    }
    if (a < 0) { b -= a; a = 0; }
    for (var i = 0; i < CHART_STEPS.length; i++) {
      var step = CHART_STEPS[i];
      // The 1e-9s keep 72.00000000000001 from costing a whole extra step.
      var lo = Math.floor(a / step + 1e-9) * step, hi = Math.ceil(b / step - 1e-9) * step;
      var n = Math.round((hi - lo) / step);
      if (n >= 1 && n <= 3) {
        var ticks = [];
        for (var k = 0; k <= n; k++) ticks.push(lo + k * step);
        return { lo: lo, hi: hi, step: step, ticks: ticks };
      }
    }
    var top = Math.ceil(b / 5000) * 5000;
    return { lo: 0, hi: top, step: top, ticks: [0, top] };
  }

  useExercises([]);

  /* ---------- Display ---------- */

  var QUARTERS = ["", "\u00bc", "\u00bd", "\u00be"];

  // 9.75 → "9¾", 0.5 → "½", 12 → "12". Rounds to the nearest ¼ first.
  function fmtSets(n) {
    var q = Math.round(Math.max(0, Number(n) || 0) * 4);
    var whole = Math.floor(q / 4), frac = q % 4;
    if (!whole && frac) return QUARTERS[frac];
    return String(whole) + QUARTERS[frac];
  }

  return {
    BUILD: BUILD,
    ZONES: ZONES,
    ZONE_LABELS: ZONE_LABELS,
    weekStart: weekStart,
    addWeeks: addWeeks,
    weekLabel: weekLabel,
    inWeek: inWeek,
    setWeights: setWeights,
    hardSets: hardSets,
    groupWeights: groupWeights,
    weekVolume: weekVolume,
    weekVolumeUntil: weekVolumeUntil,
    lastWeekToDate: lastWeekToDate,
    targets: targets,
    zone: zone,
    dayOfWeek: dayOfWeek,
    pace: pace,
    paceZone: paceZone,
    weekSummary: weekSummary,
    verdict: verdict,
    weekHistory: weekHistory,
    contribution: contribution,
    breakdown: breakdown,
    feeders: feeders,
    mainFeeders: mainFeeders,
    feedersAt: feedersAt,
    sessionFeeder: sessionFeeder,
    lastTrained: lastTrained,
    daysSince: daysSince,
    dayGroups: dayGroups,
    dayDirect: dayDirect,
    dayDots: dayDots,
    directWeights: directWeights,
    weekStrip: weekStrip,
    workoutDays: workoutDays,
    workoutsInWeek: workoutsInWeek,
    totalWorkouts: totalWorkouts,
    weekStreak: weekStreak,
    monthGrid: monthGrid,
    monthLabel: monthLabel,
    addMonths: addMonths,
    groupNudge: groupNudge,
    radarShare: radarShare,
    fmtSets: fmtSets,
    useExercises: useExercises,
    exercise: exercise,
    exerciseList: exerciseList,
    e1rm: e1rm,
    workingSets: workingSets,
    warmups: warmups,
    roundTo: roundTo,
    sessionsFor: sessionsFor,
    lastSession: lastSession,
    best: best,
    suggest: suggest,
    planRows: planRows,
    gymIndex: gymIndex,
    records: records,
    recordsIn: recordsIn,
    recordFloor: function (exId) { return recordFloor(exRec(exId)); },
    standing: standing,
    trend: trend,
    lifts: lifts,
    progress: progress,
    strength: strength,
    bodyWeight: bodyWeight,
    chartScale: chartScale,
    lastTrainedAll: lastTrainedAll,
    RECORD_DAYS: RECORD_DAYS,
    LIFT_DAYS: LIFT_DAYS,
    TREND_SESSIONS: TREND_SESSIONS,
    E1RM_MAX_HI: E1RM_MAX_HI,
    TIMED_STEP: TIMED_STEP,
    STRENGTH_WEEKS: STRENGTH_WEEKS,
    STRENGTH_SWING: STRENGTH_SWING,
    LOADS: LOADS,
    HELPER_WEIGHT: HELPER_WEIGHT,
    WARMUP_SHARE: WARMUP_SHARE,
    EPLEY_MAX_REPS: EPLEY_MAX_REPS,
    RETURN_DAYS: RETURN_DAYS,
    BACKOFF: BACKOFF,
    BIG_JUMP: BIG_JUMP,
    BIG_JUMP_REPS: BIG_JUMP_REPS,
    DEFAULT_SETS: DEFAULT_SETS,
    MAX_SETS: MAX_SETS,
    DOT_SETS: DOT_SETS,
    STREAK_WORKOUTS: STREAK_WORKOUTS,
    HISTORY_WEEKS: HISTORY_WEEKS,
    UNTRAINED_DAYS: UNTRAINED_DAYS,
    NEWCOMER_WORKOUTS: NEWCOMER_WORKOUTS,
    BEHIND_FROM_DAY: BEHIND_FROM_DAY,
    BEHIND_SHARE: BEHIND_SHARE,
    BUILDING_SHARE: BUILDING_SHARE,
    RADAR_MAX: RADAR_MAX
  };
})();
