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
    { id: "six", name: "6 days", days: ["Shoulders", "Chest", "Back", "Arms", "Legs", "Abs"] },
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
    ["Shoulders:shoulders", "Chest:chest", "Back:back", "Arms:arms", "Legs:legs", "Abs:abs"]);
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
  eq("a weigh-in is no day of the split", [names(S([].concat(legs(O(5)), [{ id: "w", ts: O(7), kind: "body", kg: 72, waist: null, note: "", mts: 1 }]))), S([{ id: "w", ts: O(7), kind: "body", kg: 72, waist: null, note: "", mts: 1 }]).source], ["Back + Shoulders", "first"]);
  eq("a skills session is: push-ups are a chest day's work", [names(S([].concat(legs(O(5)), [skill(O(6))]))), S([skill(O(6))]).source], ["Arms", "next"]);
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

/* ---- The six-day split's order, skills in the rotation, bodyweight mode ---- */

const SK = (ts, areaId, step, sets, variant) => ({ id: "b" + (++n), ts, date: M.dateStr(ts), areaId, step: step || 3, sets: sets || [10, 10], note: "", mts: ts, variant: variant || "" });
// Steps: all at 5, where every ladder's main group is the usual one.
const AT = step => ({ pushup: { step, std: 0 }, pullup: { step, std: 0 }, legraise: { step, std: 0 }, squat: { step, std: 0 }, bridge: { step, std: 0 }, hspu: { step, std: 0 } });
const B = (log, split, ov, areas, now) => T.splitState(log, now || NOW, split || "five", ov === undefined ? null : ov, null, { mode: "body", areas: areas || AT(5) });

section("the six-day split: shoulders, chest, back, arms, legs, abs");
{
  const six = S([], "six");
  eq("starts on shoulders", [six.index, names(six)], [0, "Shoulders"]);
  eq("each day follows the one before", [shoulders(O(5)), chest(O(5)), back(O(5)), arms(O(5)), legs(O(5)), abs(O(5))].map(d => names(S(d, "six"))),
    ["Chest", "Back", "Arms", "Legs", "Abs", "Shoulders"]);
  eq("a whole week in order comes round to shoulders", names(S([].concat(shoulders(O(5)), chest(O(6)), back(O(7)), arms(O(8)), legs(O(9)), abs(O(10))), "six")), "Shoulders");
}

section("skills count for the day they train, in either mode");
{
  eq("pull-ups after a legs day: back + shoulders is done, chest is next", names(S([].concat(legs(O(5)), [SK(O(6), "pullup")]))), "Chest");
  eq("the most sets still decide: a chest day with one set of leg raises is a chest day", names(S([].concat(chest(O(8)), [SK(O(8, 13), "legraise", 3, [10])]))), "Arms");
  eq("…and six sets of squats beat three of curls", names(S([SK(O(8), "squat", 3, [20, 20, 20, 20, 20, 20]), G(O(8, 13), "curl_db", [10, 10, 10], 10)])), "Back + Shoulders");
  eq("a set that failed (0) is no set", S([SK(O(8), "squat", 3, [0, 0])]).source, "first");
  eq("each ladder by its main group: push-ups chest, pull-ups and bridges back, leg raises abs, squats legs, handstand push-ups shoulders",
    ["pushup", "pullup", "bridge", "legraise", "squat", "hspu"].map(a => names(S([SK(O(8), a, 5)], "six"))), ["Back", "Arms", "Arms", "Shoulders", "Abs", "Chest"]);
  eq("by the step it was done at: short bridges (step 1) are legs work", names(S([SK(O(8), "bridge", 1)], "six")), "Abs");
  eq("a variation by what it trains: a plank hold in the push-up ladder is abs work", names(S([SK(O(8), "pushup", 3, [40, 40], "Plank Hold")], "six")), "Shoulders");
  eq("push / pull / legs: handstand push-ups push, pull-ups pull", [names(S([SK(O(8), "hspu", 5)], "ppl6")), names(S([SK(O(8), "pullup", 5)], "ppl6")), names(S([SK(O(8), "squat", 5)], "ppl6"))], ["Pull", "Legs", "Push"]);
  eq("today's skill session is today's day", [S([].concat(legs(O(10)), [SK(NOW - 3600000, "pushup")])).source, names(S([].concat(legs(O(10)), [SK(NOW - 3600000, "pushup")])))], ["today", "Chest"]);
  eq("gym mode lists no skills", [S([]).mode, S([]).skills, S([]).days.map(d => d.skills.length)], ["gym", [], [0, 0, 0, 0, 0]]);
  eq("a day done with skills alone hands no exercises on: the gym list is still the last gym session's", S([].concat(chest(O(1)), [SK(O(6), "pushup"), SK(O(9), "pushup")])).days[2].exercises, ["bench_db", "incline_db"]);
  eq("…and so is one logged with a quick gym log", S([].concat(chest(O(1)), [Q(O(6), { chest: 9 }), Q(O(9), { chest: 9 })])).days[2].exercises, ["bench_db", "incline_db"]);
}

