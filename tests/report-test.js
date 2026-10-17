/* The week in review (training.js, weekReport): every number the review
   shows for one week, worked out from the log, and the notes on what to
   look at next. Derived, nothing stored: the same log gives the same week
   on every device, in any order, in any time zone.
   tests/run.sh runs this in Europe/Rome and America/New_York.
   Run with: sh tests/run.sh   (or: node tests/report-test.js) */

const h = require("./harness");
const { check, same, section } = h;

const page = h.load(["data.js", "model.js", "training.js"]);
const T = page.get("TRAINING"), M = page.get("MODEL");
const J = JSON.stringify;
function eq(name, got, want) { check(name, same(got, want), "expected " + J(want) + "\n       got      " + J(got)); }

// October 2026, local time. The 5th, 12th and 19th are Mondays.
const O = (d, hh = 18, mi = 0) => new Date(2026, 9, d, hh, mi).getTime();
const VOL = [10, 20];
let n = 0;
function G(ts, exId, sets, kg, extra) {
  n++;
  return Object.assign({ id: "g" + n, ts, kind: "gym", exId, sets, kg: Array.isArray(kg) ? kg : sets.map(() => kg || 0), note: "", mts: ts, warm: null }, extra || {});
}
const W = (ts, kg) => ({ id: "w" + (++n), ts, kind: "body", kg, waist: null, note: "", mts: ts });
const SK = (ts, areaId, sets) => ({ id: "b" + (++n), ts, date: M.dateStr(ts), areaId, step: 5, sets: sets || [10, 10], note: "", mts: ts, variant: "" });
const Q = (ts, groups) => ({ id: "q" + (++n), ts, kind: "quick", groups, note: "", mts: ts });
const R = (log, weekDay, now) => T.weekReport(log, O(weekDay), VOL, now === undefined ? O(19, 9) : now);
const shuffled = list => { const a = list.slice(); let s = 7; for (let i = a.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) % 2147483648; const k = s % (i + 1); [a[i], a[k]] = [a[k], a[i]]; } return a; };
const byG = (r, f) => r.groups.map(x => x.group + ":" + f(x));

section("an empty log, and times that aren't any");
{
  const r = R([], 12);
  eq("a past week with nothing in it", [r.workouts, r.workoutsAvg, r.sets, r.setsAvg, r.records, r.body, r.streak, r.current, r.notes],
    [0, null, 0, null, [], null, 0, false, [{ kind: "empty" }]]);
  eq("its Monday and the next", [r.start, r.end], [new Date(2026, 9, 12).getTime(), new Date(2026, 9, 19).getTime()]);
  eq("any moment of the week is that week", J(R([], 15)) === J(r) && J(T.weekReport([], O(18, 23, 59), VOL, O(19, 9))) === J(r), true);
  eq("the grid, the bars and the clock have their full shape", [r.history.length, r.perWeek.length, r.when.length, r.when[0].length, Object.keys(r.strength)], [T.REVIEW_WEEKS, T.REVIEW_DAYS_WEEKS, 7, 4, ["chest", "back", "shoulders", "arms", "abs", "legs"]]);
  eq("null for a week or a now that isn't a time", [T.weekReport([], NaN, VOL, O(19)), T.weekReport([], O(12), VOL, null), T.weekReport([], "x", VOL, O(19))], [null, null, null]);
}

