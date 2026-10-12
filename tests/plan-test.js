/* The plan (training.js, P6): a weekly split. Only the split's name is
   stored; which day of the rotation today is, and which exercises it holds,
   are worked out from the log — so the same log must give the same plan on
   every device, in any order, in any time zone.
   tests/run.sh runs this in Europe/Rome and America/New_York.
   Run with: sh tests/run.sh   (or: node tests/plan-test.js) */

const h = require("./harness");
const { check, same, section } = h;

const page = h.load(["data.js", "model.js", "training.js"]);
const T = page.get("TRAINING"), M = page.get("MODEL");
const J = JSON.stringify;
function eq(name, got, want) { check(name, same(got, want), "expected " + J(want) + "\n       got      " + J(got)); }

// October 2026, local time, noon unless given. The 12th is a Monday.
const O = (d, hh = 12, mi = 0) => new Date(2026, 9, d, hh, mi).getTime();
const NOW = O(12, 9);
let n = 0;
function G(ts, exId, sets, kg, extra) {
  n++;
  return Object.assign({ id: "g" + n, ts, kind: "gym", exId, sets, kg: Array.isArray(kg) ? kg : sets.map(() => kg || 0), note: "", mts: ts, warm: null }, extra || {});
}
const Q = (ts, groups) => ({ id: "q" + (++n), ts, kind: "quick", groups, note: "", mts: ts });
const skill = (ts) => ({ id: "b" + (++n), ts, date: M.dateStr(ts), areaId: "pushup", step: 3, sets: [10, 10], note: "", mts: ts, variant: "" });
const S = (log, split, ov, now) => T.splitState(log, now || NOW, split || "five", ov === undefined ? null : ov);
const names = st => st.days[st.index].name;
const shuffled = list => { const a = list.slice(); let s = 11; for (let i = a.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) % 2147483648; const k = s % (i + 1); [a[i], a[k]] = [a[k], a[i]]; } return a; };

// One day of each kind, by its usual exercises.
const legs = (ts) => [G(ts, "squat_bb", [5, 5, 5], 40), G(ts + 60000, "leg_press", [10, 10, 10], 80)];
const back = (ts) => [G(ts, "pulldown", [10, 10, 10], 40), G(ts + 60000, "row_cable", [10, 10, 10], 35)];
const shoulders = (ts) => [G(ts, "ohp_db", [10, 10, 10], 12), G(ts + 60000, "lateral_db", [12, 12, 12], 6)];
const chest = (ts) => [G(ts, "bench_db", [10, 10, 10], 20), G(ts + 60000, "incline_db", [10, 10, 10], 16)];
const arms = (ts) => [G(ts, "curl_db", [10, 10, 10], 10), G(ts + 60000, "pushdown", [12, 12, 12], 20)];
const abs = (ts) => [G(ts, "leg_lift", [12, 12, 12], 0), G(ts + 60000, "plank", [40, 40], 0)];

section("the splits there are");
{
  eq("three, each with its days in rotation order", T.splits(), [
    { id: "five", name: "5 days", days: ["Legs", "Back + Shoulders", "Chest", "Arms", "Abs"] },
    { id: "six", name: "6 days", days: ["Legs", "Back", "Shoulders", "Chest", "Arms", "Abs"] },
    { id: "ppl6", name: "Push / Pull / Legs", days: ["Push", "Pull", "Legs", "Push", "Pull", "Legs"] }
  ]);
  eq("no plan for \"off\", a skills rotation, a split nobody knows, or a time that isn't one",
    [S([], "off"), S([], "bb3"), S([], "constructor"), S([], "__proto__"), T.splitState([], NaN, "five", null), T.splitState([], NOW, 5, null), T.splitState(null, NOW, {}, null)],
    [null, null, null, null, null, null, null]);
}