section("bodyweight mode: the same day, without a gym");
{
  const st = B([]);
  eq("the same split and day as gym mode, marked as bodyweight", [st.id, st.mode, st.index, st.source, st.days.map(d => d.name)], ["five", "body", 0, "first", ["Legs", "Back + Shoulders", "Chest", "Arms", "Abs"]]);
  eq("each day's skills: the ladders whose main group is one of its groups", st.days.map(d => d.skills), [["squat"], ["pullup", "bridge", "hspu"], ["pushup"], [], ["legraise"]]);
  eq("each day's exercises start from the bodyweight lists", st.days.map(d => d.exercises), [
    ["lunge_bw", "calf_raise_bw", "wall_sit"],
    ["pullup_std", "chinup_w", "pushup_pike"],
    ["pushup_std", "pushup_decline", "dips"],
    ["bench_dips", "pushup_close", "chinup_w"],
    ["star_crunch", "leg_flutter", "bicycle", "plank_knee_elbow", "boat_hold", "seated_in_out"]]);
  eq("today: the day's skills to do, and its exercises at 3 sets", [st.skills, st.items.map(it => [it.exId, it.sets, it.done]), st.done],
    [[{ areaId: "squat", done: 0, complete: false }], [["lunge_bw", 3, 0], ["calf_raise_bw", 3, 0], ["wall_sit", 3, 0]], false]);
  eq("six days: one skill-led day each, arms from exercises alone", B([], "six").days.map(d => [d.name, d.skills, d.exercises.length]),
    [["Shoulders", ["hspu"], 1], ["Chest", ["pushup"], 3], ["Back", ["pullup", "bridge"], 2], ["Arms", [], 3], ["Legs", ["squat"], 3], ["Abs", ["legraise"], 6]]);
  eq("push / pull / legs: each side's skills and bodyweight exercises", B([], "ppl6").days.slice(0, 3).map(d => [d.name, d.skills, d.exercises]), [
    ["Push", ["pushup", "hspu"], ["pushup_std", "pushup_decline", "dips", "pushup_pike", "bench_dips", "pushup_close"]],
    ["Pull", ["pullup", "bridge"], ["pullup_std", "chinup_w"]],
    ["Legs", ["legraise", "squat"], ["lunge_bw", "calf_raise_bw", "wall_sit", "star_crunch", "leg_flutter", "bicycle", "plank_knee_elbow", "boat_hold", "seated_in_out"]]]);

  eq("skills follow the step you are on: at step 1 the bridge is legs work, and the headstand counts for shoulders",
    B([], "five", null, AT(1)).days.map(d => d.skills), [["squat", "bridge"], ["pullup", "hspu"], ["pushup"], [], ["legraise"]]);
  eq("no steps to go by: as at step 1", [T.splitState([], NOW, "five", null, null, { mode: "body", areas: null }).days[0].skills, T.splitState([], NOW, "five", null, null, { mode: "body", areas: "junk" }).days[0].skills, T.splitState([], NOW, "five", null, null, { mode: "body" }).days[0].skills],
    [["squat", "bridge"], ["squat", "bridge"], ["squat", "bridge"]]);

  // The day is the log's: the same in both modes.
  const gymWeek = [].concat(legs(O(5)), back(O(6)), shoulders(O(6, 13)), chest(O(7)));
  eq("switching mode never moves the day", [names(S(gymWeek)), names(B(gymWeek)), S(gymWeek).index === B(gymWeek).index], ["Arms", "Arms", true]);
  eq("gym exercises stay out of the bodyweight list: a day with gym history alone starts from the bodyweight list", B(gymWeek).days[2].exercises, ["pushup_std", "pushup_decline", "dips"]);
  eq("…and the gym list is untouched by the mode", S(gymWeek).days[2].exercises, ["bench_db", "incline_db"]);
  const mixed = [].concat(chest(O(1)), [G(O(1, 14), "pushup_wide", [15, 15], 0)], legs(O(2)));
  eq("push-ups done after the bench are part of a gym session: the bodyweight list still starts from its own", B(mixed).days[2].exercises, ["pushup_std", "pushup_decline", "dips"]);
  eq("…and they are on the gym list, as before", S(mixed).days[2].exercises, ["bench_db", "incline_db", "pushup_wide"]);
  const pure = mixed.concat([G(O(6), "pushup_wide", [15, 15, 15], 0), G(O(6, 13), "dips", [8, 8], 0)]);
  eq("a session with no equipment is a bodyweight one: what it had is the bodyweight list", [B(pure).days[2].exercises, S(pure).days[2].exercises], [["pushup_wide", "dips"], ["bench_db", "incline_db", "pushup_wide"]]);
  eq("a day that never uses equipment is the same in both modes", [B([].concat(abs(O(1)))).days[4].exercises, S([].concat(abs(O(1)))).days[4].exercises], [["leg_lift", "plank"], ["leg_lift", "plank"]]);

  // A week without a gym.
  const home = [SK(O(5), "squat", 5, [20, 20]), G(O(5, 13), "lunge_bw", [12, 12, 12], 0), SK(O(6), "pullup", 5, [6, 6]), SK(O(6, 13), "hspu", 5, [5, 5]), G(O(6, 14), "pushup_pike", [10, 10], 0),
    SK(O(7), "pushup", 5, [20, 20]), G(O(7, 13), "pushup_decline", [12, 12, 12], 0)];
  const hw = B(home);
  eq("a week of bodyweight days turns the rotation: legs, back + shoulders, chest → arms", [names(hw), hw.source], ["Arms", "next"]);
  eq("each day lists what was done on it", [hw.days[0].exercises, hw.days[1].exercises, hw.days[2].exercises], [["lunge_bw"], ["pushup_pike", "pullup_std", "chinup_w"], ["pushup_decline"]]);
  eq("an arms day has no skill, and starts from its three exercises", [hw.skills, hw.items.map(it => it.exId)], [[], ["bench_dips", "pushup_close", "chinup_w"]]);
  eq("back in gym mode the gym lists are where they were left", S(gymWeek.concat(home.map(e => Object.assign({}, e, { ts: e.ts + 86400000 * 4, date: undefined })))).days[2].exercises, ["bench_db", "incline_db"]);

  // Today, part done.
  const arms1 = home.concat([G(NOW - 3600000, "bench_dips", [12, 12, 12], 0), G(NOW - 1800000, "pushup_close", [10], 0)]);
  const a1 = B(arms1);
  eq("today's arms work is an arms day, though close push-ups are a chest exercise too", [names(a1), a1.source], ["Arms", "today"]);
  eq("…with its sets counted", a1.items.map(it => [it.exId, it.done, it.complete]), [["bench_dips", 3, true], ["pushup_close", 1, false], ["chinup_w", 0, false]]);
  const legsToday = [SK(NOW - 3600000, "squat", 5, [20, 20])];
  const l1 = B(legsToday);
  eq("a skill is done once it has a set today", [names(l1), l1.skills, l1.done], ["Legs", [{ areaId: "squat", done: 2, complete: true }], false]);
  const l2 = B(legsToday.concat(["lunge_bw", "calf_raise_bw", "wall_sit"].map((id, i) => G(NOW - 1800000 + i * 60000, id, [12, 12, 12], 0))));
  eq("a day with no history keeps its starting list once the first exercise is logged, in gym mode too",
    [B([G(NOW - 3600000, "calf_raise_bw", [15], 0)]).items.map(it => it.exId), S([G(NOW - 3600000, "leg_curl", [12], 30)]).items.map(it => [it.exId, it.done])],
    [["lunge_bw", "calf_raise_bw", "wall_sit"], [["leg_press", 0], ["leg_curl", 1], ["bulgarian_db", 0], ["leg_ext", 0], ["calf_raise", 0]]]);
  eq("…and something else logged today joins the end of it", S([G(NOW - 3600000, "squat_bb", [5], 40)]).items.map(it => it.exId), ["leg_press", "leg_curl", "bulgarian_db", "leg_ext", "calf_raise", "squat_bb"]);
  eq("after two weeks without a gym, the gym list is still the gym's", S([].concat(chest(O(1)), [SK(O(5), "pushup", 5), G(O(5, 13), "pushup_decline", [12, 12], 0), SK(O(9), "pushup", 5), G(O(9, 13), "pushup_std", [20, 20], 0)])).days[2].exercises, ["bench_db", "incline_db"]);
  eq("…while a day that never uses equipment keeps going by its latest sessions", S([].concat(abs(O(1)), [G(O(5), "leg_lift", [12, 12], 0), G(O(5, 13), "bicycle", [40, 40], 0)])).days[4].exercises, ["leg_lift", "bicycle", "plank"]);
  eq("the day is done when every skill and every exercise is", [l2.done, B(["lunge_bw", "calf_raise_bw", "wall_sit"].map((id, i) => G(NOW - 1800000 + i * 60000, id, [12, 12, 12], 0))).done], [true, false]);
  eq("an arms day with nothing but exercises is done when they are", B(home.concat(["bench_dips", "pushup_close", "chinup_w"].map((id, i) => G(NOW - 1800000 + i * 60000, id, [10, 10, 10], 0)))).done, true);
  eq("a day picked by hand holds in bodyweight mode too", names(B(home, "five", { d: "2026-10-12", day: 4 })), "Abs");

  // Removed and retired exercises, your own.
  T.useExercises([{ id: "x_ring", name: "Ring row", group: "back", sec: ["arms"], equip: "bodyweight", load: "bw", timed: false, perHand: false, inc: 2.5, lo: 8, hi: 15, note: "", del: false, mts: 5 },
    { id: "x_band", name: "Band curl", group: "arms", sec: [], equip: "other", load: "ext", timed: false, perHand: false, inc: 1, lo: 10, hi: 15, note: "", del: false, mts: 5 }]);
  const own2 = [G(O(6), "x_ring", [10, 10, 10], 0), G(O(8), "x_band", [12, 12], 5)];
  eq("one of your own joins the bodyweight list if it needs no equipment", [B(own2).days[1].exercises, B(own2).days[3].exercises], [["x_ring", "pushup_pike"], ["bench_dips", "pushup_close", "chinup_w"]]);
  T.useExercises([]);

  // The same from the same log.
  const a = J(B(arms1));
  check("the same from the same log in any order, with or without the index", J(B(shuffled(arms1))) === a && J(B(arms1.slice().reverse())) === a &&
    J(T.splitState(arms1, NOW, "five", null, T.gymIndex(arms1), { mode: "body", areas: AT(5) })) === a);
  const junk = [null, 7, "x", {}, { areaId: "pushup" }, { areaId: "pushup", ts: O(8), sets: "8" }, { areaId: "__proto__", ts: O(8), step: 3, sets: [8] }, { areaId: "pushup", ts: 1e300, step: 3, sets: [8] },
    { areaId: "pushup", ts: O(8), step: "x", sets: [8, 8] }, { areaId: 7, ts: O(8), step: 3, sets: [8] }];
  const threw = [];
  [[], null, "log", junk, arms1.concat(junk)].forEach((lg, i) => ["five", "six", "ppl6", "off", null].forEach(sp =>
    [undefined, null, "x", 7, {}, { mode: "body" }, { mode: "body", areas: null }, { mode: "body", areas: { pushup: null, squat: { step: "x" }, bridge: { step: -3 }, hspu: { step: 1e9 } } }, { mode: 5, areas: AT(5) }].forEach((op, k) => {
      try { T.splitState(lg, NOW, sp, null, null, op); T.splitState(lg, NaN, sp, null, undefined, op); } catch (e) { threw.push(i + " " + String(sp) + " " + k + ": " + e.message); }
    })));
  check("nothing throws, for odd logs, steps and options", !threw.length, threw.slice(0, 3).join("\n       "));
  eq("any other mode is gym mode", ["gym", "bw", "", null, 5].map(m => T.splitState([], NOW, "five", null, null, { mode: m, areas: AT(5) }).mode), ["gym", "gym", "gym", "gym", "gym"]);
  const big = [];
  for (let i = 0; i < 3000; i++) big.push(i % 3 ? G(M.addDays(M.startOfDay(NOW), -Math.floor(i / 6)).getTime() + (8 + i % 6) * 3600000, ["pushup_std", "pullup_std", "bench_dips", "leg_lift", "lunge_bw", "pushup_pike"][Math.floor(i / 6) % 6], [10, 10, 10], 0)
    : SK(M.addDays(M.startOfDay(NOW), -Math.floor(i / 6)).getTime() + (8 + i % 6) * 3600000, ["pushup", "pullup", "squat", "legraise", "bridge", "hspu"][Math.floor(i / 6) % 6], 5));
  const idx = T.gymIndex(big), t0 = Date.now();
  ["five", "six", "ppl6"].forEach(sp => T.splitState(big, NOW, sp, null, idx, { mode: "body", areas: AT(5) }));
  check("3,000 entries: the three bodyweight plans in well under a tenth of a second", Date.now() - t0 < 100, "took " + (Date.now() - t0) + " ms");
}

