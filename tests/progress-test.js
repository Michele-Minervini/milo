/* Progress (training.js, P5): records, an exercise's chart, each muscle
   group's gym exercises, body weight and the chart axis — plus the weigh-in
   save decision (model.js, weighInWrite). All of it is derived from the log
   and nothing is stored, so what matters is that the same log always gives
   the same answer, on any device, in any order, in any time zone.
   tests/run.sh runs this in Europe/Rome and America/New_York.
   Run with: sh tests/run.sh   (or: node tests/progress-test.js) */

const h = require("./harness");
const { check, same, section } = h;

const page = h.load(["data.js", "model.js", "training.js"]);
const T = page.get("TRAINING"), M = page.get("MODEL");
const J = JSON.stringify;
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

// Local wall-clock time, month 1–12, noon unless given.
const L = (y, mo, d, hh = 12, mi = 0) => new Date(y, mo - 1, d, hh, mi).getTime();
const S = (d, hh, mi) => L(2026, 9, d, hh, mi);          // a day of September 2026 (d past 30 runs into October)
function eq(name, got, want) { check(name, same(got, want), "expected " + J(want) + "\n       got      " + J(got)); }

let n = 0;
// A gym entry. kg: one number for every set, or a list. extra: { id, warm }.
function G(ts, exId, sets, kg, extra) {
  n++;
  return Object.assign({ id: "g" + n, ts, kind: "gym", exId, sets, kg: Array.isArray(kg) ? kg : sets.map(() => kg || 0), note: "", mts: ts, warm: null }, extra || {});
}
// The squat pyramid: three warm-ups marked W, three build-up sets, one top set.
const pyr = (ts, top, reps, marked) => G(ts, "squat_bb", [15, 12, 9, 15, 12, 9, reps], [0, 0, 0, 9, 22.5, 31.5, top], { warm: marked === false ? null : [1, 1, 1, 0, 0, 0, 0] });
function W(ts, kg, waist, id) { n++; return { id: id || "w" + n, ts, kind: "body", kg, waist: waist === undefined ? null : waist, note: "", mts: ts }; }
// Records as short text: "09-11 5x45.75 kg".
const recs = log => T.records(log).map(r => r.day.slice(5) + " " + r.reps + "x" + r.kg + " " + r.by);
const shuffled = (list, seed) => {
  const a = list.slice(); let s = seed || 7;
  for (let i = a.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) % 2147483648; const k = s % (i + 1); [a[i], a[k]] = [a[k], a[i]]; }
  return a;
};

section("a record with weights: a heavier weight than ever, in a proper set");
{
  check("(squat aims for 5–8: a set counts from 3 reps)", T.recordFloor("squat_bb") === 3);
  check("(dumbbell bench 8–12: from 6; pull-ups 6–12: from 4; a plank and an unknown exercise: no floor)",
    T.recordFloor("bench_db") === 6 && T.recordFloor("pullup_std") === 4 && T.recordFloor("plank") === 0 && T.recordFloor("nobody") === 0);
  const days = [[1, 43.25, 5], [4, 43.25, 6], [8, 43.25, 8], [11, 45.75, 5], [15, 48.25, 4], [18, 48.25, 5]];
  const log = days.map(d => pyr(S(d[0]), d[1], d[2]));
  eq("a pyramid, day by day: only the days the top weight goes up", recs(log), ["09-11 5x45.75 kg", "09-15 4x48.25 kg"]);
  const r = T.records(log)[0];
  eq("…the record names the entry and the set that holds it", [r.exId, r.id, r.i, r.ts], ["squat_bb", log[3].id, 6, S(11)]);
  eq("the first day is what there is to beat, never a record", recs(log.slice(0, 1)), []);
  eq("more reps at the same weight is not a record (the chart shows those)", recs(log.slice(0, 3)), []);
  eq("the same days logged before the W marks existed: the same records", recs(days.map(d => pyr(S(d[0]), d[1], d[2], false))), ["09-11 5x45.75 kg", "09-15 4x48.25 kg"]);
  eq("a set marked W never counts, however heavy", recs([pyr(S(1), 40, 5), G(S(4), "squat_bb", [1, 6], [60, 40], { warm: [1, 0] })]), []);
  eq("…unmarked, the same set is the record", recs([pyr(S(1), 40, 5), G(S(4), "squat_bb", [3, 6], [60, 40], { warm: [0, 0] })]), ["09-04 3x60 kg"]);
  const two = [G(S(1), "squat_bb", [5], 40, { warm: [0] }), G(S(4), "squat_bb", [5], 40, { warm: [0] }), G(S(8), "squat_bb", [5, 5], 42.5, { warm: [0, 0] })];
  eq("the same set again leaves the mark where it was first made", T.standing(two.slice(0, 2), "squat_bb").w.ts, S(1));
  eq("two equal sets on a record day: the first holds the record", T.records(two)[0].i, 0);
  const idx = T.gymIndex([G(S(1, 7), "squat_bb", [5], 40, { warm: [0] }), G(S(1, 19), "squat_bb", [5], 40, { warm: [0] }), G(S(2), "squat_bb", [9], 20, { warm: [1] })]);
  eq("a session day carries its latest entry's time; a day of warm-ups only is not a session", [idx.byEx.squat_bb.days.length, idx.byEx.squat_bb.days[0].ts, idx.byEx.squat_bb.days[0].n], [1, S(1, 19), 2]);
}

section("the floor: two under the bottom of the range, the same for every set");
{
  eq("dumbbell bench 8–12 after a big step: the 7 reps the sheet asked for are a record that day",
    recs([G(S(1), "bench_db", [12, 12, 12], 16), G(S(4), "bench_db", [7, 6, 6], 18), G(S(8), "bench_db", [8, 7, 6], 18)]), ["09-04 7x18 kg"]);
  eq("under the floor: neither a record nor in the way of the next one",
    recs([G(S(1), "bench_db", [12], 16), G(S(4), "bench_db", [5, 5, 4], 18), G(S(8), "bench_db", [6], 18)]), ["09-08 6x18 kg"]);
  eq("a heavy single in an 8–12 exercise is never one",
    recs([G(S(1), "bench_db", [12], 16), G(S(4), "bench_db", [1], 30), G(S(8), "bench_db", [8], 18)]), ["09-08 8x18 kg"]);
  eq("the mark is set by the first day with a set that counts, not the first day logged",
    recs([G(S(1), "squat_bb", [2, 2], 60, { warm: [0, 0] }), G(S(4), "squat_bb", [5], 40, { warm: [0] }), G(S(8), "squat_bb", [5], 42.5, { warm: [0] })]), ["09-08 5x42.5 kg"]);
  eq("…nor by a day that was all warm-ups",
    recs([G(S(1), "squat_bb", [10], 20, { warm: [1] }), G(S(4), "squat_bb", [5], 40, { warm: [0] }), G(S(8), "squat_bb", [5], 42.5, { warm: [0] })]), ["09-08 5x42.5 kg"]);
  const press = [G(S(1), "leg_press", [12], 20), G(S(4), "leg_press", [8], 25), G(S(8), "leg_press", [8], 30)];
  eq("leg press 8–12: two records…", recs(press), ["09-04 8x25 kg", "09-08 8x30 kg"]);
  T.useExercises([{ id: "leg_press", lo: 12, hi: 15, inc: null, note: "", mts: 5 }]);
  eq("…and none once its range is 12–15 (records follow the range as it is now)", recs(press), []);
  eq("…the mark to beat is then the first day's 12 × 20 kg", [T.standing(press, "leg_press").show.kg, T.standing(press, "leg_press").show.reps], [20, 12]);
  T.useExercises([]);
  eq("on a record day with a heavier try under the floor, the record is the set that counts",
    T.records([G(S(1), "bench_db", [12], 16), G(S(4), "bench_db", [8, 4], [18, 20])]).map(r => [r.reps, r.kg, r.i]), [[8, 18, 0]]);
  T.useExercises([{ id: "squat_bb", lo: 2, hi: 5, inc: null, note: "", mts: 5 }]);
  eq("the floor never goes under 1 rep (a range starting at 2)", T.recordFloor("squat_bb"), 1);
  T.useExercises([{ id: "x_sled", name: "Sled", group: "legs", sec: [], equip: "other", lo: 8, hi: 12, inc: 5, perHand: false, load: "sled", timed: false, note: "", del: false, mts: 1 }]);
  eq("a kind of weight this version doesn't know: records by reps", recs([G(S(1), "x_sled", [8], 50), G(S(4), "x_sled", [9], 40)]), ["09-04 9x40 reps"]);
  T.useExercises([]);
  eq("an external weight logged as 0 kg is nothing to compare: the first weighted day sets the mark",
    recs([G(S(1), "fly_cable", [12, 10], 0), G(S(4), "fly_cable", [15, 12], 0), G(S(8), "fly_cable", [12, 12], 10), G(S(11), "fly_cable", [12], 12.5)]), ["09-11 12x12.5 kg"]);
}