section("with nothing logged: day 1, from the starting lists");
{
  const st = S([]);
  eq("day 1 of 5, because there is nothing to go by", [st.id, st.name, st.index, st.source, st.days.length, st.done], ["five", "5 days", 0, "first", 5, false]);
  eq("each day starts from its groups' lists", st.days.map(d => d.exercises), [
    ["leg_press", "leg_curl", "bulgarian_db", "leg_ext", "calf_raise"],
    ["pulldown", "row_cable", "row_db", "ohp_db", "lateral_db", "rear_fly_db"],
    ["bench_db", "incline_db", "chest_press", "pec_deck"],
    ["curl_db", "pushdown", "hammer_db", "oh_ext_cable"],
    ["star_crunch", "leg_flutter", "bicycle", "plank_knee_elbow", "boat_hold", "seated_in_out"]]);
  eq("today's exercises: 3 sets each, none done", st.items, st.days[0].exercises.map(exId => ({ exId, sets: 3, done: 0, complete: false })));
  eq("no day has been trained", st.days.map(d => d.last), [null, null, null, null, null]);
  eq("the six-day split keeps back and shoulders apart", S([], "six").days.map(d => d.name + ":" + d.groups.join("+")),
    ["Legs:legs", "Back:back", "Shoulders:shoulders", "Chest:chest", "Arms:arms", "Abs:abs"]);
  eq("push / pull / legs: each push and pull day takes its side of shoulders and arms", S([], "ppl6").days.slice(0, 3).map(d => [d.name, d.groups, d.exercises]), [
    ["Push", ["chest", "shoulders", "arms"], ["bench_db", "ohp_db", "incline_db", "lateral_db", "pushdown", "oh_ext_cable"]],
    ["Pull", ["back", "shoulders", "arms"], ["pulldown", "row_cable", "row_db", "rear_fly_db", "curl_db", "hammer_db"]],
    ["Legs", ["legs", "abs"], ["leg_press", "leg_curl", "bulgarian_db", "leg_ext", "calf_raise", "leg_lift"]]]);
}

section("which day today is: the one after the last day trained");
{
  eq("legs, then back and shoulders, then chest: arms is next", [names(S([].concat(legs(O(5)), back(O(6)), shoulders(O(6, 13)), chest(O(7))))), S([].concat(legs(O(5)), back(O(6)), chest(O(7)))).source], ["Arms", "next"]);
  eq("days off in between change nothing", names(S([].concat(legs(O(1)), back(O(4)), chest(O(9))))), "Arms");
  eq("trained out of order: the plan carries on from what was done (legs, then chest → arms)", names(S([].concat(legs(O(5)), chest(O(6))))), "Arms");
  eq("after the last day the rotation starts again", names(S([].concat(arms(O(8)), abs(O(9))))), "Legs");
  eq("a day is the one whose exercises got the most counted sets: chest with one set of curls is a chest day",
    names(S([].concat(chest(O(8)), [G(O(8, 13), "curl_db", [10], 10)]))), "Arms");
  eq("…and warm-ups don't count towards it", names(S([].concat([G(O(8), "bench_db", [10, 10], 20, { warm: [1, 1] })], arms(O(8, 13))))), "Abs");
  eq("a quick gym log counts by its groups", names(S([Q(O(8), { legs: 6 })])), "Back + Shoulders");
  eq("a skills session or a weigh-in is no day of the split", [names(S([].concat(legs(O(5)), [skill(O(6)), { id: "w", ts: O(7), kind: "body", kg: 72, waist: null, note: "", mts: 1 }]))), S([skill(O(6))]).source], ["Back + Shoulders", "first"]);
  eq("each day remembers when it was last trained", S([].concat(legs(O(5)), back(O(6)), legs(O(9)))).days.map(d => d.last), [O(9) + 60000, O(6) + 60000, null, null, null]);
  eq("only the last 120 days count: a session 121 days back is as good as none", [S(legs(M.addDays(M.startOfDay(NOW), -120).getTime() + 3600000)).source, S(legs(M.addDays(M.startOfDay(NOW), -121).getTime() + 3600000)).source], ["next", "first"]);
  eq("23:30 and 00:30 are two dates, so two days of the rotation", names(S([].concat(legs(O(6, 23, 30)), back(O(7, 0, 30))))), "Chest");
  eq("a session dated tomorrow hasn't happened", names(S([].concat(legs(O(9)), back(O(13))))), "Back + Shoulders");
}