/* ---- Circuits: where a hands-free countdown goes after a set ---- */

const SIX = ["star_crunch", "leg_flutter", "bicycle", "plank_knee_elbow", "boat_hold", "seated_in_out"];
const N = (log, exId, now) => T.circuitNext(log, exId, now === undefined ? NOW : now);
// The six done `rounds` times on a day, a minute apart, in order.
const circuit = (ts, rounds, secs) => SIX.map((id, i) => G(ts + i * 60000, id, Array(rounds).fill(secs || 40), 0));
// Today so far: one set of the first `k` of `list`.
const today = (list, k, sets) => list.slice(0, k).map((id, i) => G(NOW - 3600000 + i * 60000, id, sets || [40], 0));

section("circuits: which exercises go round together");
{
  eq("the six abs exercises are one circuit, whichever of them you ask from", SIX.map(id => T.circuitOf(id)), SIX.map(() => SIX));
  eq("any other exercise is in none: timed or not, unknown, or not an id", ["plank", "hold_failure", "bench_db", "nope", "__proto__", "", null, undefined, 7, {}].map(id => T.circuitOf(id)),
    [null, null, null, null, null, null, null, null, null, null]);
  eq("held as long as you can: Hold till failure, and nothing else", ["hold_failure", "plank", "star_crunch", "wall_sit", "bench_db", "nope", null, 7, {}].map(id => T.toFailure(id)),
    [true, false, false, false, false, false, false, false, false]);
  eq("…its next set after one: itself, as for any exercise in no circuit", N([G(NOW - 60000, "hold_failure", [45], 0)], "hold_failure"), { exId: "hold_failure", set: 2, sets: 3, circuit: false });
  eq("each side: the two that say so, and nothing else", SIX.concat(["plank", "knee_raise_side", "nope", null]).map(id => T.eachSide(id)),
    [true, false, false, true, false, false, false, false, false, false]);
}

