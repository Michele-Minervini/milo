# Milo (formerly Big Six Tracker) — Roadmap & Decisions

A running record of where the app is, what's next, and the reasoning behind
the choices — so the context survives across work sessions.

**Live app:** https://michele-minervini.github.io/milo/ (moved from
`…/calisthenics-tracker/` — see README, "Moving from the old address").

---

## Where we are

All tiers are built, tested, and deployed. Settings → More shows the build a device runs.

| Tier | Shipped | What it added |
|------|---------|---------------|
| **Tier 0** | base | Six-axis radar ("star") chart, 10 rings each; step browser with per-exercise instructions, rep goals, and demo-video links; progress saved in the browser; backup via a shareable link. |
| **Tier 1** | v5 | Log a session (sets/reps or hold time); auto-detection of the Beginner/Intermediate/Progression standard with a move-up prompt; global rest timer; training-history list; downloadable full backup file. |
| **Tier 2** | v7–v8 | Weekly routine + "Today's session" card; smart nudge; ghost radar (past vs now); GitHub-style training heatmap; streaks; milestone timeline; per-exercise sparkline; edit a logged session; QR code for the backup link. |
| **Tier 3** | v9–v10 | Day detail (tap a heatmap square for that day's sessions); **optional cloud sync** across devices, paired by QR. |
| **Milo P5** | milo-v25 | **Records, charts, weigh-ins — no data bump.** Everything is derived from the log (`TRAINING.gymIndex`, one pass, built once per refresh in app.js): a **record** is a harder weight than ever in a set of at least lo − 2 reps (one floor for every set, the fewest `suggest()` ever asks for), or with no weight on more reps in one set than ever (a hold: the next 5 s); the first day with a counted set is the mark to beat, never a record; one record per exercise per day; added weight keeps two marks (weight, reps) so a single weighted set doesn't mute bodyweight records. Shown as a toast on the tick (today's sheet only), a "To beat" line in the gym sheet that becomes "New record today", a 🏆 line on the History row, a line under History's numbers and a **Records and milestones** list. **Exercise sheet**: the marks (weight to beat / most reps), a line chart of the last 20 sessions (`TRAINING.trend`: estimated 1-rep max for ranges up to 15 reps, else top weight / reps / seconds; `lineChartSVG` + `TRAINING.chartScale`, an axis that doesn't start at zero and never zooms tighter than a set span), a Records table. **Body**: each group's main gym exercise (`TRAINING.lifts`: most session days in 8 weeks, then the heavier movement) and the list in the group sheet. **Weigh-ins**: the `kind:"body"` entry the data has had since v5 now has a form (`MODEL.weighInWrite` decides the write: a device never makes a second one for a day; two devices still can, and the later is the day's value) and a Body weight card and sheet (`TRAINING.bodyWeight`: every number hangs on the latest weigh-in, not on today; "about a month" = the weigh-in nearest 28 days before it; a 7-day average only from 3 weigh-in days, so a weigh-in a week is compared reading against reading). **Settings**: sync space used (`SYNC.usage`, the same measure `push()` refuses on; a refused push is now `kind: "full"` with its own words). Older builds keep working on the same data: they show weigh-ins read-only and can delete them. Also faster: Body asked `lastTrained` six times a render (now once) and the calendar scanned the whole log per day (now the shown weeks once). Fixed on the way (both older than P5): in a day's sheet only the first entry could be opened (`es.map(entryRowHTML)` passed the index as a second argument), and a sync round that merged new data but then failed to push left the screen showing the old data. |
| **Copy of last time** | milo-v24 | A new gym session opens with last time's rows (`TRAINING.planRows`): one per set, with its weight and warm-up mark, the reps to aim for as the grey number in the box. The top sets take the suggestion's weight and targets; warm-ups and build-up sets repeat last time. Coming back mid-session brings back the rows still to do. Nothing new is stored. |
| **Data v6** | milo-v23 | **Warm-ups by hand**: a gym entry gains `warm` (one 0/1 per set, or `null` = never marked: the old weight rule still decides, so earlier sessions keep their numbers). In the gym sheet a set's number is a button: tap for **W**, logged but not counted; every new set counts until tapped. **Gym rest 0:50**: the default, and the 2:00 every older copy of the data carries is read as 0:50 when the data is older than v6 (value only, stamp kept, so the result doesn't depend on which device updates first; a later choice wins). **Dots in two levels** on the week strip and the calendar: solid = trained directly that day (`TRAINING.directWeights`: a gym exercise's own group, a quick log's listed groups, a skill's top-weighted group), ring = only as a helper. Catalogue: Dumbbell split squat; Lat pulldown became "(front)" and "(behind the head)" was added. Shipped as ONE build with its features: the guards below stop a device still on data v5 (it pauses sync and asks to reload); a half-step build would have erased marks. The cloud record keeps its name (`m5`), which is what lets an older device see the newer data and stop. Safety copy of the v5 data: `milo.pre6`. |
| **Milo tweaks** | milo-v22 | After the first real gym weeks: **push-ups, plain pull-up, mid row and three more back exercises, a six-move abs circuit, forearm curls** in the catalogue; the assisted pull-up, cable crunch and ab wheel are **retired** (`GYM_RETIRED` in data.js: out of the picker, still resolving for old sessions — ids are never removed). Search ignores spaces, hyphens and a plural "s" ("pull ups" finds "Pull-up"). **0:50** rest. **Notification when the rest ends** (per-device, `milo.restNotify`; `registration.showNotification`, no server): the only route to a buzz on an iPhone — unconfirmed without a test on the device, hence the test button — and only while Milo is on screen, so the option also holds the screen on during a rest; the "Rest done" pill pulses. A rest that ended while the app was away no longer beeps on coming back. Added weight (pull-ups, dips) never counts as a "big jump" in suggestions. |
| **Milo P2b** | milo-v21 | **Moved to `/milo/`** (new repo Michele-Minervini/milo). Once switched over, the old address is served by the repo `calisthenics-tracker` (local folder `calisthenics-tracker-redirect`): browser tabs are forwarded, sync links included; an app installed from the old address shows what it still holds with a backup button, its sync link and the steps to move; its `sw.js` switches off old installed copies (after a 12-second grace period for their last sync). In Milo: the sync QR tells iPhones to paste the link instead of scanning; a sync link pasted into the database box connects; "Coming from another device?" jumps to the right box. |
| **Milo P4** | milo-v20 | **Gym exercises**: a catalogue (data.js `GYM_EXERCISES`, permanent ids) plus your own (`x_…` in `state.exercises`), a gym sheet with reps × kg per set where every ✓ saves at once, last time, a double-progression suggestion, warm-up sets recognised (and not counted), an exercise sheet (your numbers, rep range / weight step / setup note, history). Rest: +30 s / Skip, separate gym rest, kept across reloads; optional keep-screen-on. |
| **Milo P3** | milo-v19 | **Four tabs** (Today · Body · Skills · History) with ＋ Log in the middle of the tab bar. Body: hard sets per muscle group vs target, pace, "this point last week", a balance radar, a sheet per group (what counted, 8 weeks, the skills that train it). History: week streak, month calendar with a dot per group, filterable list with milestones. Weekly targets in Settings; sync status on the gear. The day streak and heatmap are gone. |
| **Milo P1–P2a** | v16–milo-v18 | Renamed **Milo**. Data v5 (entry kinds, per-field settings sync, a new sync record, guards against old copies), tests; quick **gym day** log; home bars of **hard sets per muscle group this week** against 10–20 (arms/legs 20–40). Plan for the rest: `~/.claude/plans/i-want-to-rename-distributed-goblet.md` (P3 tabs, P4 gym exercises, P2b move to /milo/, P5–P7). |
| **Tier 4** | v15 | **The plan.** Every movement carries a prescription (exercise, sets, reps, standard being chased) derived from your current position; guided session walkthrough; 38 swap variations; exercise library; week view with a per-area "what's next" map. |

Each tier went through an adversarial multi-agent review before shipping; the
Tier 2 review caught a whole class of daylight-saving date bugs, now fixed and
regression-tested.

## Guiding principles (why the app is the way it is)

- **Free, no accounts, works offline.** Everything lives in the browser
  (`localStorage`); hosting is GitHub Pages. This is a hard constraint, not a
  default. Cloud sync (below) is opt-in and doesn't bend it: still free, still
  no account, and `localStorage` remains the real store.
- **No build step, no frameworks.** Plain HTML/CSS/JS. Editing a file and
  reloading is the whole workflow — approachable to maintain.
- **Generic calisthenics.** No references to any specific book or author,
  anywhere in the app or repo.
- **Verify by exercising, not by assuming.** New behaviour is checked in a real
  browser (and the QR encoder was validated by decoding its own output).

## Explicitly decided *against* (so we don't re-litigate)

- **Push notifications** — chose a gentle in-app nudge instead (real phone push
  is unreliable on iOS and needs the installed app + permissions).
- **User accounts, passwords, a server we run** — sync is done with a secret
  code against your own free database instead.
- **Any book/author references** — the app stands on its own.

## Offered but not chosen (easy to add later if wanted)

- Per-side (left/right) logging for the one-arm / one-leg exercises.
- Warm-up-set suggestions before working sets.
- A custom routine-day builder (currently: guided 2 / 3 / 6-day presets).

## Ideas for a possible Tier 3+

None committed — just a menu for later:

- Export the training log to a CSV/text file.
- Editable routine day-assignments (rearrange which movements fall on which day).
- Longer-range analytics (training-volume trends over weeks/months).
- A short first-run walkthrough for new users.
- Optional localization (e.g. an Italian UI).
- **Archive old years** (will be needed, not optional): the sync record holds
  900,000 characters. Measured on a realistic log (4 gym days a week, 7
  exercises, pyramids with marks, a weekly weigh-in): about 172 characters per
  gym entry, about 257 KB a year, so 75 % after roughly 2.6 years and full
  after about 3.5. Settings shows the share used since milo-v25. When it is
  full every device keeps saving locally but none can write the cloud copy
  (`SYNC.push` rejects with `kind: "full"`), and each still downloads the
  record on every focus. The fix is a second record per year
  (`/u/<code>m5a<YYYY>`) that old entries move into. Deleting old sessions by
  hand is NOT a way out with sync on: only the last 1,000 deletions are
  remembered, so more than that come back from the cloud.
- A strength estimate for added-weight exercises (pull-ups, dips) that counts
  body weight, now that weigh-ins exist.

## Working notes for future edits

- **Every deploy gets a new build: `sh tools/set-build.sh milo-vN`**, then
  `git add -A` and `sh tests/run.sh` (README has the four steps). The service
  worker only serves what it cached when its `VERSION` last changed — no
  background refreshing, which could mix two releases — so without a new build
  phones never see the change. The install downloads every file under a fresh
  URL and rejects the release unless each stamped file really carries
  `VERSION` (GitHub's CDN can serve a stale copy for a few minutes after a
  push); a failed install leaves the previous release running and retries
  later. If the cache is ever wiped (another app on the origin, or the
  browser), the worker downloads the release again on the next miss.
  `tests/static-test.js` fails when stamps disagree, when the page loads a file
  that isn't cached or isn't in git, or when app files changed but the build
  number didn't.
- **A new script needs five things:** a `<script>` tag in index.html (after
  model.js, before app.js), an entry in sw.js `ASSETS` and `STAMPED`, a
  `  var BUILD = "…";` stamp that tools/set-build.sh rewrites (add the file to
  its loop), the stamp in tests/static-test.js, and a `buildParts` entry at the
  top of app.js. static-test catches a missing ASSETS/STAMPED entry.
- **Tabs, not pages.** index.html has four panes (`#pane-today` … `#pane-history`)
  and app.js `showTab()` shows one; every pane is re-rendered by `refresh()`,
  so a sync, another tab or a restore updates all of them. The open tab lives
  in sessionStorage (`milo.tab`), never in the URL hash (sync and progress
  links use it). Sheets stack on top: a sheet opened from a sheet gets
  "‹ <previous title>" automatically (`viewTitle`), and a view type this
  version doesn't know is dropped instead of opening Settings.
- **Gym logging saves on every ✓.** One log entry per exercise per workout
  (`kind: "gym"`); the first tick creates it with a stable id, later ticks
  update it, un-ticking the last set removes it. Untyped/unticked rows live only
  in a per-device draft (`milo.gymDraft`). Exercise ids in data.js are stored in
  logs forever: never rename or remove one (tests/data-test.js freezes the list);
  add new ones instead. `TRAINING.useExercises(state.exercises)` must run
  whenever state changes (refresh() does it) so custom exercises count.
- **Per-device flags** (localStorage, never synced): `milo.whatsnew`
  ("What's new" card, only on devices that had data before P3) and
  `milo.come` ("Coming from another device?" on an untouched device),
  `milo.rest` (a running rest timer's end time), `milo.gymDraft`,
  `milo.restNotify` ("on": send a notification when the rest ends — the
  permission is per device too), `milo.pre6` (the data as it was before
  data v6, offered in Settings → More; `milo.pre5` from the earlier update
  may still sit beside it and is left alone).
- **Weekly volume is counted, never stored** (training.js). Each hard set counts
  1 for its main muscle group and ½ for each helper (data.js `AREA_GROUPS`,
  per-step overrides, `VARIATION_GROUPS`); a quick gym day gives its groups'
  usual helpers ¼ per set (`QUICK_GROUPS`). Targets are the base range in
  `settings.vol` times `GROUP_INFO.scale` (arms and legs ×2). A new variation
  or step fails tests/data-test.js until it is mapped.
- **"Finishing an update"** is what app.js shows, before touching storage, if
  a launch ever gets files from two builds. Reload asks for the new release;
  a second time in a row it drops this app's offline copy (never its data) and
  loads from the network. Offline, it says so and reloads itself when the
  connection returns.
- **Cache names carry the app's path** (`milo-v21@/milo/`), and cleanup only
  deletes this path's old versions (plus the pre-stamp `bigsix-vN` caches, and
  only when running at `/calisthenics-tracker/`, the one place that created
  them — `LEGACY_PATH` in sw.js, inert at `/milo/`; never change it). Cache
  Storage is shared by the whole `michele-minervini.github.io` origin, so a
  global cleanup would wipe other apps' offline copies — the old address's
  switch-off worker, too, deletes only `…@/calisthenics-tracker/` and
  `bigsix-vN`. The korea-trip app on the same origin cleans only its own
  `korea-*` caches (fixed September 2026); the self-repair above covers any
  app that doesn't.
- **When re-testing after a change, hard-reload / clear the service worker
  cache first** — a stale cache once made a correct fix look broken for a while.
- **Never do date math by adding `86400000` ms.** Use the calendar-day helpers
  (`startOfDay` / `addDays` / `dayDelta`) in `model.js`, or daylight-saving days
  silently drop or duplicate.
- **What gets stored is pinned by tests.** `model.js` holds the default state,
  the sanitizers every load / restore / sync goes through, and the merge.
  `tests/fixtures/sanitize-v<N>.json` (hand-written cases) and
  `recorded-v<N>.json` (fingerprints of 400 random states and 300 merges, both
  orders), N being the current data version, record their exact output;
  `tests/model-test.js` and `tests/merge-test.js` fail on any change. A
  deliberate change to the stored shape bumps `MODEL_VERSION` in `model.js`
  and re-records with `node tools/record-fixtures.js`, which refuses to run
  otherwise — never "fix the test" to match.
- **The backup-link payload order is frozen** (`PAYLOAD_ORDER` in `app.js`) so
  old links keep importing correctly — never reuse the radar's axis order for it.
- **Sync merges must stay commutative and idempotent.** Both devices run the
  same `merge()` with no server to arbitrate, so `merge(a,b)` and `merge(b,a)`
  have to produce byte-identical results — otherwise the two copies never
  compare equal and the devices push at each other forever. Every sort inside
  it falls back to the id for exactly this reason; a sort on timestamp alone is
  not a total order. `tests/merge-test.js` covers this.
- **The plan is derived, never stored.** `prescribe()` reads your current step
  and standard on every render. That is the whole reason the plan follows you
  when you level up — resist any urge to cache it, or it will go stale exactly
  when it matters.
- **An easier variation must never award a standard.** Variations are tagged
  `easier` / `same` / `harder` in `data.js`; `saveLog` skips the auto-detection
  for `easier` ones. Otherwise slow negatives would "earn" a step you can't do.
- **Data v5 (September 2026) and the sync cutover.** `model.js` defines the
  stored shape (top of the file). Log entries have kinds — calisthenics (no
  `kind`), `gym`, `quick`, `body` — so gym tracking can build on it; settings
  merge per field via `pm` stamps; merge is commutative, idempotent and
  associative (tests/merge-test.js checks all three on random states). Sync
  writes only `/u/<code>m5`; the old `/u/<code>` record is read-only and still
  merged in (training only, never settings) whenever an old copy of the app
  writes to it — until P7 retires that read (target: 60 days after cutover).
- **Settings carried over from v4 never beat a v5 choice.** Migration stamps
  them at the old `prefsMts`, capped at `MODEL.MIGRATED_PREFS_MAX` (the v5
  release instant), and every v5 change is stamped after it (`stampPref`).
  Otherwise an old copy still running after the update (an iPhone home-screen
  app resumes rather than reloads) could touch its rest timer and, once it
  migrated, undo a routine picked in v5. Don't move that constant.
- **Names from stored data are never used as plain-object keys.** Ids, split
  and equipment names pass format checks that "constructor" and "__proto__"
  also pass; lookup tables keyed by them are `Object.create(null)` (model.js
  `dict()`), such names are refused where a table is keyed by a setting
  (`plainName`), and app.js looks presets up by own key only.
- **Never strip data from a newer version.** `MODEL.isNewer()` guards every
  entry point: sync (the cloud is newer → pause, don't push), load (stored data
  is newer → read-only + banner, never save), another tab (same), restore
  (refused). Any change to the stored shape must bump `MODEL_VERSION`, so
  these guards can recognise it — fix forward, never revert across a bump.
  (v5 shipped on its own because older copies had no guards yet. Since v5
  they do, so v6 shipped together with the feature that needed it: a build
  that knows the new shape but still writes entries the old way would have
  erased the new marks.) Keep the cloud record's name (`m5`): an older device
  only stops when it SEES the newer data there. Each bump takes a fresh
  safety-copy key (`milo.pre6`), since a copy is never replaced.
- **Reset / replace-from-backup mark themselves** (`milo.replaceAt`) so other
  open tabs adopt the result instead of merging the removed sessions back.
  With sync on, other devices still merge them back — that's inherent to a
  union merge and the dialogs say so.
- **Anything arriving from the network goes through `sanitizeState()`** before
  it is merged, same as a restored backup file. Treat the cloud copy as
  untrusted input, because anyone holding the sync code can write to it.