section("today: what is logged today, or the day picked by hand");
{
  const before = [].concat(legs(O(5)), back(O(6)), chest(O(7)));
  eq("nothing logged today: the next day", [names(S(before)), S(before).source], ["Arms", "next"]);
  const today = before.concat([G(O(12, 8), "leg_lift", [12, 12], 0)]);
  eq("abs logged today instead: today is the abs day", [names(S(today)), S(today).source], ["Abs", "today"]);
  eq("picked by hand for today", [names(S(before, "five", { d: "2026-10-12", day: 0 })), S(before, "five", { d: "2026-10-12", day: 0 }).source], ["Legs", "override"]);
  eq("…and that wins over what was logged", names(S(today, "five", { d: "2026-10-12", day: 2 })), "Chest");
  eq("yesterday's pick, a day the split doesn't have, or junk: ignored",
    [{ d: "2026-10-11", day: 0 }, { d: "2026-10-12", day: 5 }, { d: "2026-10-12", day: -1 }, { d: "2026-10-12", day: null }, { d: "2026-10-12" }, "x", 7, { day: 0 }].map(ov => names(S(before, "five", ov))),
    ["Arms", "Arms", "Arms", "Arms", "Arms", "Arms", "Arms", "Arms"]);
  eq("the day after today's is found from today's", names(S(today, "five", null, O(13, 9))), "Legs");
}

section("what a day holds: what its last sessions had");
{
  const older = [G(O(1), "bench_db", [10, 10, 10], 20), G(O(1, 13), "chest_press", [10, 10, 10], 40), G(O(1, 14), "fly_cable", [12, 12], 10)];
  const latest = [G(O(6), "incline_db", [10, 10, 10], 16), G(O(6, 13), "bench_db", [10, 10, 10], 20)];
  const chestOf = log => S(log).days[2].exercises;
  eq("the latest session's exercises in the order done, then what the one before had besides", chestOf(older.concat(latest)), ["incline_db", "bench_db", "chest_press", "fly_cable"]);
  eq("a third session back is not looked at", chestOf([G(M.addDays(M.startOfDay(O(1)), -7).getTime() + 3600000, "pec_deck", [12], 30)].concat(older, latest)), ["incline_db", "bench_db", "chest_press", "fly_cable"]);
  eq("an exercise of another day done that date isn't taken along (curls on chest day)", chestOf(latest.concat([G(O(6, 14), "curl_db", [10], 10)])), ["incline_db", "bench_db"]);
  T.useExercises([{ id: "x_ring", name: "Ring fly", group: "chest", sec: [], equip: "other", lo: 8, hi: 12, inc: 2.5, perHand: false, load: "bw", timed: false, note: "", del: true, mts: 5 }]);
  eq("one of your own that was removed from the list is left out", chestOf(latest.concat([G(O(6, 14), "x_ring", [10], 0)])), ["incline_db", "bench_db"]);
  T.useExercises([]);
  eq("a retired exercise is left out too", S([G(O(6), "pulldown", [10, 10], 40), G(O(6, 13), "pullup_assist", [8, 8, 8], 30), G(O(6, 14), "ohp_db", [10], 12)]).days[1].exercises, ["pulldown", "ohp_db"]);
  eq("a group the sessions left empty gets its starting list: back and shoulders after a day of back only",
    S(back(O(6))).days[1].exercises, ["pulldown", "row_cable", "ohp_db", "lateral_db", "rear_fly_db"]);
  const st = S(older.concat(latest, [G(O(12, 8), "pec_deck", [12, 12], 30)]));
  eq("today's list also takes what was logged today and belongs", [names(st), st.days[2].exercises], ["Chest", ["incline_db", "bench_db", "chest_press", "fly_cable", "pec_deck"]]);
}