section("circuits: the next set, round after round");
{
  eq("after the first set of the first one: the second, set 1 of 3", N(today(SIX, 1), "star_crunch"), { exId: "leg_flutter", set: 1, sets: 3, circuit: true });
  eq("in order, one set of each", [1, 2, 3, 4, 5].map(k => N(today(SIX, k), SIX[k - 1]).exId), SIX.slice(1));
  eq("after the last one, round again from the top: set 2", N(today(SIX, 6), "seated_in_out"), { exId: "star_crunch", set: 2, sets: 3, circuit: true });
  // A full run from nothing: ask, log the set, ask again.
  const run = (start, log, cap) => {
    const order = []; let at = start, lg = log.slice(), guard = 0;
    const add = id => { const e = lg.find(x => x.exId === id && M.dateStr(x.ts) === M.dateStr(NOW)); if (e) { e.sets.push(40); e.kg.push(0); } else lg.push(G(NOW - 3600000 + lg.length * 1000, id, [40], 0)); };
    add(at); order.push(at);
    for (let nx = N(lg, at); nx && guard++ < (cap || 100); nx = N(lg, at)) { at = nx.exId; add(at); order.push(at); }
    return order;
  };
  eq("three rounds of the six, then nothing more", run("star_crunch", []), SIX.concat(SIX, SIX));
  const fromThird = run("bicycle", []);
  eq("started in the middle: still one set of each per round, 18 in all", [fromThird.length, fromThird.slice(0, 6), SIX.map(id => fromThird.filter(x => x === id).length)],
    [18, ["bicycle", "plank_knee_elbow", "boat_hold", "seated_in_out", "star_crunch", "leg_flutter"], [3, 3, 3, 3, 3, 3]]);
  eq("when the last set is in: nothing", N(circuit(NOW - 7200000, 3), "seated_in_out"), null);
  eq("as many rounds as last time: two, if that is what the last session had", run("star_crunch", circuit(O(5), 2)).length, 12);
  eq("…the most any of them had, when last time was cut short", run("star_crunch", circuit(O(5), 2).concat([G(O(5, 13), "star_crunch", [40], 0), G(O(5, 13, 1), "leg_flutter", [40], 0)])).length, 18);
  eq("never more than ten rounds", N(circuit(O(5), 30), "star_crunch").sets, 10);
  eq("warm-up sets aren't counted: one counted set today is set 1 done", N([G(NOW - 60000, "star_crunch", [10, 20], 0, { warm: [1, 0] })], "star_crunch"), { exId: "leg_flutter", set: 1, sets: 3, circuit: true });
  eq("one that was skipped is caught up at the end", (() => {
    const lg = SIX.filter(id => id !== "boat_hold").map((id, i) => G(NOW - 3600000 + i * 1000, id, [40, 40, 40], 0));
    return [N(lg, "seated_in_out"), N(lg.concat([G(NOW - 1000, "boat_hold", [40, 40], 0)]), "boat_hold"), N(lg.concat([G(NOW - 1000, "boat_hold", [40, 40, 40], 0)]), "boat_hold")];
  })(), [{ exId: "boat_hold", set: 1, sets: 3, circuit: true }, { exId: "boat_hold", set: 3, sets: 3, circuit: true }, null]);
  eq("yesterday's sets are not today's", N(circuit(O(11), 3), "star_crunch"), { exId: "leg_flutter", set: 1, sets: 3, circuit: true });
  eq("a set logged for tomorrow doesn't count either", N([G(O(13), "leg_flutter", [40, 40, 40], 0)].concat(today(SIX, 1)), "star_crunch").exId, "leg_flutter");
}