section("a past week: training days, hard sets, the four weeks before");
{
  const log = [
    G(O(1), "bench_db", [10, 10, 10], 20),                          // week of 28 Sep
    G(O(6), "pulldown", [10, 10, 10], 40), G(O(8), "bench_db", [10, 10, 10], 20),   // week of the 5th
    G(O(12, 7), "bench_db", [10, 10, 9], 20), G(O(12, 8), "pushdown", [12, 12], 25),
    G(O(14), "squat_bb", [5, 5, 5], 40), SK(O(16), "pullup", [8, 8]), Q(O(17), { abs: 4 })];
  const r = R(log, 12);
  eq("training days and hard sets", [r.workouts, r.sets], [4, 18]);
  eq("the average of the weeks before, from the week of the first training day on", [r.workoutsAvg, r.setsAvg], [1.5, 8.3]);
  eq("per group: sets, last week's, and the days with a hard set straight on it (half sets don't make one)", byG(r, x => x.sets + "/" + x.prev + "/" + x.days),
    ["chest:3/3/1", "back:2/3/1", "shoulders:1.5/1.5/0", "arms:4.5/3/1", "abs:4/0/1", "legs:3/0/1"]);
  eq("…with the targets and zones of the bars", byG(r, x => x.lo + "-" + x.hi + " " + x.zone), ["chest:10-20 low", "back:10-20 low", "shoulders:10-20 low", "arms:20-40 low", "abs:10-20 low", "legs:20-40 low"]);
  eq("the grid ends with this week, oldest first, zones by the same targets", [r.history[r.history.length - 1].start, r.history[r.history.length - 1].sets.chest, r.history[r.history.length - 1].zones.chest, r.history[r.history.length - 2].sets.back],
    [r.start, 3, "low", 3]);
  eq("training days a week, this week last", r.perWeek.slice(-3).map(w => w.n), [1, 2, 4]);
  eq("a 3-week streak of 2 or more", r.streak, 2);
  eq("in any order, with or without the index", J(R(shuffled(log), 12)) === J(r) && J(T.weekReport(log, O(12), VOL, O(19, 9), T.gymIndex(log))) === J(r), true);
}

section("when sessions began");
{
  const log = [G(O(12, 7, 10), "bench_db", [10], 20), G(O(12, 8), "pushdown", [12], 25),   // Monday morning (first entry counts)
    G(O(13, 13), "squat_bb", [5], 40),                                                  // Tuesday afternoon
    G(O(14, 19), "pulldown", [10], 40), G(O(15, 23, 30), "curl_db", [10], 10),           // Wednesday evening, Thursday night
    G(O(16, 2), "row_db", [10], 20),                                                    // Friday at 2: night
    G(O(17, 12), "leg_press", [10], 80),                                                // Saturday, logged for that day afterwards: midday exactly
    G(O(18, 12, 0), "leg_ext", [10], 40, { ts: new Date(2026, 9, 18, 12, 0, 0, 5).getTime() })]; // Sunday 12:00:00.005: a real time
  const r = R(log, 12);
  eq("weekday by part of the day: morning, afternoon, evening, night", r.when, [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1], [0, 0, 0, 1], [0, 0, 0, 0], [0, 1, 0, 0]]);
  eq("…over the last 12 weeks only", R([G(O(12, 7), "bench_db", [10], 20), G(new Date(2026, 6, 1, 7).getTime(), "bench_db", [10], 20)], 12).when[0][0] + R([G(O(12, 7), "bench_db", [10], 20), G(new Date(2026, 6, 1, 7).getTime(), "bench_db", [10], 20)], 12).when[2][0], 1);
}

section("records, body weight, main lifts");
{
  const log = [G(O(1), "bench_db", [10, 10], 20), G(O(6), "bench_db", [10, 10], 22), G(O(13), "bench_db", [10, 10], 24), G(O(20, 7), "bench_db", [10], 26),
    W(O(2, 8), 77), W(O(14, 8), 76.4)];
  const r = R(log, 12, O(21, 9));
  eq("the records of the week only", r.records.map(x => [x.exId, x.kg]), [["bench_db", 24]]);
  eq("the weigh-in of the week, and the change from the one before", r.body && [r.body.kg, r.body.change], [76.4, -0.6]);
  eq("no weigh-in that week: the latest before, without a change", (R(log, 5, O(21, 9)).body || {}).change, null);
  eq("the main lifts", r.lifts.map(l => [l.exId, l.group]), [["bench_db", "chest"]]);
  eq("the week's progress is progress() for it", J(r.progress) === J(T.progress(T.gymIndex(log), new Date(2026, 9, 18, 23, 59, 59, 999).getTime())), true);
}