section("without weight: more reps in one set than ever; a hold: the next 5 seconds");
{
  const am = G(S(12, 7), "pushup_std", [14], 0), pm = G(S(12, 19), "pushup_std", [16, 12], 0);
  const log = [G(S(1), "pushup_std", [12, 11, 10], 0), G(S(4), "pushup_std", [13, 11, 10], 0), G(S(8), "pushup_std", [13, 13, 12], 0), G(S(10), "pushup_std", [15, 14], 0), am, pm];
  eq("push-ups: only when the best single set improves", recs(log), ["09-04 13x0 reps", "09-10 15x0 reps", "09-12 16x0 reps"]);
  eq("…two entries on one day are one session; the record points at the one that holds the set", [T.records(log)[2].id, T.records(log)[2].i], [pm.id, 0]);
  eq("…and the other row of that day is not marked", [!!T.gymIndex(log).byEntry[am.id], !!T.gymIndex(log).byEntry[pm.id]], [false, true]);
  const plank = [[30, 25], [35, 30], [35, 35], [40, 35], [42], [44], [45], [60, 60]].map((s, i) => G(S(1 + i), "plank", s, 0));
  eq("a plank: 35, 40, 45 and 60 seconds; 42 and 44 after 40 are not (holds count in steps of 5)", recs(plank), ["09-02 35x0 reps", "09-04 40x0 reps", "09-07 45x0 reps", "09-08 60x0 reps"]);
  eq("…the mark still shows the true longest hold", T.standing(plank.slice(0, 6), "plank").show.reps, 44);
  eq("23:30 and 00:30 are two days: a record on the second", recs([G(S(3, 23, 30), "leg_lift", [10], 0), G(S(4, 0, 30), "leg_lift", [11], 0)]), ["09-04 11x0 reps"]);
  eq("07:00 and 23:30 are one: its best set, once", recs([G(S(1), "leg_lift", [9], 0), G(S(3, 7), "leg_lift", [10], 0), G(S(3, 23, 30), "leg_lift", [11], 0)]), ["09-03 11x0 reps"]);
}

section("added weight (pull-ups, dips): more weight; with none on, more reps");
{
  const log = [
    G(S(1), "pullup_std", [8, 7, 6], 0), G(S(3), "pullup_std", [9], 0), G(S(5), "pullup_std", [10], 0), G(S(8), "pullup_std", [12], 0),
    G(S(10), "pullup_std", [6, 6, 5], 2.5), G(S(12), "pullup_std", [7], 2.5), G(S(15), "pullup_std", [8, 7, 13], [2.5, 2.5, 0]),
    G(S(17), "pullup_std", [6], 5), G(S(19), "pullup_std", [13], 5), G(S(21), "pullup_std", [13], 0), G(S(22), "pullup_std", [14], 0)
  ];
  eq("reps while at bodyweight, then each new weight; never more reps at the same weight",
    recs(log), ["09-03 9x0 reps", "09-05 10x0 reps", "09-08 12x0 reps", "09-10 6x2.5 kg", "09-15 13x0 reps", "09-17 6x5 kg", "09-22 14x0 reps"]);
  check("…(19 and 21 Sep have no record)", !recs(log).some(r => /^09-(19|21)/.test(r)));
  eq("13 reps with 5 kg on blocks a later 13 without; 14 beats it",
    recs([G(S(1), "pullup_std", [12], 0), G(S(4), "pullup_std", [13], 5), G(S(8), "pullup_std", [13], 0), G(S(11), "pullup_std", [14], 0)]), ["09-04 13x5 kg", "09-11 14x0 reps"]);
  eq("a first set without weight is a record when it beats every weighted set before it",
    recs([G(S(1), "pullup_std", [6], 5), G(S(4), "pullup_std", [7], 0)]), ["09-04 7x0 reps"]);
  eq("bodyweight sets under the floor don't set the weight mark: the first weighted day then sets it, silently",
    recs([G(S(1), "pullup_std", [3, 2], 0), G(S(4), "pullup_std", [5], 2.5)]), []);
  const st = T.standing(log, "pullup_std");
  eq("the marks: the heaviest set, and the most reps with no weight on", [st.w.kg, st.w.reps, st.r.reps, st.show.kg], [5, 13, 14, 5]);
  eq("a first weighted day is a record when bodyweight sets came before it…", recs([G(S(1), "pullup_std", [8], 0), G(S(4), "pullup_std", [3], 2.5), G(S(8), "pullup_std", [4], 2.5)]), ["09-08 4x2.5 kg"]);
  eq("…a beginner under the range still gets reps records", recs([G(S(1), "pullup_std", [3, 2, 2], 0), G(S(4), "pullup_std", [4, 3], 0), G(S(8), "pullup_std", [5, 3], 0)]), ["09-04 4x0 reps", "09-08 5x0 reps"]);
  eq("one day, both kinds: the weight record is the day's", recs([G(S(1), "dips", [8], 0), G(S(4), "dips", [9, 8], [0, 5])]), ["09-04 8x5 kg"]);
}

section("an assisted machine: less help; then the first rep with none");
{
  const log = [[1, [10], 40], [3, [12], 40], [5, [6, 6], 35], [8, [7], 35], [10, [8], 35], [12, [6], 30], [15, [1], 0], [17, [2], 0], [19, [12], 20]]
    .map(d => G(S(d[0]), "pullup_assist", d[1], d[2]));
  eq("(the retired assisted pull-up still resolves: old sessions keep their records)", T.exercise("pullup_assist").retired, true);
  eq("less help is a record; more reps with the same help isn't; unassisted reps count from the first",
    recs(log), ["09-05 6x35 kg", "09-12 6x30 kg", "09-15 1x0 reps", "09-17 2x0 reps"]);
  eq("a helped set under the floor doesn't count", recs([G(S(1), "pullup_assist", [8], 40), G(S(4), "pullup_assist", [5], 35), G(S(8), "pullup_assist", [6], 35)]), ["09-08 6x35 kg"]);
  eq("on its chart every record day is marked, the first day with no help too",
    T.trend([G(S(1), "pullup_assist", [8], 40), G(S(4), "pullup_assist", [8], 30), G(S(8), "pullup_assist", [3], 0), G(S(11), "pullup_assist", [4], 0)], "pullup_assist").points.map(p => [p.value, p.record]),
    [[40, false], [30, true], [0, true], [0, true]]);
}