section("circuits: an exercise in none does its own sets");
{
  eq("the plank, first time: set 2 of 3 after the first", N([G(NOW - 60000, "plank", [60], 0)], "plank"), { exId: "plank", set: 2, sets: 3, circuit: false });
  eq("…and nothing after the third", N([G(NOW - 60000, "plank", [60, 60, 60], 0)], "plank"), null);
  eq("as many sets as last time", [N([G(O(5), "plank", [40, 40], 0), G(NOW - 60000, "plank", [45], 0)], "plank"), N([G(O(5), "plank", [40, 40], 0), G(NOW - 60000, "plank", [45, 45], 0)], "plank")],
    [{ exId: "plank", set: 2, sets: 2, circuit: false }, null]);
  eq("nothing logged today yet: its first set", N([], "plank"), { exId: "plank", set: 1, sets: 3, circuit: false });
  eq("the plank never joins the abs circuit, and the circuit never goes to the plank", [N(today(SIX, 6).concat([G(NOW - 500, "plank", [60], 0)]), "plank").exId, run6()], ["plank", true]);
  function run6() { const lg = circuit(NOW - 7200000, 3).concat([G(NOW - 500, "plank", [60], 0)]); return SIX.every(id => N(lg, id) === null); }
}

section("circuits: retired or removed exercises, your own, any order, junk");
{
  T.useExercises([{ id: "x_hollow", name: "Hollow hold", p: "abs", s: [], equip: "bodyweight", lo: 20, hi: 60, inc: 2.5, perHand: false, load: "bw", timed: true, mts: 5 }]);
  eq("one of your own does its own sets", [T.circuitOf("x_hollow"), N([G(NOW - 60000, "x_hollow", [30], 0)], "x_hollow")], [null, { exId: "x_hollow", set: 2, sets: 3, circuit: false }]);
  T.useExercises([]);
  const lg = circuit(O(5), 3).concat(today(SIX, 4)), a = J(N(lg, "plank_knee_elbow"));
  check("the same from the same log in any order, with or without the index", J(N(shuffled(lg), "plank_knee_elbow")) === a && J(N(lg.slice().reverse(), "plank_knee_elbow")) === a && J(T.circuitNext(T.gymIndex(lg), "plank_knee_elbow", NOW)) === a);
  eq("(the fifth, set 1 of 3)", JSON.parse(a), { exId: "boat_hold", set: 1, sets: 3, circuit: true });
  const junk = [null, 7, "x", {}, { kind: "gym" }, { kind: "gym", ts: NOW, exId: "star_crunch", sets: "8" }, { kind: "gym", ts: 1e300, exId: "star_crunch", sets: [8], kg: [0] }, { kind: "gym", ts: NOW, exId: "__proto__", sets: [8], kg: [0] }];
  const threw = [];
  [[], null, undefined, "log", junk, lg.concat(junk)].forEach((l, i) => ["star_crunch", "plank", "bench_db", "nope", "__proto__", "", null, 3, {}].forEach(id =>
    [NOW, O(25, 2, 30), NaN, null, "soon", 1e300].forEach(t => { try { T.circuitNext(l, id, t); T.circuitOf(id); T.eachSide(id); } catch (e) { threw.push(i + " " + String(id) + " " + String(t) + ": " + e.message); } })));
  check("nothing throws, for odd logs, exercises and times", !threw.length, threw.slice(0, 3).join("\n       "));
  eq("no next set for an exercise nobody knows or a time that isn't one", [N(lg, "nope"), N(lg, null), N(lg, "star_crunch", NaN), N(lg, "star_crunch", null)], [null, null, null, null]);
  eq("junk alone: as if nothing was logged", N(junk, "star_crunch"), { exId: "leg_flutter", set: 1, sets: 3, circuit: true });
}