section("today's exercises: sets to do, sets done");
{
  const pyr = ts => G(ts, "squat_bb", [15, 12, 9, 15, 12, 9, 5], [0, 0, 0, 9, 22.5, 31.5, 43.25], { warm: [1, 1, 1, 0, 0, 0, 0] });
  const before = [].concat(abs(O(8)), [pyr(O(1)), G(O(1, 13), "leg_press", Array.from({ length: 14 }, () => 10), 80)]);
  const item = (st, id) => st.items.find(x => x.exId === id);
  let st = S(before);
  eq("(legs is next)", names(st), "Legs");
  eq("the sets to do are the counted sets of last time: a pyramid's 4 without its 3 warm-ups; never more than 10", [item(st, "squat_bb"), item(st, "leg_press")],
    [{ exId: "squat_bb", sets: 4, done: 0, complete: false }, { exId: "leg_press", sets: 10, done: 0, complete: false }]);
  st = S(before.concat([G(O(12, 8), "squat_bb", [15, 5], [9, 43.25], { warm: [1, 0] })]));
  eq("one counted set done today out of four", item(st, "squat_bb"), { exId: "squat_bb", sets: 4, done: 1, complete: false });
  st = S(before.concat([pyr(O(12, 8))]));
  eq("all four done", [item(st, "squat_bb"), st.done], [{ exId: "squat_bb", sets: 4, done: 4, complete: true }, false]);
  const small = [].concat(abs(O(8)), [G(O(1), "leg_ext", [12, 12], 30)]);
  st = S(small.concat([G(O(12, 8), "leg_ext", [12, 12, 12], 30)]));
  eq("the day is done when every exercise is", [st.items, st.done], [[{ exId: "leg_ext", sets: 2, done: 3, complete: true }], true]);
  eq("an exercise never logged asks for 3", S(abs(O(8))).items[0], { exId: "leg_press", sets: 3, done: 0, complete: false });
}

section("push / pull / legs, six days: the two halves take turns");
{
  const push = ts => [G(ts, "bench_db", [10, 10, 10], 20), G(ts + 60000, "ohp_db", [10, 10], 12), G(ts + 120000, "pushdown", [12, 12], 20)];
  const pull = ts => [G(ts, "pulldown", [10, 10, 10], 40), G(ts + 60000, "rear_fly_db", [12, 12], 6), G(ts + 120000, "curl_db", [10, 10], 10)];
  const P = log => T.splitState(log, NOW, "ppl6", null);
  eq("push, pull, legs, push: the fifth day (the second pull) is next", [P([].concat(push(O(5)), pull(O(6)), legs(O(7)), push(O(8)))).index, P([].concat(push(O(5)), pull(O(6)), legs(O(7)))).index], [4, 3]);
  eq("after the sixth it starts again", P([].concat(push(O(3)), pull(O(4)), legs(O(5)), push(O(6)), pull(O(7)), legs(O(8)))).index, 0);
  eq("presses and triceps are push, rear delts and biceps are pull: a day of curls and rear delts is a pull day", P([G(O(8), "curl_db", [10, 10, 10], 10), G(O(8, 13), "face_pull", [12, 12], 15)]).index, 2);
  const a = P([].concat(push(O(5)), pull(O(6)), legs(O(7)), [G(O(8), "chest_press", [10, 10, 10], 40), G(O(8, 13), "skull_bb", [10, 10], 20)]));
  eq("each half keeps its own exercises: the first push day and the second", [a.days[0].exercises.slice(0, 3), a.days[3].exercises.slice(0, 2)], [["bench_db", "ohp_db", "pushdown"], ["chest_press", "skull_bb"]]);
  eq("…and the second, with no shoulder work yet, gets the push side of the starting list for it", a.days[3].exercises, ["chest_press", "skull_bb", "ohp_db", "lateral_db"]);
  T.useExercises([{ id: "x_arm", name: "Band work", group: "arms", sec: [], equip: "other", lo: 10, hi: 15, inc: 2.5, perHand: false, load: "bw", timed: false, note: "", del: false, mts: 5 }]);
  eq("an arm exercise of your own has no side: it belongs to push and to pull",
    [P(push(O(5)).concat([G(O(5, 14), "x_arm", [12], 0)])).days[0].exercises.indexOf("x_arm") !== -1, P(pull(O(5)).concat([G(O(5, 14), "x_arm", [12], 0)])).days[1].exercises.indexOf("x_arm") !== -1], [true, true]);
  T.useExercises([]);
  eq("legs day takes abs along", P(legs(O(8)).concat(abs(O(8, 14)))).days[2].exercises, ["squat_bb", "leg_press", "leg_lift", "plank"]);
}