section("records are worked out from the log every time");
{
  const base = [G(S(1), "squat_bb", [5], 40, { warm: [0] }), G(S(8), "squat_bb", [5], 42.5, { warm: [0] }), G(S(15), "squat_bb", [5], 45, { warm: [0] })];
  eq("three sessions: two records", recs(base), ["09-08 5x42.5 kg", "09-15 5x45 kg"]);
  eq("a forgotten heavier session logged for an earlier day takes them over", recs(base.concat([G(S(5), "squat_bb", [5], 45, { warm: [0] })])), ["09-05 5x45 kg"]);
  const am = G(S(8, 7), "squat_bb", [5], 45, { warm: [0], id: "am" }), pm = G(S(8, 19), "squat_bb", [8], 42.5, { warm: [0], id: "pm" });
  eq("two entries on one day, the record in the earlier: its id, not the later one's", T.records([base[0], am, pm]).map(r => r.id), ["am"]);
  const many = [];
  ["squat_bb", "bench_db", "pullup_std", "pushup_std", "plank", "leg_press"].forEach((id, k) => {
    for (let i = 0; i < 12; i++) many.push(G(S(1 + i * 2, 7 + k), id, [8 + (i % 4), 8, 6 + (i % 3)], id === "pushup_std" || id === "plank" ? 0 : 20 + 2.5 * Math.floor(i / 3)));
  });
  check("the same log in any order gives the same records", J(T.records(many)) === J(T.records(many.slice().reverse())) && J(T.records(many)) === J(T.records(shuffled(many))));
  // The very same instant: entries of one exercise go by id, records of two exercises by exercise id.
  const same1 = [G(S(1), "leg_lift", [10], 0), G(S(4), "leg_lift", [11], 0, { id: "b" }), G(S(4), "leg_lift", [11], 0, { id: "a" }),
    G(S(1), "plank", [30], 0), G(S(4), "plank", [40], 0), G(S(1), "bench_db", [8], 20), G(S(4), "bench_db", [8], 22)];
  eq("entries at the very same instant: the same answer whichever comes first in the log",
    [T.records(same1).map(r => r.exId + ":" + r.id), J(T.records(same1)) === J(T.records(same1.slice().reverse()))], [["bench_db:" + same1[6].id, "leg_lift:a", "plank:" + same1[4].id], true]);
  check("…and they come oldest first", T.records(many).every((r, i, a) => !i || a[i - 1].ts <= r.ts) && T.records(many).length > 6);
  check("records(log) is the index's list: an index can be handed in instead of the log", J(T.records(T.gymIndex(many))) === J(T.records(many)));
  eq("an exercise nobody knows has no records and no place in the index",
    [recs([G(S(1), "gone_ex", [8], 20), G(S(4), "gone_ex", [8], 40)]), Object.keys(T.gymIndex([G(S(1), "gone_ex", [8], 20)]).byEx)], [[], []]);
  const odd = [G(S(1), "bench_db", [8], 20, { id: "constructor" }), G(S(4), "bench_db", [8], 22, { id: "__proto__" }), G(S(8), "bench_db", [8], 22, { id: "toString" })];
  const byEntry = T.gymIndex(odd).byEntry;
  eq("entry ids like \"constructor\" and \"__proto__\": only the one that holds a record is marked", ["constructor", "__proto__", "toString"].map(id => !!byEntry[id]), [false, true, false]);
  T.useExercises([{ id: "x_ring", name: "Ring rows", group: "back", sec: [], equip: "other", lo: 8, hi: 12, inc: 2.5, perHand: false, load: "ext", timed: false, note: "", del: true, mts: 5 }]);
  eq("one of your own, removed from the list: its sessions keep their records", recs([G(S(1), "x_ring", [10], 10), G(S(4), "x_ring", [8], 15)]), ["09-04 8x15 kg"]);
  T.useExercises([]);
}

section("the mark to beat, as the gym sheet asks for it");
{
  const log = [pyr(S(1), 43.25, 5), pyr(S(4), 43.25, 8), pyr(S(11), 45.75, 5)];
  eq("before the first session: nothing", T.standing(log, "squat_bb", S(1)), { w: null, r: null, show: null });
  eq("on the second day: the first day's top set", [T.standing(log, "squat_bb", S(4, 23)).show.kg, T.standing(log, "squat_bb", S(4, 23)).show.reps], [43.25, 5]);
  eq("on the third: the most reps done at that weight since", [T.standing(log, "squat_bb", S(11, 0, 5)).show.kg, T.standing(log, "squat_bb", S(11, 0, 5)).show.reps], [43.25, 8]);
  eq("now: the new top weight, with the day it was lifted", [T.standing(log, "squat_bb").show.kg, T.standing(log, "squat_bb").show.ts], [45.75, S(11)]);
  eq("an exercise never logged, or nobody knows: nothing", [T.standing(log, "bench_db"), T.standing(log, "constructor")], [{ w: null, r: null, show: null }, { w: null, r: null, show: null }]);
  eq("bodyweight pull-ups: the reps mark is the one to show", T.standing([G(S(1), "pullup_std", [8, 7], 0)], "pullup_std").show.reps, 8);
  const pu = [G(S(1), "pushup_std", [12], 0), G(S(4), "pushup_std", [13], 0)];
  eq("the reps mark before a day, at midnight of it, and before a time that isn't one",
    [T.standing(pu, "pushup_std", S(4)).r.reps, T.standing(pu, "pushup_std", S(4, 0)).r.reps, T.standing(pu, "pushup_std", S(5, 0)).r.reps, T.standing(pu, "pushup_std", "soon")], [12, 12, 13, { w: null, r: null, show: null }]);
}

section("records in the last 30 days");
{
  const now = L(2026, 10, 8, 9);
  const log = [];
  [40, 30, 29, 1, 0, -1].forEach((ago, i) => {
    const day = M.addDays(M.startOfDay(now), -ago).getTime() + 13 * 3600000;
    log.push(G(day - 86400000 * 400, "x", [1], 0));   // unknown: ignored
    log.push(G(day, ["squat_bb", "bench_db", "leg_press", "deadlift", "ohp_bb", "row_bb"][i], [8], 50));
  });
  // Each exercise needs an earlier day to beat.
  const base = ["squat_bb", "bench_db", "leg_press", "deadlift", "ohp_bb", "row_bb"].map(id => G(L(2026, 7, 1), id, [8], 40));
  const all = base.concat(log);
  eq("(six records, one per exercise)", T.records(all).length, 6);
  eq("29 days ago and today are in; 30 days ago and tomorrow are not", T.recordsIn(all, now).map(r => r.exId).sort(), ["deadlift", "leg_press", "ohp_bb"]);
  eq("another number of days (a fraction is rounded)", [T.recordsIn(all, now, 2).length, T.recordsIn(all, now, 2.4).length, T.recordsIn(all, now, 29.6).length], [2, 2, 3]);
  eq("a time that isn't one, or no days: none", [T.recordsIn(all, NaN), T.recordsIn(all, now, 0)], [[], []]);
}

section("an exercise's chart");
{
  const days = [[1, 43.25, 5], [4, 43.25, 6], [8, 43.25, 8], [11, 45.75, 5]];
  const tr = T.trend(days.map(d => pyr(S(d[0]), d[1], d[2])), "squat_bb");
  eq("a barbell lift: the day's best estimated 1-rep max, from the top set", [tr.kind, tr.points.map(p => Math.round(p.value * 100) / 100)], ["e1rm", [50.46, 51.9, 54.78, 53.38]]);
  eq("…it dips on the day the weight goes up, and that day carries the mark", tr.points.map(p => p.record), [false, false, false, true]);
  eq("…each point says which set it comes from", [tr.points[3].kg, tr.points[3].reps, tr.points[3].ts], [45.75, 5, S(11)]);
  const calf = [G(S(1), "calf_raise", [20, 18], 60), G(S(4), "calf_raise", [12], 65)];
  eq("a range above 15 reps (calf raise 10–20): the top weight, not an estimate", [T.trend(calf, "calf_raise").kind, T.trend(calf, "calf_raise").points.map(p => p.value)], ["kg", [60, 65]]);
  const pull = [G(S(1), "pullup_std", [8], 0), G(S(4), "pullup_std", [10], 0)];
  eq("pull-ups at bodyweight: most reps", [T.trend(pull, "pullup_std").kind, T.trend(pull, "pullup_std").points.map(p => p.value)], ["reps", [8, 10]]);
  const pull2 = pull.concat([G(S(8), "pullup_std", [6], 2.5), G(S(11), "pullup_std", [7], 2.5), G(S(15), "pullup_std", [11], 0)]);
  eq("…once weight is on: the added weight, 0 for a bodyweight day", [T.trend(pull2, "pullup_std").kind, T.trend(pull2, "pullup_std").points.map(p => p.value)], ["kg", [0, 0, 2.5, 2.5, 0]]);
  eq("…the kind is decided on the days shown: the last two alone are weight days, the first two reps days",
    [T.trend(pull2.slice(0, 2), "pullup_std", 2).kind, T.trend(pull2, "pullup_std", 2).kind], ["reps", "kg"]);
  eq("…a reps record isn't marked on a weight chart", T.trend(pull2, "pullup_std").points.map(p => p.record), [false, false, true, false, false]);
  eq("a plank: seconds", T.trend([G(S(1), "plank", [30, 25], 0), G(S(4), "plank", [45], 0)], "plank"), { kind: "secs", points: [
    { day: "2026-09-01", ts: S(1), value: 30, kg: 0, reps: 30, record: false }, { day: "2026-09-04", ts: S(4), value: 45, kg: 0, reps: 45, record: true }] });
  eq("an assisted machine: the least help of the day", T.trend([G(S(1), "pullup_assist", [8, 8], [40, 35]), G(S(4), "pullup_assist", [8], 30)], "pullup_assist").points.map(p => p.value), [35, 30]);
  const mixed = [G(S(1), "fly_cable", [12], 0), G(S(4), "fly_cable", [12], 10), G(S(8), "fly_cable", [15], 0), G(S(11), "fly_cable", [12], 12.5)];
  eq("days without a weighted set are left out of a weight chart", T.trend(mixed, "fly_cable").points.map(p => p.day.slice(5)), ["09-04", "09-11"]);
  const long = [];
  for (let i = 0; i < 30; i++) long.push(G(S(1 + i), "bench_db", [8], 16 + i));
  eq("the last 20 sessions unless asked otherwise", [T.trend(long, "bench_db").points.length, T.trend(long, "bench_db").points[0].kg, T.trend(long, "bench_db", 5).points.length], [20, 26, 5]);
  eq("never logged, or nobody knows: nothing to draw", [T.trend(long, "squat_bb"), T.trend(long, "__proto__"), T.trend(null, "bench_db")], [{ kind: null, points: [] }, { kind: null, points: [] }, { kind: null, points: [] }]);
}