section("a set time: the abs circuit is done for 40 seconds, 20 a side");
{
  const sug = (id, log) => { const sg = T.suggest(id, log || [], NOW); return [sg.kind, sg.sets, sg.targets]; };
  eq("each of the six, before any session", SIX.map(id => sug(id)), [["fixed", 3, [20, 20, 20]], ["fixed", 3, [40, 40, 40]], ["fixed", 3, [40, 40, 40]], ["fixed", 3, [20, 20, 20]], ["fixed", 3, [40, 40, 40]], ["fixed", 3, [40, 40, 40]]]);
  eq("which of them have a set time: the six, not the plank or a weighted exercise", SIX.concat(["plank", "hold_failure", "bench_db", "nope", null]).map(id => T.fixedTime(id)),
    [true, true, true, true, true, true, false, false, false, false, false]);
  eq("after a session at 40: still 40, Milo doesn't raise it", sug("leg_flutter", [G(O(5), "leg_flutter", [40, 40, 40], 0)]), ["fixed", 3, [40, 40, 40]]);
  eq("after sets cut short or run long: still 40", sug("leg_flutter", [G(O(5), "leg_flutter", [23, 40, 55], 0)]), ["fixed", 3, [40, 40, 40]]);
  eq("as many sets as last time", [sug("leg_flutter", [G(O(5), "leg_flutter", [40, 40], 0)]), sug("leg_flutter", [G(O(5), "leg_flutter", Array(14).fill(40), 0)])[1]], [["fixed", 2, [40, 40]], 10]);
  eq("after a long break: the same time", sug("leg_flutter", [G(new Date(2026, 5, 1, 12).getTime(), "leg_flutter", [40, 40, 40], 0)]), ["fixed", 3, [40, 40, 40]]);
  eq("the session it builds on is named", T.suggest("leg_flutter", [G(O(5), "leg_flutter", [40, 40, 40], 0, { id: "last" })], NOW).from.id, "last");
  eq("the sheet opens with last time's rows, each at the set time", T.planRows("leg_flutter", [G(O(5), "leg_flutter", [23, 40, 55], 0)], NOW).map(r => [r.reps, r.warm]), [[40, false], [40, false], [40, false]]);
  eq("the plank keeps its range: 60 the first time, then five seconds more", [sug("plank"), sug("plank", [G(O(5), "plank", [40, 40, 40], 0)])], [["first", 3, [60, 60, 60]], ["reps", 3, [45, 45, 45]]]);

  T.useExercises([{ id: "leg_flutter", inc: null, lo: 30, hi: 30, note: "", mts: 5 }, { id: "star_crunch", inc: null, lo: 15, hi: 15, note: "", mts: 5 }]);
  eq("a time of your own: 30 from the first set", [sug("leg_flutter"), sug("leg_flutter", [G(O(5), "leg_flutter", [40, 40, 40], 0)]), sug("star_crunch")],
    [["fixed", 3, [30, 30, 30]], ["fixed", 3, [30, 30, 30]], ["fixed", 3, [15, 15, 15]]]);
  eq("…and the others keep theirs", sug("bicycle"), ["fixed", 3, [40, 40, 40]]);
  T.useExercises([{ id: "leg_flutter", inc: null, lo: 30, hi: 50, note: "", mts: 6 }]);
  eq("a range of your own makes it build up again: 50 the first time, then five seconds more", [T.fixedTime("leg_flutter"), sug("leg_flutter"), sug("leg_flutter", [G(O(5), "leg_flutter", [40, 40, 40], 0)])],
    [false, ["first", 3, [50, 50, 50]], ["reps", 3, [45, 45, 45]]]);
  T.useExercises([{ id: "plank", inc: null, lo: 45, hi: 45, note: "", mts: 7 }, { id: "x_hollow", name: "Hollow hold", group: "abs", sec: [], equip: "bodyweight", load: "bw", timed: true, perHand: false, inc: 2.5, lo: 25, hi: 25, note: "", del: false, mts: 7 },
    { id: "bench_db", inc: null, lo: 10, hi: 10, note: "", mts: 7 }]);
  eq("any timed exercise given one number is done for that time: the plank, one of your own", [sug("plank", [G(O(5), "plank", [60, 50, 40], 0)]), sug("x_hollow")], [["fixed", 3, [45, 45, 45]], ["fixed", 3, [25, 25, 25]]]);
  eq("…but reps are never a set time: a weighted exercise with one number still goes up", T.suggest("bench_db", [G(O(5), "bench_db", [10, 10, 10], 20)], NOW).kind, "up");
  T.useExercises([]);
}

h.done(__filename);