section("notes: what to look at next");
{
  const notes = (log, wd, now) => R(log, wd, now).notes;
  const legsWeek = [G(O(12), "squat_bb", Array(22).fill(5), 40), G(O(13), "bench_db", Array(12).fill(10), 20), G(O(14), "pulldown", Array(12).fill(10), 40),
    G(O(15), "ohp_db", Array(12).fill(10), 12), G(O(16), "curl_db", Array(22).fill(10), 10), Q(O(17), { abs: 12 })];
  eq("every group on target: good", notes(legsWeek, 12), [{ kind: "good" }]);
  eq("under target: the two furthest under, last week too", notes([G(O(6), "bench_db", [10, 10], 20)].concat(legsWeek.filter(e => e.exId !== "bench_db" && e.exId !== "pulldown")), 12).slice(0, 2),
    [{ kind: "low", group: "chest", sets: 0, lo: 10, hi: 20, twice: true }, { kind: "low", group: "back", sets: 0, lo: 10, hi: 20, twice: true }]);
  eq("past the top: the furthest", notes(legsWeek.concat([G(O(18), "pushdown", Array(30).fill(10), 20)]), 12), [{ kind: "high", group: "arms", sets: 70, hi: 40 }]);
  const stalled = [G(O(1), "bench_db", [10, 10], 20), G(O(5), "bench_db", [10, 9], 20), G(O(8), "bench_db", [10, 9], 20), G(O(12), "bench_db", [9, 9], 20)];
  eq("three sessions without anything up: stalled", notes(stalled, 12).filter(x => x.kind === "stall"), [{ kind: "stall", exId: "bench_db", kg: 20, reps: [9, 9] }]);
  eq("one step up among them: not stalled", notes(stalled.concat([G(O(14), "bench_db", [10, 10], 22)]), 12).filter(x => x.kind === "stall"), []);
  eq("not done for three weeks: not a note any more", notes(stalled, 33, O(40, 9)).filter(x => x.kind === "stall"), []);
  eq("an exercise done for a set time can't stall", notes([1, 5, 8, 12].map(d => G(O(d), "leg_flutter", [40, 40], 0)), 12).filter(x => x.kind === "stall"), []);
  eq("a group not trained for more than 10 days", notes([G(O(1), "squat_bb", [5, 5], 40)].concat(legsWeek.filter(e => e.exId !== "squat_bb")), 12).filter(x => x.kind === "gap"), [{ kind: "gap", group: "legs", days: 17 }]);
  eq("no weigh-in for two weeks", notes(legsWeek.concat([W(O(1, 8), 77)]), 12).filter(x => x.kind === "weigh"), [{ kind: "weigh", days: 17 }]);
  eq("never weighed in: no note about it", notes(legsWeek, 12).filter(x => x.kind === "weigh"), []);
  eq("at most four", notes([G(O(1), "squat_bb", [5], 40), W(O(1, 8), 77)].concat(stalled), 12).length <= 4, true);
  const cur = notes([G(O(19, 7), "pulldown", [10], 40)].concat(stalled), 19, O(20, 9));
  eq("a week under way: no under, over or all-good notes yet", [R([G(O(19, 7), "bench_db", [10], 20)], 19, O(20, 9)).current, cur.some(x => /low|high|good/.test(x.kind)), cur.some(x => x.kind === "stall")], [true, false, true]);
}

section("odd logs, and it stays quick");
{
  const junk = [null, 7, "x", {}, { kind: "gym" }, { kind: "gym", ts: O(13), exId: "bench_db", sets: "8" }, { kind: "body", ts: O(13), kg: "x" }, { ts: 1e300, kind: "quick", groups: { chest: 3 } }, { areaId: "pushup", ts: O(13), sets: [5] }];
  const threw = [];
  [[], null, "log", junk].forEach((lg, i) => [O(12), O(19), O(1)].forEach(wk => [O(19, 9), O(13), NaN].forEach(now => [VOL, null, "x", [5, 200]].forEach(v => {
    try { T.weekReport(lg, wk, v, now); } catch (e) { threw.push(i + ": " + e.message); }
  }))));
  check("nothing throws", !threw.length, threw.slice(0, 3).join("\n       "));
  const big = [];
  for (let i = 0; i < 3000; i++) big.push(G(M.addDays(M.startOfDay(O(18)), -Math.floor(i / 6)).getTime() + (8 + i % 6) * 3600000,
    ["squat_bb", "pulldown", "ohp_db", "bench_db", "curl_db", "leg_lift"][Math.floor(i / 6) % 6], [10, 10, 10], 20 + Math.floor(i / 100)));
  const idx = T.gymIndex(big), t0 = Date.now();
  T.weekReport(big, O(12), VOL, O(19, 9), idx);
  check("3,000 entries: the whole week in review in well under a second", Date.now() - t0 < 800, "took " + (Date.now() - t0) + " ms");
}

h.done(__filename);