section("each muscle group's gym exercises, the main one first");
{
  const now = L(2026, 10, 8, 9), log = [];
  [14, 21, 28].forEach(d => {
    log.push(pyr(S(d, 18), 43.25, 5), G(S(d, 18, 20), "leg_press", [12, 11, 10], 80), G(S(d, 18, 40), "leg_curl", [12, 12, 10], 30));
    log.push(G(S(d + 1, 18), "bench_db", [10, 9, 8], 20), G(S(d + 1, 18, 20), "incline_db", [10, 9, 8], 16),
      G(S(d + 1, 18, 40), "pushup_std", [15, 12], 0), G(S(d + 1, 19), "plank", [40, 35], 0), G(S(d + 1, 19, 20), "leg_lift", [12, 10], 0));
  });
  log.push(G(L(2026, 7, 1), "deadlift", [5, 5], 80));
  const lf = T.lifts(log, now);
  eq("all six groups, always", Object.keys(lf), M.GROUPS);
  eq("legs: the same days for all three, so the heavier movement first (squat 5–8, press 8–12, curl 10–15)", lf.legs.map(l => l.exId), ["squat_bb", "leg_press", "leg_curl"]);
  eq("…with its session days, counted sets, and the top set of its latest session", [lf.legs[0].days, lf.legs[0].sets, lf.legs[0].kg, lf.legs[0].reps, lf.legs[0].day, lf.legs[0].record], [3, 12, 43.25, 5, "2026-09-28", false]);
  eq("chest: a full tie between the two dumbbell presses goes to the catalogue's order; push-ups (no weight) after", lf.chest.map(l => l.exId), ["bench_db", "incline_db", "pushup_std"]);
  eq("abs: plank and leg lifts tie; seconds aren't reps, so the catalogue's order decides", lf.abs.map(l => l.exId), ["plank", "leg_lift"]);
  eq("back: the deadlift of 1 July is more than 8 weeks ago", lf.back, []);
  const edge = ago => T.lifts([G(M.addDays(M.startOfDay(now), -ago).getTime() + 3600000, "deadlift", [5], 80)], now).back.length;
  eq("55 days ago is in, 56 is out, tomorrow doesn't count", [edge(55), edge(56), edge(-1)], [1, 0, 0]);
  const more = log.concat([G(S(30, 18), "leg_press", [12], 80), G(L(2026, 10, 2, 18), "leg_press", [12], 85)]);
  eq("more session days beats the lower range", T.lifts(more, now).legs.map(l => l.exId)[0], "leg_press");
  eq("…and that latest session set a record", T.lifts(more, now).legs[0].record, true);
  const bench = T.lifts([G(S(21), "bench_db", [12, 12], 16), G(S(24), "bench_db", [8, 8, 4], [18, 18, 20])], now).chest[0];
  eq("on a record day the set shown is the record, not a heavier try under the floor", [bench.kg, bench.reps, bench.record], [18, 8, true]);
  const pull = T.lifts([G(S(21), "pullup_std", [6, 6, 10], [2.5, 2.5, 0]), G(S(24), "pullup_std", [6, 6, 12], [2.5, 2.5, 0])], now).back[0];
  eq("…nor the weighted set of a day whose record was reps without weight", [pull.kg, pull.reps, pull.record], [0, 12, true]);
  eq("a time no calendar holds: six empty lists", T.lifts(log, -8.64e15).legs, []);
  eq("a time that isn't one: six empty lists", T.lifts(log, "soon"), { chest: [], back: [], shoulders: [], arms: [], abs: [], legs: [] });
}

section("progress this week: which exercises got harder");
{
  const now = L(2026, 10, 8, 20);      // a Thursday; the week began Monday 5 October
  const O = (d, hh) => L(2026, 10, d, hh || 12);
  const st = (log, g, t) => T.progress(log, t || now)[g || "chest"].list.map(x => x.exId + " " + x.status);
  const one = (before, after) => st([G(S(29), "bench_db", before[0], before[1]), G(O(6), "bench_db", after[0], after[1])])[0].split(" ")[1];
  eq("a heavier top weight is up, whatever the reps", one([[12, 12, 12], 16], [[7, 6, 6], 18]), "up");
  eq("the same weight with more reps on the same sets is up", one([[8, 8, 7], 20], [[9, 8, 8], 20]), "up");
  eq("…the same reps is the same", one([[8, 8, 7], 20], [[8, 7, 8], 20]), "same");
  eq("…fewer is down", one([[10, 10, 9], 16], [[10, 9, 9], 16]), "down");
  eq("a lighter top weight is down, even for more reps", one([[8, 8, 8], 20], [[12, 12, 12], 18]), "down");
  eq("one set fewer changes nothing by itself: set against set from the best down", [one([[8, 8, 7], 20], [[8, 8], 20]), one([[8, 8, 7], 20], [[9, 9], 20]), one([[8, 8], 20], [[8, 8, 8], 20])], ["same", "up", "same"]);
  eq("a pyramid goes by its top set: the build-up sets don't matter", st([pyr(S(28), 43.25, 5), pyr(O(5), 45.75, 5)], "legs"), ["squat_bb up"]);
  eq("…and by the reps at the top when the weight is the same", st([pyr(S(28), 43.25, 5), pyr(O(5), 43.25, 6)], "legs"), ["squat_bb up"]);
  eq("warm-ups never count: a heavy set marked W is not the top weight", st([G(S(28), "squat_bb", [5], 40, { warm: [0] }), G(O(5), "squat_bb", [1, 5], [60, 40], { warm: [1, 0] })], "legs"), ["squat_bb same"]);
  eq("push-ups and planks go by reps and seconds", [st([G(S(30), "pushup_std", [15, 12], 0), G(O(7), "pushup_std", [16, 12], 0)]), st([G(S(30), "plank", [40, 35], 0), G(O(7), "plank", [40, 30], 0)], "abs")],
    [["pushup_std up"], ["plank down"]]);
  eq("added weight: weight first, then reps; bodyweight after weighted is down", [st([G(S(30), "pullup_std", [8], 0), G(O(7), "pullup_std", [5], 2.5)], "back"),
    st([G(S(30), "pullup_std", [5], 2.5), G(O(7), "pullup_std", [12], 0)], "back")], [["pullup_std up"], ["pullup_std down"]]);
  eq("an assisted machine: less help is up", st([G(S(30), "pullup_assist", [8], 30), G(O(7), "pullup_assist", [6], 25)], "back"), ["pullup_assist up"]);

  const log = [
    G(S(29), "bench_db", [8, 8, 7], 20), G(O(6), "bench_db", [9, 8, 8], 20),
    G(S(29, 13), "incline_db", [10, 10, 9], 16), G(O(6, 13), "incline_db", [10, 9, 9], 16),
    G(S(30), "pushup_std", [15, 12], 0), G(O(7), "pushup_std", [15, 12], 0),
    G(O(7, 13), "fly_cable", [12, 12], 10),
    G(L(2026, 7, 1), "chest_press", [10], 40), G(O(7, 15), "chest_press", [10], 35),
    G(S(28), "squat_bb", [15, 12, 9, 5], [9, 22.5, 31.5, 43.25], { warm: [0, 0, 0, 0] })
  ];
  const p = T.progress(log, now);
  eq("a week of chest: one up, one same, one down, a new exercise and one back after a long break", st(log), ["bench_db up", "incline_db down", "pushup_std same", "fly_cable new", "chest_press back"]);
  eq("…counted", [p.chest.up, p.chest.same, p.chest.down, p.chest.fresh], [1, 1, 1, 2]);
  eq("…each row carries this week's top sets and the session it is set against",
    [p.chest.list[0].kg, p.chest.list[0].reps, p.chest.list[0].prev, p.chest.list[3].prev], [20, [9, 8, 8], { ts: S(29), kg: 20, reps: [8, 8, 7] }, null]);
  eq("kilos lifted: kg × reps over the weighted sets, a weight per hand twice; push-ups add nothing",
    [p.chest.kg, p.chest.kgBefore], [20 * 25 * 2 + 16 * 28 * 2 + 10 * 24 + 35 * 10, 20 * 23 * 2 + 16 * 29 * 2]);
  eq("legs: nothing this week, so nothing to list — but last week's kilos are there", [p.legs.list, p.legs.kg, p.legs.kgBefore], [[], 0, 9 * 15 + 22.5 * 12 + 31.5 * 9 + 43.25 * 5]);
  eq("all six groups, always", Object.keys(p), M.GROUPS);
  eq("it is this week against before this week: a second session this week is the one that counts",
    st([G(S(29), "bench_db", [8], 20), G(O(5), "bench_db", [10], 20), G(O(7), "bench_db", [9], 20)]), ["bench_db up"]);
  eq("…and a session later than today is left out", st([G(S(29), "bench_db", [8], 20), G(O(6), "bench_db", [9], 20), G(O(9), "bench_db", [5], 20)]), ["bench_db up"]);
  eq("last Sunday 23:30 is last week, Monday 00:30 this week", [st([G(L(2026, 10, 4, 23, 30), "bench_db", [8], 20)]), st([G(S(29), "bench_db", [8], 20), G(L(2026, 10, 5, 0, 30), "bench_db", [9], 20)])], [[], ["bench_db up"]]);
  eq("42 days back is still compared, 43 is a break", [st([G(M.addDays(M.startOfDay(O(6)), -42).getTime() + 3600000, "bench_db", [8], 30), G(O(6), "bench_db", [8], 20)]),
    st([G(M.addDays(M.startOfDay(O(6)), -43).getTime() + 3600000, "bench_db", [8], 30), G(O(6), "bench_db", [8], 20)])], [["bench_db down"], ["bench_db back"]]);
  eq("an exercise nobody knows, or a time that isn't one: nothing", [T.progress([G(O(6), "gone_ex", [8], 20)], now).chest.list, T.progress(log, "soon").chest], [[], { up: 0, same: 0, down: 0, fresh: 0, kg: 0, kgBefore: 0, list: [] }]);
  check("the same log in any order gives the same answer", J(T.progress(log, now)) === J(T.progress(shuffled(log), now)) && J(T.progress(T.gymIndex(log), now)) === J(p));
}

