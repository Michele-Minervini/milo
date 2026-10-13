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

section("the first time: the abs circuit starts at 40 seconds, 20 a side");
{
  const first = id => { const sg = T.suggest(id, [], NOW); return [sg.kind, sg.sets, sg.targets]; };
  eq("each of the six", SIX.map(first), [["first", 3, [20, 20, 20]], ["first", 3, [40, 40, 40]], ["first", 3, [40, 40, 40]], ["first", 3, [20, 20, 20]], ["first", 3, [40, 40, 40]], ["first", 3, [40, 40, 40]]]);
  eq("the plank still starts at the top of its range", first("plank"), ["first", 3, [60, 60, 60]]);
  eq("after a session at 40: five seconds more", T.suggest("leg_flutter", [G(O(5), "leg_flutter", [40, 40, 40], 0)], NOW).targets, [45, 45, 45]);
  T.useExercises([{ id: "leg_flutter", lo: 45, hi: 50, mts: 5 }, { id: "star_crunch", lo: 5, hi: 15, mts: 5 }]);
  eq("a range of your own keeps the first time inside it", [first("leg_flutter")[2], first("star_crunch")[2]], [[45, 45, 45], [15, 15, 15]]);
  T.useExercises([]);
}

h.done(__filename);