section("the same log, the same plan");
{
  const log = [].concat(legs(O(1)), back(O(2)), shoulders(O(2, 14)), chest(O(3)), arms(O(5)), abs(O(6)), legs(O(8)), back(O(9)), [Q(O(10), { chest: 8 }), skill(O(11))]);
  const a = S(log);
  check("in any order", J(S(shuffled(log))) === J(a) && J(S(log.slice().reverse())) === J(a));
  check("with or without the index at hand", J(T.splitState(log, NOW, "five", null, T.gymIndex(log))) === J(a));
  eq("(after legs, back + shoulders and a quick chest log: arms)", names(a), "Arms");
  const junk = [null, 7, "x", {}, { kind: "gym" }, { kind: "gym", ts: O(8), exId: "bench_db", sets: "8" }, { kind: "gym", ts: 1e300, exId: "bench_db", sets: [8], kg: [20] },
    { kind: "gym", ts: O(8), exId: "__proto__", sets: [8], kg: [20] }, { kind: "quick", ts: O(8), groups: null }, { kind: "quick", ts: O(8), groups: { glutes: 4, chest: "x" } }];
  const threw = [];
  [[], null, undefined, "log", junk, log.concat(junk)].forEach((lg, i) => ["five", "six", "ppl6", "off", "", null, 3, {}].forEach(sp =>
    [NOW, O(25, 2, 30), NaN, null, "soon", 1e300].forEach(t => [null, undefined, "x", { d: "2026-10-12", day: 1 }, { d: 5, day: "x" }].forEach(ov => {
      try { T.splitState(lg, t, sp, ov); T.splitState(lg, t, sp, ov, T.gymIndex(lg)); } catch (e) { threw.push(i + " " + String(sp) + " " + String(t) + ": " + e.message); }
    }))));
  check("nothing throws, for odd logs, splits, times and picks", !threw.length, threw.slice(0, 3).join("\n       "));
  eq("junk alone is an empty plan", [S(junk).source, S(junk).index], ["first", 0]);
  const big = [];
  for (let i = 0; i < 3000; i++) big.push(G(M.addDays(M.startOfDay(NOW), -Math.floor(i / 6)).getTime() + (8 + i % 6) * 3600000, ["squat_bb", "pulldown", "ohp_db", "bench_db", "curl_db", "leg_lift"][Math.floor(i / 6) % 6], [10, 10, 10], 20));
  const idx = T.gymIndex(big), t0 = Date.now();
  ["five", "six", "ppl6"].forEach(sp => T.splitState(big, NOW, sp, null, idx));
  check("3,000 entries: the three plans in well under a tenth of a second", Date.now() - t0 < 100, "took " + (Date.now() - t0) + " ms");
}

h.done(__filename);