section("a muscle group's strength over the weeks");
{
  const now = L(2026, 10, 8, 20);
  const wk = k => M.addDays(new Date(T.weekStart(now)), -7 * k).getTime() + 36 * 3600000;      // Tuesday noon, k weeks back
  // Bench 40 kg × 8, 9, 10 over three weeks, then 42.5 × 8: the estimate goes 50.67, 52, 53.33, 53.83.
  const bench = [G(wk(3), "bench_bb", [8], 40), G(wk(2), "bench_bb", [9], 40), G(wk(1), "bench_bb", [10], 40), G(wk(0), "bench_bb", [8], 42.5)];
  const s4 = T.strength(bench, "chest", now, 4);
  eq("one row a week, oldest first, this week last", [s4.length, s4.map(w => w.start), s4.map(w => w.n)], [4, [3, 2, 1, 0].map(k => T.addWeeks(now, -k)), [0, 1, 1, 1]]);
  eq("each week is the change against the session before that week", s4.map(w => w.change === null ? null : Math.round(w.change * 10000) / 100), [null, 2.63, 2.56, 0.94]);
  eq("…and the index starts at 100 and carries them forward", s4.map(w => Math.round(w.index * 100) / 100), [100, 102.63, 105.26, 106.25]);
  const push = [G(wk(2), "pushup_std", [10], 0), G(wk(1), "pushup_std", [11], 0), G(wk(0), "pushup_std", [11], 0)];
  eq("bodyweight exercises count by reps", T.strength(push, "chest", now, 3).map(w => w.change === null ? null : Math.round(w.change * 1000) / 10), [null, 10, 0]);
  eq("the group's week is the average of its exercises, each against itself (bench +0.94 %, push-ups 0 %)",
    Math.round(T.strength(bench.concat(push), "chest", now, 1)[0].change * 10000) / 100, 0.47);
  eq("one exercise can't move a week by more than a quarter (a first weeks' jump from 20 to 40 kg)",
    T.strength([G(wk(1), "bench_bb", [8], 20), G(wk(0), "bench_bb", [8], 40)], "chest", now, 1)[0].change, 0.25);
  eq("…nor pull it down by more than a fifth", Math.round(T.strength([G(wk(1), "bench_bb", [8], 40), G(wk(0), "bench_bb", [8], 20)], "chest", now, 1)[0].change * 100) / 100, -0.2);
  eq("added weight is only compared at the same weight: a week that changes it has nothing to measure",
    [T.strength([G(wk(1), "pullup_std", [6], 2.5), G(wk(0), "pullup_std", [8], 2.5)], "back", now, 1)[0].n, T.strength([G(wk(1), "pullup_std", [8], 0), G(wk(0), "pullup_std", [5], 2.5)], "back", now, 1)[0]],
    [1, { start: T.weekStart(now), n: 0, change: null, index: 100 }]);
  eq("after a break of more than 6 weeks there is nothing to compare", T.strength([G(wk(8), "bench_bb", [8], 40), G(wk(0), "bench_bb", [8], 30)], "chest", now, 1)[0].n, 0);
  eq("8 weeks unless asked; a group or a time that isn't one: nothing", [T.strength(bench, "chest", now).length, T.strength(bench, "glutes", now), T.strength(bench, "chest", NaN)], [8, [], []]);
  check("the same log in any order gives the same line", J(T.strength(bench.concat(push), "chest", now)) === J(T.strength(shuffled(bench.concat(push)), "chest", now)));
}

section("body weight: one value a day, everything hung on the latest weigh-in");
{
  const now = L(2026, 10, 8, 9);
  const weekly = [W(S(7), 73.6, 84), W(S(14), 73.2), W(S(21), 72.9), W(S(28), 72.8), W(L(2026, 10, 5), 72.4, 82.5)];
  const b = T.bodyWeight(weekly, now);
  eq("a weigh-in a week: the latest, the one before, and the change between them", [b.count, b.last.kg, b.prev.kg, b.change, b.daysSince], [5, 72.4, 72.8, -0.4, 3]);
  eq("…about a month: against the weigh-in 28 days before the latest, with its day", b.month, { change: -1.2, ts: S(7), avg: false });
  eq("…one weigh-in in the week is not an average", [b.avg7, b.sinceFirst], [null, null]);
  eq("…waist: the latest against the oldest of the 12 weeks before it", b.waist, { last: { cm: 82.5, ts: L(2026, 10, 5) }, ref: { cm: 84, ts: S(7) }, change: -1.5 });
  eq("…the chart runs from the first weigh-in to today", [b.chart.days, b.chart.from, b.chart.points.length, b.chart.split], [32, L(2026, 9, 7, 0), 5, false]);
  eq("…each point is its own average when there is one a week", b.chart.points.map(p => [p.kg, p.avg, p.n]), [[73.6, 73.6, 1], [73.2, 73.2, 1], [72.9, 72.9, 1], [72.8, 72.8, 1], [72.4, 72.4, 1]]);
  check("nothing changes on a day you didn't weigh yourself (only how long ago it was, and where the chart ends)", [9, 10, 11].every(d => {
    const x = T.bodyWeight(weekly, L(2026, 10, d, 9));
    return J([x.last, x.prev, x.change, x.month, x.avg7, x.waist]) === J([b.last, b.prev, b.change, b.month, b.avg7, b.waist]) && x.daysSince === d - 5;
  }));

  const every = gap => [0, 1, 2, 3, 4].map(k => W(M.addDays(new Date(L(2026, 10, 5)), -gap * k).getTime(), 72 + k * 0.5));
  eq("every 8 days: 24 and 32 days back are equally near 28, the earlier wins", T.bodyWeight(every(8), now).month, { change: -2, ts: M.addDays(new Date(L(2026, 10, 5)), -32).getTime(), avg: false });
  eq("every 9 days: the weigh-in 27 days back", T.bodyWeight(every(9), now).month, { change: -1.5, ts: M.addDays(new Date(L(2026, 10, 5)), -27).getTime(), avg: false });
  // A weekly weigher who once weighs on Sunday instead of Monday: two readings
  // in one week are not an average, so every number can be checked by eye.
  const slip = T.bodyWeight([W(L(2026, 8, 31), 74), W(S(7), 73.6), W(S(14), 73.2), W(S(21), 73), W(S(28), 73), W(L(2026, 10, 4), 72)], now);
  eq("two weigh-ins in one week are not an average: the month is reading against reading, the chart is the dots",
    [slip.change, slip.month, slip.avg7, slip.chart.split, slip.chart.points[slip.chart.points.length - 1]],
    [-1, { change: -1.6, ts: S(7), avg: false }, null, false, { ts: L(2026, 10, 4), kg: 72, avg: 72, n: 1 }]);

  const one = T.bodyWeight([W(L(2026, 10, 5), 72.4)], now);
  eq("one weigh-in: the number, nothing to compare, a 4-week window", [one.count, one.prev, one.change, one.month, one.sinceFirst, one.chart.days, one.chart.points.length], [1, null, null, null, null, 28, 1]);
  const two = T.bodyWeight([W(L(2026, 10, 1), 72.8), W(now, 72.4)], now);
  eq("two, a week apart: the change, and both in the 4-week window", [two.change, two.sinceFirst, two.chart.days, two.chart.points.length], [-0.4, null, 28, 2]);
  const three = T.bodyWeight([W(S(24), 73), W(L(2026, 10, 1), 72.8), W(now, 72.4)], now);
  eq("a third, two weeks after the first: since your first weigh-in (until there is a month to compare)", [three.month, three.sinceFirst], [null, { change: -0.6, ts: S(24) }]);

  const daily = [];
  for (let k = 9; k >= 0; k--) daily.push(W(M.addDays(new Date(L(2026, 10, 8, 7)), -k).getTime(), 72 + (k % 3) * 0.1));
  const dd = T.bodyWeight(daily, now);
  eq("every morning: a 7-day average, over the 7 days up to the latest", [dd.avg7.n, dd.avg7.kg, dd.chart.split], [7, 72.1, true]);
  const month = [];
  for (let k = 34; k >= 0; k--) month.push(W(M.addDays(new Date(L(2026, 10, 8, 7)), -k).getTime(), 72 + k * 0.1));
  eq("…and then the month compares averages, and says so", [T.bodyWeight(month, now).month.avg, T.bodyWeight(month, now).month.change], [true, -2.8]);
  eq("…it needs 3 days in the week: 2 are not an average", [T.bodyWeight(daily.slice(-2), now).avg7, T.bodyWeight(daily.slice(-3), now).avg7.n], [null, 3]);

  const twice = [W(S(28), 72.8), W(L(2026, 10, 5, 7), 72.4, undefined, "early"), W(L(2026, 10, 5, 20), 72.6, undefined, "late")];
  eq("two weigh-ins on one day (two devices can each save one): the later is the day's", [T.bodyWeight(twice, now).last.id, T.bodyWeight(twice, now).last.kg, T.bodyWeight(twice, now).count], ["late", 72.6, 2]);
  eq("…in any order", T.bodyWeight(twice.slice().reverse(), now).last.id, "late");
  eq("…and the one before is the previous DAY, never the same day's other entry", T.bodyWeight(twice, now).prev.kg, 72.8);
  const tie = [W(now - 1000, 70, undefined, "a"), W(now - 1000, 71, undefined, "b")];
  eq("at the very same time: the later id, either way round", [T.bodyWeight(tie, now).last.id, T.bodyWeight(tie.slice().reverse(), now).last.id], ["b", "b"]);
  eq("72.4 − 72.8 is exactly −0.4, and 72.3, 72.4, 72.3, 72.4 average 72.4 (72.35: halves round up)",
    [T.bodyWeight([W(S(28), 72.8), W(L(2026, 10, 5), 72.4)], now).change,
      T.bodyWeight([W(L(2026, 10, 2), 72.3), W(L(2026, 10, 3), 72.4), W(L(2026, 10, 4), 72.3), W(L(2026, 10, 5), 72.4)], now).avg7], [-0.4, { kg: 72.4, n: 4 }]);
  eq("the same weight: a change of 0, never −0", J(T.bodyWeight([W(S(28), 72.4), W(L(2026, 10, 5), 72.4)], now).change), "0");
  const future = T.bodyWeight([W(L(2026, 10, 5), 72.4), W(L(2026, 10, 9), 60)], now);
  eq("a weigh-in dated tomorrow hasn't happened yet", [future.last.kg, future.count, future.daysSince], [72.4, 1, 3]);

  // Weigh-ins x[0] days before 5 October, at noon, with waist x[1].
  const ago = k => M.addDays(M.startOfDay(L(2026, 10, 5)), -k).getTime() + 12 * 3600000;
  const waist = (list) => T.bodyWeight(list.map(x => W(ago(x[0]), 72, x[1])), now).waist;
  eq("waist: half a centimetre is the finest change shown (84 → 83.6 is −0.5)", waist([[28, 84], [0, 83.6]]).change, -0.5);
  eq("waist: measures 100 days back are too old, 10 days back too recent; the 60-day one is the reference", waist([[100, 90], [60, 86], [10, 85], [0, 84]]).ref.cm, 86);
  eq("waist: nothing old enough to compare with", waist([[10, 85], [0, 84]]), { last: { cm: 84, ts: ago(0) }, ref: null, change: null });
  eq("waist: the latest one measured, even when the latest weigh-in has none", waist([[20, 85], [0, null]]).last.cm, 85);

  const old = T.bodyWeight([W(L(2026, 1, 5), 75), W(L(2026, 2, 5), 74)], now);
  eq("nothing in the last 12 weeks: the numbers stay, the chart is empty", [old.last.kg, old.daysSince, old.chart.days, old.chart.points.length], [74, 245, 84, 0]);
  const long = T.bodyWeight([W(L(2026, 6, 28), 75), W(L(2026, 7, 5), 74.6), W(L(2026, 10, 5), 72.4)], now);
  eq("the average looks back before the chart's window", [long.chart.points.length, T.bodyWeight([W(L(2026, 7, 14), 76), W(L(2026, 7, 15), 75), W(L(2026, 7, 17), 74), W(now, 72.4)], now).chart.points[0]],
    [1, { ts: L(2026, 7, 17), kg: 74, avg: 75, n: 3 }]);
  const empty = { count: 0, last: null, prev: null, first: null, daysSince: null, change: null, month: null, sinceFirst: null, avg7: null,
    waist: { last: null, ref: null, change: null }, chart: { days: 28, from: M.addDays(M.startOfDay(now), -27).getTime(), points: [], split: false } };
  eq("no weigh-ins: every number empty, a 4-week window", T.bodyWeight([G(S(1), "bench_db", [8], 20)], now), empty);
  eq("junk weights are not weigh-ins", T.bodyWeight([{ kind: "body", ts: S(1) }, { kind: "body", ts: S(1), kg: "x" }, { kind: "body", ts: S(1), kg: 5 }, { kind: "body", ts: S(1), kg: 1e9 },
    { kind: "body", ts: S(1), kg: null }, { kind: "body", ts: "soon", kg: 72 }, { kind: "body", ts: 1e300, kg: 72 }, { kind: "body", ts: S(1), kg: true }, null, 7], now), empty);
}

section("body weight in the weeks the clocks change");
{
  // The Monday after each switch Sunday of 2026, here and in the other zone.
  [[3, 30], [10, 26], [3, 9], [11, 2]].forEach(([mo, d]) => {
    const mon = hh => L(2026, mo, d, hh);
    const back = (k, hh, mi) => { const x = M.addDays(M.startOfDay(mon(12)), -k); x.setHours(hh, mi || 0, 0, 0); return x.getTime(); };
    const log = [W(back(7, 0, 30), 80), W(back(7, 23, 30), 80), W(back(6, 0, 30), 73), W(back(1, 2, 30), 60), W(back(1, 23, 30), 72), W(mon(12), 71)];
    [12, 18, 23].forEach(hh => {
      const b = T.bodyWeight(log, mon(hh));
      check(mo + "/" + d + " " + hh + ":00 — the Monday before is day 7 (out), Tuesday 00:30 is day 6 (in), Sunday's two are one day",
        b.avg7 && b.avg7.n === 3 && b.avg7.kg === 72 && b.count === 4, J(b.avg7) + " count " + b.count);
    });
    const m = T.bodyWeight([W(back(43, 12), 80), W(back(35, 12), 75), W(back(21, 12), 74), W(back(20, 12), 60), W(mon(12), 71)], mon(13)).month;
    check(mo + "/" + d + " — a month is 21 to 35 calendar days back, by the calendar", m && m.ts === back(35, 12) && m.change === -4, J(m));
    const c = T.bodyWeight([W(back(84, 12), 70), W(back(83, 12), 71), W(mon(12), 72)], mon(13)).chart;
    check(mo + "/" + d + " — the chart's 12 weeks: 83 days back is in, 84 is out", c.days === 84 && c.points.length === 2 && c.from === M.addDays(M.startOfDay(mon(12)), -83).getTime(), J(c));
  });
  const a = Date.UTC(2026, 9, 8, 21, 0), b2 = Date.UTC(2026, 9, 8, 23, 30);
  const days = T.bodyWeight([W(a, 72), W(b2, 73)], Date.UTC(2026, 9, 10, 12)).count;
  check("two fixed instants: one day in New York, two in Rome (" + tz + ": " + days + ")", days === (M.dateStr(a) === M.dateStr(b2) ? 1 : 2));
  const sess = T.gymIndex([G(a, "leg_lift", [10], 0), G(b2, "leg_lift", [11], 0)]).byEx.leg_lift.days.length;
  check("…and the same for two gym entries: one session or two", sess === (M.dateStr(a) === M.dateStr(b2) ? 1 : 2));
}

section("the chart's axis: whole numbers, never from zero, never too tight");
{
  const sc = (a, b, s) => T.chartScale(a, b, s).ticks;
  eq("body weight 71.6–73.1 with 4 kg to show", sc(71.6, 73.1, 4), [70, 72, 74]);
  eq("a 0.5 kg wobble still gets 4 kg", sc(72.1, 72.6, 4), [70, 72, 74]);
  eq("a single value", sc(72.4, 72.4, 4), [70, 72, 74]);
  eq("a real 5 kg change gets its room", sc(70.8, 75.9, 4), [70, 72, 74, 76]);
  eq("an estimated max of 48–57", sc(48.1, 57.3, 8.6), [45, 50, 55, 60]);
  eq("reps 8–12", sc(8, 12, 4), [8, 10, 12]);
  eq("reps all 10: a flat line in the middle", sc(10, 10, 4), [8, 10, 12]);
  eq("added weight 0–5 never goes below zero", sc(0, 5, 4), [0, 2, 4, 6]);
  eq("all zero", sc(0, 0, 4), [0, 2, 4]);
  eq("the wrong way round", sc(60, 50, 4), sc(50, 60, 4));
  eq("data is never cut off when the range is just under the least", [T.chartScale(70.6, 74.4, 4).lo <= 70.6, T.chartScale(70.6, 74.4, 4).hi >= 74.4], [true, true]);
  eq("nothing that is a number", [sc(NaN, undefined, null), sc(null, null, 4), sc("x", {}, "y")], [[0, 1, 2], [0, 2, 4], [0, 1, 2]]);
  eq("huge", T.chartScale(0, 1e7, 4), { lo: 0, hi: 1e7, step: 1e7, ticks: [0, 1e7] });
  let bad = [];
  for (let i = 0; i < 4000; i++) {
    const a = (i * 7919 % 3000) / 7, b = a + (i * 104729 % 2000) / 13, s = [2, 4, 6, 20, 0.5][i % 5];
    const x = T.chartScale(a, b, s);
    const ok = x.hi > x.lo && x.lo >= 0 && x.lo <= a + 1e-9 && x.hi >= b - 1e-9 && x.ticks.length >= 2 && x.ticks.length <= 4 &&
      x.ticks.every(t => Number.isInteger(t)) && x.ticks[0] === x.lo && x.ticks[x.ticks.length - 1] === x.hi;
    if (!ok) bad.push(J([a, b, s, x]));
  }
  check("4,000 ranges: 2 to 4 whole ticks, from 0 up, holding all the data", !bad.length, bad.slice(0, 2).join("\n       "));
}

section("odd logs, odd times and odd names never break anything");
{
  const now = L(2026, 10, 8, 9);
  const clean = [pyr(S(1), 40, 5), pyr(S(4), 42.5, 5), G(S(5), "pullup_std", [8], 0), W(S(6), 72.4, 84)];
  const junk = [null, 7, "x", [], {}, { ts: "soon" }, { kind: "gym" }, { kind: "gym", ts: S(1), exId: "bench_db", sets: "8" },
    { kind: "gym", ts: S(1), exId: "bench_db", sets: [8, null, "x", -3, 1e9, true], kg: "60" }, { kind: "gym", ts: S(1), exId: "constructor", sets: [8], kg: [60] },
    { kind: "gym", ts: S(1), exId: "bench_db", sets: [8, 8], kg: [NaN, Infinity] }, { kind: "gym", ts: S(1), exId: {}, sets: [8] },
    { kind: "gym", ts: "soon", exId: "bench_db", sets: [8], kg: [60] }, { kind: "gym", ts: 1e300, exId: "bench_db", sets: [8], kg: [60] },
    { kind: "gym", ts: S(1), exId: "__proto__", sets: [8], kg: [60] }, { kind: "gym", ts: S(2), exId: "bench_db", sets: [8], kg: [60], warm: "yes" },
    { kind: "gym", ts: S(3), exId: "bench_db", sets: [8], kg: [70], warm: [null, 1, 1] }, { kind: "gym", ts: S(3), exId: "dips", sets: [], kg: [] },
    { kind: "body" }, { kind: "body", ts: S(1), kg: {} }, { kind: "body", ts: S(1), kg: -5, waist: "x" }, { kind: "body", ts: 1e300, kg: 72 }];
  const logs = [[], null, undefined, "log", { length: 3 }, clean, junk, clean.concat(junk), junk.concat(clean)];
  const nows = [now, L(2026, 3, 29, 2, 30), L(2026, 11, 1, 1, 30), NaN, undefined, null, "soon", 1e300, -1];
  const ids = ["squat_bb", "dips", "pullup_assist", "plank", "gone_ex", "constructor", "__proto__", "toString", "", undefined, null, 3, {}];
  const threw = [];
  [[], "junk", [{ id: "x_sled", name: "Sled", group: "legs", sec: [], equip: "other", lo: 8, hi: 12, inc: 5, perHand: false, load: "sled", timed: false, note: "", del: false, mts: 1 }]].forEach(reg => {
    T.useExercises(reg);
    logs.forEach((log, i) => nows.forEach(t => {
      try {
        const idx = T.gymIndex(log);
        T.records(log); T.records(idx); T.recordsIn(log, t); T.recordsIn(idx, t, t); T.lifts(log, t); T.lifts(idx, t); T.bodyWeight(log, t);
        ids.forEach(id => { T.trend(log, id); T.trend(idx, id, t); T.standing(log, id); T.standing(idx, id, t); T.recordFloor(id); T.strength(log, id, t); T.strength(idx, "legs", t, id); });
        T.progress(log, t); T.progress(idx, t);
        T.chartScale(t, log, id => id);
      } catch (e) { threw.push("log " + i + ", now " + String(t) + ": " + e.message); }
    }));
  });
  T.useExercises([]);
  check("no function throws, for 9 logs × 9 times × 13 exercise names × 3 sets of registered exercises", !threw.length, threw.slice(0, 3).join("\n       "));
  eq("junk only: no records, an empty index", [T.records(junk).length >= 0, T.records([null, 7, {}]), Object.keys(T.gymIndex("log").byEx)], [true, [], []]);
  eq("an entry with an impossible time is skipped, never filed under a bogus day",
    Object.keys(T.gymIndex([{ kind: "gym", ts: 1e300, exId: "bench_db", sets: [8], kg: [60] }]).byEx), []);
  eq("something that isn't a log or an index counts as an empty log", [T.records({ byEx: 3 }), T.lifts({ records: [] }, now).legs], [[], []]);
  const fake = { byEx: { squat_bb: {} }, records: [null], byEntry: {} };
  eq("…also when it looks like an index: only the ones gymIndex() made are taken for one",
    [T.lifts(fake, now).legs, T.trend(fake, "squat_bb"), T.standing(fake, "squat_bb", now), T.recordsIn(fake, now), T.records(fake)],
    [[], { kind: null, points: [] }, { w: null, r: null, show: null }, [], []]);
  const noName = JSON.parse('{"toString":null,"valueOf":null}');
  eq("an id that can't even be turned into text", [T.bodyWeight([W(now, 72, undefined, noName), W(now, 73, undefined, "b")], now).last.kg,
    T.records([G(S(1), "leg_lift", [10], 0, { id: noName }), G(S(1), "leg_lift", [11], 0), G(S(4), "leg_lift", [12], 0)]).length], [73, 1]);
}

section("a big log stays quick");
{
  const now = L(2026, 9, 30, 12), big = [];
  const exs = T.exerciseList().map(x => x.id);
  for (let i = 0; i < 3000; i++) {
    const t = L(2024, 10, 1 + Math.floor(i / 4), 7 + (i % 4) * 3);
    big.push(i % 11 === 0 ? W(t, 70 + (i % 50) / 10) : G(t, exs[i % exs.length], [12, 10, 8, 8, 6], [40, 60, 62.5 + (i % 40), 62.5 + (i % 40), 65 + (i % 40)]));
  }
  let t0 = Date.now();
  const idx = T.gymIndex(big);
  T.records(idx); T.recordsIn(idx, now); T.lifts(idx, now); T.bodyWeight(big, now); T.progress(idx, now); M.GROUPS.forEach(g => T.strength(idx, g, now));
  exs.forEach(id => { T.trend(idx, id); T.standing(idx, id); });
  let ms = Date.now() - t0;
  check("3,000 entries: the index, every chart, the lifts and body weight in well under a quarter of a second", ms < 250, "took " + ms + " ms");
  // A plateau: every set equal to hundreds before it. Only the marks may be
  // compared — comparing each set with every earlier set would take seconds.
  const flat = [];
  for (let i = 0; i < 3000; i++) flat.push(G(L(2018, 1, 1 + i, 12), "dips", Array.from({ length: 30 }, () => 8 + Math.floor(i / 300)), 0, { warm: Array.from({ length: 30 }, () => 0) }));
  t0 = Date.now();
  const r = T.records(flat).length;
  ms = Date.now() - t0;
  check("3,000 sessions of 30 equal sets: " + r + " records, in well under a second", r === 9 && ms < 1000, "took " + ms + " ms");
}

section("saving a weigh-in (model.js): what it does to the log");
{
  const NOW = L(2026, 10, 8, 9);
  const pg = h.load(["data.js", "model.js"], { now: NOW, seed: 3 });
  const Mf = pg.get("MODEL");
  const day = ts => Mf.dateStr(ts);
  const mon = { id: "mon", ts: L(2026, 10, 5, 7), kind: "body", kg: 72.4, waist: 84, note: "morning", mts: L(2026, 10, 5, 7) };
  const tue = { id: "tue", ts: L(2026, 10, 6, 7), kind: "body", kg: 72.6, waist: null, note: "", mts: L(2026, 10, 6, 7) };
  const log = [mon, tue];
  const d = (over) => Object.assign({ editId: null, dateKey: day(NOW), kg: "72,1", waist: "", note: "" }, over);
  let r = Mf.weighInWrite(log, d(), NOW);
  eq("a new one for a day that has none: the stored shape, the time passed in, stamped now",
    [Object.keys(r.entry), r.entry.ts, r.entry.kg, r.entry.waist, r.entry.mts, r.replaces, r.changed], [["id", "ts", "kind", "kg", "waist", "note", "mts"], NOW, 72.1, null, NOW, null, true]);
  r = Mf.weighInWrite(log, d({ dateKey: day(mon.ts), kg: "72.9", waist: "83,5", note: "evening" }), L(2026, 10, 5, 12));
  eq("a new one for a day that has one changes that one: same id, same time, a later stamp; the log doesn't grow",
    [r.entry.id, r.entry.ts, r.entry.kg, r.entry.waist, r.entry.note, r.replaces === mon, r.entry.mts > mon.mts, r.changed], ["mon", mon.ts, 72.9, 83.5, "evening", true, true, true]);
  r = Mf.weighInWrite(log, d({ editId: "mon", dateKey: day(mon.ts), kg: "72,4", waist: "84", note: "morning" }), 123);
  eq("the same values as stored (72,4 for 72.4): nothing to write, the stamp untouched", [r.changed, r.entry === mon, r.replaces === mon], [false, true, true]);
  eq("the weigh-in being edited is gone (deleted on another device meanwhile)", Mf.weighInWrite(log, d({ editId: "nope" }), NOW), { error: "gone" });
  eq("moved onto a day that already has another: refused", Mf.weighInWrite(log, d({ editId: "mon", dateKey: day(tue.ts) }), 1), { error: "taken" });
  r = Mf.weighInWrite(log, d({ editId: "mon", dateKey: "2026-10-07", kg: "72.4", waist: "84", note: "morning" }), L(2026, 10, 7, 12));
  eq("moved onto a free day: the id stays, the time becomes that day's", [r.entry.id, r.entry.ts, r.changed, r.replaces === mon], ["mon", L(2026, 10, 7, 12), true, true]);
  r = Mf.weighInWrite(log, d({ editId: "mon", dateKey: day(mon.ts), kg: "72.5", waist: "84", note: "morning" }), 5);
  eq("edited on its own day: the time is kept exactly", [r.entry.ts, r.entry.kg], [mon.ts, 72.5]);
  const kg = v => { const x = Mf.weighInWrite([], d({ kg: v }), NOW); return x.error || x.entry.kg; };
  eq("weights as typed", ["72,4", "72.35", "19.95", "19.94", "300.04", "300.05", "", "72 kg", null, true, [72], "Infinity", -70].map(kg),
    [72.4, 72.4, 20, "kg", 300, "kg", "kg", "kg", "kg", "kg", "kg", "kg", "kg"]);
  const waist = v => { const x = Mf.weighInWrite([], d({ waist: v }), NOW); return x.error || x.entry.waist; };
  eq("waist as typed: empty is no waist; anything typed that can't be saved is said, never dropped silently",
    ["84,5", "", "   ", null, undefined, "abc", "0", "29.94", "250.05", "84 cm"].map(waist), [84.5, null, null, null, null, "waist", "waist", "waist", "waist", "waist"]);
  const twoOnADay = [mon, Object.assign({}, mon, { id: "mon2", ts: mon.ts + 3600000, kg: 73 })];
  eq("a day with two (from two devices): a new save changes the later, and leaves the other alone", Mf.weighInWrite(twoOnADay, d({ dateKey: day(mon.ts), kg: "71" }), 1).entry.id, "mon2");
  eq("a note is cut to what an entry holds", Mf.weighInWrite([], d({ note: "x".repeat(400) }), NOW).entry.note.length, 280);
  eq("a log that isn't one", [Mf.weighInWrite(null, d(), NOW).changed, Mf.weighInWrite("log", d({ editId: "a" }), NOW)], [true, { error: "gone" }]);
  eq("nothing to save at all", [Mf.weighInWrite(log, null, NOW), Mf.weighInWrite(log, undefined, NOW), Mf.weighInWrite(log, 5, NOW)], [{ error: "kg" }, { error: "kg" }, { error: "kg" }]);
}

section("weigh-ins and the merge: two devices, the same day");
{
  const a = M.defaultState(), b = M.defaultState();
  const wa = W(L(2026, 10, 8, 7), 72.4, undefined, "wA"), wb = W(L(2026, 10, 8, 8), 72.6, undefined, "wB");
  a.log = [wa, pyr(S(1), 40, 5), pyr(S(4), 42.5, 5)]; b.log = [wb, pyr(S(8), 45, 5)];
  const ab = M.sanitizeState(M.merge(M.sanitizeState(a), M.sanitizeState(b))), ba = M.sanitizeState(M.merge(M.sanitizeState(b), M.sanitizeState(a)));
  check("both weigh-ins survive, and the two devices end up identical", J(ab) === J(ba) && ab.log.filter(e => e.kind === "body").length === 2);
  eq("…both read the later one as the day's value", [T.bodyWeight(ab.log, L(2026, 10, 8, 20)).last.id, T.bodyWeight(ba.log, L(2026, 10, 8, 20)).last.id], ["wB", "wB"]);
  check("…and both work out the same records", J(T.records(ab.log)) === J(T.records(ba.log)) && T.records(ab.log).length === 2);
  const edited = Object.assign({}, wa, { kg: 72.9, waist: 84, mts: wa.mts + 2000 });
  const c = M.defaultState(), e = M.defaultState();
  c.log = [wa]; e.log = [edited];
  eq("the same weigh-in edited on one device: the later edit wins", M.merge(M.sanitizeState(c), M.sanitizeState(e)).log[0].kg, 72.9);
  const gone = M.defaultState();
  gone.deleted = [{ id: "wA", ts: wa.mts + 1000 }];
  eq("…a delete older than that edit loses to it; a newer one removes it",
    [M.merge(M.sanitizeState(e), M.sanitizeState(gone)).log.length, M.merge(M.sanitizeState(c), M.sanitizeState(gone)).log.length], [1, 0]);
  check("a weigh-in is never training: no workout, no hard set", !M.isTraining(wa) && J(T.groupWeights(wa)) === "{}" && T.totalWorkouts([wa]) === 0);
}

h.done(__filename);
